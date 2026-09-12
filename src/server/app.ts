import { getIPFromHeader, isValidIP } from "@better-auth/core/utils/ip";
import { securityHeaders } from "./security-headers";
import { MemoryLimiter, consumeBudget } from "./rate-limits";
import { cacheReadiness } from "./readiness";
import { Hono } from "hono";
import { BodyReader, ConcurrencyGate } from "./request-body";
import {
  IMPORT_BODY_BYTES,
  REQUEST_BODY_BYTES,
  isImportPath,
} from "../shared/limits";
import { z } from "zod";
import { readMigrationFiles } from "drizzle-orm/migrator";
import type { Database } from "../db/connection";
import { createAuth } from "./auth";
import { policyPage } from "./policy";
import {
  JsonDepthError,
  commitSchema,
  defaults,
  settingsSchema,
  validateRow,
} from "../shared/model";
import { prepareImport } from "../shared/import";
import {
  AppError,
  applyOperations,
  fingerprint,
  readRows,
  readSnapshot,
  writeOnce,
} from "./store";

type Variables = {
  userId: string;
  requestId: string;
  clientIP: string;
  sessionCreatedAt: Date;
};
const importSchema = z
  .object({ file: z.unknown(), timezone: settingsSchema.shape.timezone })
  .strict();
export function createApp(database: Database) {
  const auth = createAuth(database);
  const expectedMigrations = readMigrationFiles({
    migrationsFolder: "drizzle",
  });
  const app = new Hono<{
    Variables: Variables;
    Bindings: { clientIP?: string | null };
  }>();
  app.use("*", async (c, next) => {
    const start = performance.now();
    const requestId = crypto.randomUUID();
    c.set("requestId", requestId);
    c.header("X-Request-ID", requestId);
    for (const [key, value] of securityHeaders()) c.header(key, value);
    if (c.req.path.startsWith("/api/")) c.header("Cache-Control", "no-store");
    await next();
    if (process.env.NODE_ENV !== "test")
      console.info(
        JSON.stringify({
          requestId,
          method: c.req.method,
          route: c.req.path.replace(/[0-9a-f-]{36}/g, ":id"),
          status: c.res.status,
          durationMs: Math.round(performance.now() - start),
        }),
      );
  });
  const admission = new MemoryLimiter();
  let inFlight = 0;
  app.use("/api/*", async (c, next) => {
    const ip =
      c.env?.clientIP && getIPFromHeader(c.env.clientIP, { ipv6Subnet: 64 });
    if (!ip || !isValidIP(ip))
      throw new AppError(
        400,
        "CLIENT_IP_UNAVAILABLE",
        "A verified client address is required",
      );
    c.set("clientIP", ip);
    // Once globally saturated, allocate no new IP entries. Throttled IPs
    // still never spend the shared budget. The map stays bounded under churn.
    const retry =
      admission.retryAfter("global", 1200) ||
      admission.consume(`ip:${ip}`, 120, 60000) ||
      admission.consume("global", 1200, 60000);
    if (retry || inFlight >= 20) {
      c.header("Retry-After", String(retry || 1));
      throw new AppError(
        429,
        "RATE_LIMITED",
        "Too many requests. Please try again shortly.",
      );
    }
    inFlight++;
    try {
      await next();
    } finally {
      inFlight--;
    }
  });
  const bodyReader = new BodyReader();
  const imports = new ConcurrencyGate(2, 1);
  app.use("/api/auth/*", async (c, next) => {
    c.req.raw = await bodyReader.read(
      c.req.raw,
      c.get("clientIP"),
      REQUEST_BODY_BYTES,
    );
    await next();
  });
  // No admin, password signup, or password recovery routes are exposed by the web application.
  const authPaths = new Set([
    "/sign-in/email",
    "/sign-in/social",
    "/callback/google",
    "/sign-out",
    "/get-session",
    "/change-password",
  ]);
  app.all("/api/auth/*", async (c) => {
    if (!authPaths.has(c.req.path.slice("/api/auth".length)))
      return c.json(
        { error: { code: "NOT_FOUND", message: "Not found" } },
        404,
      );
    if (
      !["GET", "HEAD", "OPTIONS"].includes(c.req.method) &&
      c.req.header("origin") !== new URL(process.env.BETTER_AUTH_URL!).origin
    )
      throw new AppError(
        403,
        "INVALID_ORIGIN",
        "Request origin is not allowed",
      );
    const clientIP = c.get("clientIP");
    if (!clientIP || !isValidIP(clientIP))
      throw new AppError(
        400,
        "CLIENT_IP_UNAVAILABLE",
        "A verified client address is required",
      );
    const headers = new Headers(c.req.raw.headers);
    headers.delete("x-internal-client-ip");
    headers.set("x-spartacus-client-ip", clientIP);
    if (c.req.path === "/api/auth/sign-in/social" && c.req.method === "POST") {
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET)
        throw new AppError(
          503,
          "SIGN_IN_UNAVAILABLE",
          "Google sign-in is not configured yet. Please contact the operator.",
        );
      // Exclude native idToken login and caller-selected scopes/parameters.
      // Google must always use the browser state-cookie + PKCE flow.
      const body = z
        .object({
          provider: z.literal("google"),
          callbackURL: z.literal("/"),
          errorCallbackURL: z.literal("/").optional(),
        })
        .strict()
        .parse(await c.req.json());
      return auth.handler(
        new Request(c.req.url, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        }),
      );
    }
    return auth.handler(new Request(c.req.raw, { headers }));
  });
  app.use("/api/v1/*", async (c, next) => {
    const headers = new Headers(c.req.raw.headers);
    headers.set("x-spartacus-client-ip", c.get("clientIP"));
    headers.delete("x-internal-client-ip");
    const session = await auth.api.getSession({ headers });
    if (!session)
      throw new AppError(401, "UNAUTHENTICATED", "Please sign in again.");
    c.set("userId", session.user.id);
    c.set("sessionCreatedAt", session.session.createdAt);
    const allowed = await consumeBudget(
      database,
      `session:${session.session.id}`,
      120,
    );
    const expensive = [
      "/api/v1/import",
      "/api/v1/import/preview",
      "/api/v1/export",
      "/api/v1/state",
      "/api/v1/history",
      "/api/v1/account/delete",
    ].includes(c.req.path);
    if (
      !allowed ||
      (expensive &&
        (!(await consumeBudget(
          database,
          `transfer-ip:${c.get("clientIP")}`,
          30,
        )) ||
          !(await consumeBudget(database, `transfer:${session.user.id}`, 10))))
    ) {
      c.header("Retry-After", "60");
      throw new AppError(
        429,
        "RATE_LIMITED",
        "Too many requests. Please wait a minute and retry.",
      );
    }
    if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method)) {
      if (
        c.req.header("origin") !== new URL(process.env.BETTER_AUTH_URL!).origin
      )
        throw new AppError(
          403,
          "INVALID_ORIGIN",
          "Request origin is not allowed",
        );
      if (!c.req.header("content-type")?.startsWith("application/json"))
        throw new AppError(415, "CONTENT_TYPE", "JSON is required");
    }
    await next();
  });
  // Authenticate and validate the origin before accepting larger import bodies.
  app.use("/api/v1/*", async (c, next) => {
    const importing = isImportPath(c.req.path) && c.req.method === "POST";
    let release: (() => void) | undefined;
    try {
      if (importing) release = imports.acquire(c.get("userId"));
      c.req.raw = await bodyReader.read(
        c.req.raw,
        c.get("clientIP"),
        importing ? IMPORT_BODY_BYTES : REQUEST_BODY_BYTES,
      );
      await next();
    } finally {
      release?.();
    }
  });
  app.get("/privacy", (c) => policyPage(c.req.path));
  app.get("/terms", (c) => policyPage(c.req.path));
  app.post("/api/v1/account/delete", async (c) => {
    z.object({ confirmation: z.literal("DELETE") })
      .strict()
      .parse(await c.req.json());
    if (Date.now() - c.get("sessionCreatedAt").getTime() > 10 * 60 * 1000)
      throw new AppError(
        403,
        "REAUTH_REQUIRED",
        "Sign out and sign in again, then confirm deletion within 10 minutes.",
      );
    const userId = c.get("userId");
    await database.client.begin(async (sql) => {
      await sql`SELECT pg_advisory_xact_lock(hashtextextended(${userId},0))`;
      await sql`DELETE FROM request_buckets WHERE key=${`transfer:${userId}`}
        OR key IN (SELECT 'session:' || id FROM auth_session WHERE user_id=${userId})`;
      await sql`DELETE FROM auth_verification WHERE identifier LIKE 'reset-password:%' AND value=${userId}`;
      await sql`DELETE FROM auth_user WHERE id=${userId}`;
    });
    // All server sessions are gone; clear the browser cookie as well.
    const signedOut = await auth.api.signOut({
      headers: c.req.raw.headers,
      asResponse: true,
    });
    for (const cookie of signedOut.headers.getSetCookie())
      c.header("Set-Cookie", cookie, { append: true });
    return c.json({ deleted: true });
  });
  // One DB round-trip, coalesced and limited to once per five seconds.
  const readiness = cacheReadiness(async () => {
    const applied = await database.client`
      SELECT id,hash FROM app_schema_migrations
      UNION ALL SELECT 0,'' FROM auth_user, tracking_entries, tracking_schedules,
        tracking_checklists, tracking_settings, tracking_fasts, request_buckets WHERE false
      ORDER BY id`;
    return expectedMigrations.some(
      (migration, id) =>
        applied[id]?.id !== id || applied[id]?.hash !== migration.hash,
    )
      ? "migration_required"
      : "ready";
  });
  app.get("/health/live", (c) => {
    c.header("Cache-Control", "no-store");
    return c.json({ status: "ok" });
  });
  app.get("/health/ready", async (c) => {
    c.header("Cache-Control", "no-store");
    const status = await readiness();
    return c.json({ status }, status === "ready" ? 200 : 503);
  });
  app.get("/api/v1/state", async (c) =>
    c.json({ rows: await readSnapshot(database, c.get("userId")) }),
  );
  app.get("/api/v1/history", async (c) => {
    const query = z
      .object({
        from: z.iso.date(),
        to: z.iso.date(),
        category: z.string().optional(),
      })
      .parse(c.req.query());
    if (query.from > query.to)
      throw new AppError(
        400,
        "VALIDATION",
        "History start must be on or before its end",
      );
    return c.json({
      rows: await readSnapshot(database, c.get("userId"), query),
    });
  });
  app.get("/api/v1/days/:date", async (c) => {
    const day = z.iso.date().parse(c.req.param("date"));
    return c.json({
      rows: await readSnapshot(database, c.get("userId"), { day }),
    });
  });
  app.post("/api/v1/commit", async (c) => {
    const body = commitSchema.parse(await c.req.json());
    const key = z.uuid().parse(c.req.header("idempotency-key"));
    return c.json(
      await writeOnce(
        database,
        c.get("userId"),
        key,
        { route: "commit", body },
        (sql) => applyOperations(sql, c.get("userId"), body.operations),
      ),
    );
  });
  app.post("/api/v1/fast/start", async (c) => {
    const body = z
      .object({ timezone: settingsSchema.shape.timezone })
      .strict()
      .parse(await c.req.json());
    const key = z.uuid().parse(c.req.header("idempotency-key"));
    return c.json(
      await writeOnce(
        database,
        c.get("userId"),
        key,
        { route: "fast/start", body },
        async (sql) => {
          if (
            !(await readRows(sql, c.get("userId"))).some(
              (row) => row.kind === "settings",
            )
          )
            await applyOperations(sql, c.get("userId"), [
              {
                action: "put",
                row: {
                  id: crypto.randomUUID(),
                  kind: "settings",
                  date: null,
                  category: null,
                  revision: 0,
                  data: { ...defaults, timezone: body.timezone },
                },
              },
            ]);
          const row = validateRow({
            id: crypto.randomUUID(),
            kind: "fast",
            date: null,
            category: null,
            revision: 0,
            data: {
              startTimestampMs: Date.now(),
              endTimestampMs: null,
              timezone: body.timezone,
            },
          });
          await applyOperations(sql, c.get("userId"), [{ action: "put", row }]);
        },
      ),
    );
  });
  app.post("/api/v1/fast/stop", async (c) => {
    const body = z
      .object({ id: z.uuid(), revision: z.number().int().positive() })
      .strict()
      .parse(await c.req.json());
    const key = z.uuid().parse(c.req.header("idempotency-key"));
    return c.json(
      await writeOnce(
        database,
        c.get("userId"),
        key,
        { route: "fast/stop", body },
        async (sql) => {
          const row = (await readRows(sql, c.get("userId"))).find(
            (row) =>
              row.kind === "fast" &&
              row.id === body.id &&
              row.revision === body.revision &&
              row.data.endTimestampMs === null,
          );
          if (!row)
            throw new AppError(
              409,
              "CONFLICT",
              "The active fast changed. Reload and review it.",
            );
          await applyOperations(sql, c.get("userId"), [
            {
              action: "put",
              row: {
                ...row,
                data: { ...row.data, endTimestampMs: Date.now() },
              },
            },
          ]);
        },
      ),
    );
  });
  app.get("/api/v1/export", async (c) => {
    c.header(
      "Content-Disposition",
      'attachment; filename="spartacus-export.json"',
    );
    return c.json({
      format: "spartacus",
      version: 1,
      exportedAt: new Date().toISOString(),
      data: { rows: await readSnapshot(database, c.get("userId")) },
    });
  });
  app.post("/api/v1/import/preview", async (c) => {
    const body = importSchema.parse(await c.req.json());
    const { rows: _rows, ...preview } = prepareImport(body.file, body.timezone);
    return c.json({ ...preview, fingerprint: fingerprint(body) });
  });
  app.post("/api/v1/import", async (c) => {
    const body = importSchema.parse(await c.req.json());
    const key = z.uuid().parse(c.req.header("idempotency-key"));
    const preview = prepareImport(body.file, body.timezone);
    if (preview.issues.length)
      throw new AppError(400, "INVALID_IMPORT", preview.issues.join("\n"));
    return c.json(
      await writeOnce(
        database,
        c.get("userId"),
        key,
        { route: "import", body },
        async (sql) => {
          const hash = fingerprint(body);
          const [prior] =
            await sql`SELECT fingerprint FROM data_imports WHERE user_id=${c.get("userId")}`;
          if (prior?.fingerprint === hash) return;
          if (prior || (await readRows(sql, c.get("userId"))).length)
            throw new AppError(
              409,
              "IMPORT_NOT_EMPTY",
              "Import requires an empty tracker account. Existing records have not been changed.",
            );
          await applyOperations(
            sql,
            c.get("userId"),
            preview.rows.map((row) => ({ action: "put", row })),
          );
          await sql`INSERT INTO data_imports (user_id,fingerprint) VALUES (${c.get("userId")},${hash})`;
        },
      ),
    );
  });
  app.notFound((c) =>
    c.json({ error: { code: "NOT_FOUND", message: "Not found" } }, 404),
  );
  app.onError((error, c) => {
    if (error instanceof z.ZodError)
      return c.json(
        {
          error: {
            code: "VALIDATION",
            message: error.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join("; "),
          },
        },
        400,
      );
    if (error instanceof JsonDepthError)
      return c.json(
        { error: { code: "VALIDATION", message: error.message } },
        400,
      );
    if (error instanceof SyntaxError)
      return c.json(
        { error: { code: "INVALID_JSON", message: "Invalid JSON" } },
        400,
      );
    if (error instanceof AppError)
      return c.json(
        { error: { code: error.code, message: error.message } },
        error.status as 400,
      );
    if ("code" in error && error.code === "23505")
      return c.json(
        {
          error: {
            code: "CONFLICT",
            message:
              "A conflicting record already exists. Reload and review your changes.",
          },
        },
        409,
      );
    console.error(
      JSON.stringify({
        requestId: c.get("requestId"),
        event: "request_failed",
        code: "code" in error ? error.code : "INTERNAL",
      }),
    );
    return c.json(
      {
        error: {
          code: "UNAVAILABLE",
          message:
            "The service could not complete this request. Your changes have not been confirmed. Retry when connected.",
        },
      },
      503,
    );
  });
  return { app, auth };
}
