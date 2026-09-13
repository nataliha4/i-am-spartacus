import { afterAll, beforeAll, expect, test } from "bun:test";
import { connect } from "../../src/db/connection";
import { createApp } from "../../src/server/app";
import { createOperatorAuth } from "../../src/server/operator-auth";
import { consumeBudget } from "../../src/server/rate-limits";
import { pruneExpired } from "../../src/server/maintenance";
import { migrateDatabase } from "../../scripts/migrate";
import { defaults, type Row, type Snapshot } from "../../src/shared/model";
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error("Disposable TEST_DATABASE_URL ending in _test is required");
process.env.NODE_ENV = "test";
process.env.BETTER_AUTH_URL = "http://localhost:5173";
process.env.BETTER_AUTH_SECRET =
  "security-tests-only-secret-at-least-32-characters";
const database = connect(url);
const { app, auth } = createApp(database);
const operator = createOperatorAuth(database);
const users: string[] = [];
const bucketKeys: string[] = [];
async function account() {
  const email = `${crypto.randomUUID()}@example.test`;
  const { user } = await operator.api.createUser({
    body: { email, name: "Security test", password: "security-test-password" },
  });
  users.push(user.id);
  const response = await operator.api.signInEmail({
    body: { email, password: "security-test-password" },
    asResponse: true,
  });
  const cookie = response.headers
    .getSetCookie()
    .map((s) => s.split(";")[0])
    .join("; ");
  const session = (await auth.api.getSession({
    headers: new Headers({ cookie }),
  }))!;
  bucketKeys.push(`session:${session.session.id}`, `transfer:${user.id}`);
  return { userId: user.id, sessionId: session.session.id, cookie };
}
function request(
  path: string,
  cookie: string,
  body?: unknown,
  clientIP = "203.0.113.100",
) {
  return app.request(
    `/api/v1${path}`,
    {
      method: body === undefined ? "GET" : "POST",
      headers: {
        cookie,
        origin: "http://localhost:5173",
        "content-type": "application/json",
        "idempotency-key": crypto.randomUUID(),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    { clientIP },
  );
}
function row(
  kind: Row["kind"],
  data: Row["data"],
  date: string | null = null,
  category: string | null = null,
): Row {
  return { id: crypto.randomUUID(), kind, data, date, category, revision: 0 };
}
beforeAll(() => migrateDatabase(url));
afterAll(async () => {
  for (const id of users)
    await database.client`DELETE FROM auth_user WHERE id=${id}`;
  for (const key of bucketKeys)
    await database.client`DELETE FROM request_buckets WHERE key=${key}`;
  await database.client.end();
});

test("web auth has no admin API, and raw client-IP headers cannot establish trust", async () => {
  expect("createUser" in auth.api).toBe(false);
  expect("createUser" in operator.api).toBe(true);
  expect(
    (
      await app.request("/api/auth/get-session", {
        headers: {
          "x-internal-client-ip": "1.2.3.4",
          "x-spartacus-client-ip": "1.2.3.4",
          "x-forwarded-for": "1.2.3.4",
        },
      })
    ).status,
  ).toBe(400);
  const clientIP = "192.0.2.222";
  await database.client`DELETE FROM auth_rate_limit WHERE key LIKE ${`${clientIP}|%`}`;
  // Rotating every attacker-controlled header still shares the socket-bound bucket.
  for (let i = 0; i < 11; i++) {
    const response = await app.request(
      "/api/auth/sign-in/email",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:5173",
          "x-forwarded-for": `198.51.100.${i}`,
          "x-internal-client-ip": `198.51.100.${i}`,
          "x-spartacus-client-ip": `198.51.100.${i}`,
        },
        body: JSON.stringify({
          email: "missing@example.test",
          password: "invalid-password-123",
        }),
      },
      { clientIP: "203.0.113.100" },
    );
    expect(response.status).toBe(i < 10 ? 401 : 429);
  }
  await database.client`DELETE FROM auth_rate_limit WHERE key LIKE ${`${clientIP}|%`}`;
});

test("deep import JSON and non-UUID checklist references return 400", async () => {
  const { cookie } = await account();
  const deep = await app.request(
    "/api/v1/import/preview",
    {
      method: "POST",
      headers: {
        cookie,
        origin: "http://localhost:5173",
        "content-type": "application/json",
      },
      body:
        '{"file":' +
        "[".repeat(5000) +
        "0" +
        "]".repeat(5000) +
        ',"timezone":"UTC"}',
    },
    { clientIP: "203.0.113.100" },
  );
  expect(deep.status).toBe(400);
  expect((await deep.json()).error.code).toBe("VALIDATION");
  const invalid = row(
    "checklist",
    { key: `logged-${"-".repeat(36)}`, done: true, failed: false },
    "2026-09-12",
  );
  expect(
    (
      await request("/commit", cookie, {
        operations: [{ action: "put", row: invalid }],
      })
    ).status,
  ).toBe(400);
});

test("identical IDs in different accounts have independent records and checklist namespaces", async () => {
  const a = await account(),
    b = await account();
  const entry = row("entry", { note: "A lunch" }, "2026-09-12", "food");
  const rows = [
    entry,
    row(
      "schedule",
      { name: "Daily", time: "08:00", frequency: "daily" },
      null,
      "gym",
    ),
    row("settings", defaults),
    row("fast", {
      startTimestampMs: 1000,
      endTimestampMs: null,
      timezone: "UTC",
    }),
    row(
      "checklist",
      { key: `logged-${entry.id}`, done: true, failed: false },
      "2026-09-12",
    ),
  ];
  const operations = rows.map((row) => ({ action: "put", row }));
  expect((await request("/commit", a.cookie, { operations })).status).toBe(200);
  expect((await request("/commit", b.cookie, { operations })).status).toBe(200);
  expect(
    (
      await request("/commit", b.cookie, {
        operations: [
          {
            action: "put",
            row: { ...entry, revision: 1, data: { note: "B lunch" } },
          },
        ],
      })
    ).status,
  ).toBe(200);
  const state = (await (await request("/state", a.cookie)).json()) as Snapshot;
  expect(state.rows.find((r) => r.id === entry.id)?.data.note).toBe("A lunch");
  const missing = row(
    "checklist",
    { key: `logged-${crypto.randomUUID()}`, done: true, failed: false },
    "2026-09-12",
  );
  expect(
    (
      await request("/commit", b.cookie, {
        operations: [{ action: "put", row: missing }],
      })
    ).status,
  ).toBe(200);
});

test("SQL-filtered day/history reads keep date, category, active fast and tenant semantics", async () => {
  const { cookie } = await account();
  const rows = [
    row("entry", { note: "Yesterday" }, "2026-09-11", "food"),
    row("entry", { note: "Today" }, "2026-09-12", "food"),
    row("entry", { activity: "Walk" }, "2026-09-12", "gym"),
    row("settings", defaults),
    row(
      "schedule",
      { name: "Daily", time: "08:00", frequency: "daily" },
      null,
      "gym",
    ),
    row("fast", {
      startTimestampMs: 1000,
      endTimestampMs: null,
      timezone: "UTC",
    }),
  ];
  expect(
    (
      await request("/commit", cookie, {
        operations: rows.map((row) => ({ action: "put", row })),
      })
    ).status,
  ).toBe(200);
  const history = (await (
    await request(
      "/history?from=2026-09-12&to=2026-09-12&category=food",
      cookie,
    )
  ).json()) as Snapshot;
  expect(history.rows.map((row) => row.id)).toEqual([rows[1].id]);
  const day = (await (
    await request("/days/2026-09-12", cookie)
  ).json()) as Snapshot;
  expect(day.rows.map((row) => row.id).sort()).toEqual(
    rows
      .slice(1)
      .map((row) => row.id)
      .sort(),
  );
  expect(
    (await request("/history?from=2026-09-13&to=2026-09-12", cookie)).status,
  ).toBe(400);
});

test("database budgets are atomic across connections, expire, and enforce session/transfer limits", async () => {
  const key = `test:${crypto.randomUUID()}`;
  bucketKeys.push(key);
  const other = connect(url, 2);
  try {
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        consumeBudget(i % 2 ? database : other, key, 5),
      ),
    );
    expect(results.filter(Boolean)).toHaveLength(5);
    await database.client`UPDATE request_buckets SET expires_at=now()-interval '1 second' WHERE key=${key}`;
    expect(await consumeBudget(database, key, 5)).toBe(true);
  } finally {
    await other.client.end();
  }
  const a = await account(),
    b = await account();
  await database.client`INSERT INTO request_buckets (key,count,expires_at) VALUES (${`session:${a.sessionId}`},120,now()+interval '1 minute')`;
  const limited = await request("/state", a.cookie);
  expect(limited.status).toBe(429);
  expect(limited.headers.get("retry-after")).toBe("60");
  expect((await request("/state", b.cookie)).status).toBe(200);
  await database.client`INSERT INTO request_buckets (key,count,expires_at) VALUES (${`transfer:${b.userId}`},10,now()+interval '1 minute') ON CONFLICT (key) DO UPDATE SET count=10`;
  expect((await request("/export", b.cookie)).status).toBe(429);
});

test("maintenance prunes expired receipts and untouched rate keys while preserving active ones", async () => {
  const a = await account();
  const oldKey = crypto.randomUUID(),
    newKey = crypto.randomUUID();
  await database.client`INSERT INTO mutation_receipts (user_id,key,hash,created_at) VALUES (${a.userId},${oldKey},'old',now()-interval '8 days'), (${a.userId},${newKey},'new',now())`;
  const oldAuth = crypto.randomUUID(),
    newAuth = crypto.randomUUID();
  await database.client`INSERT INTO auth_rate_limit (id,key,count,last_request) VALUES (${oldAuth},${oldAuth},1,${Date.now() - 7200000}), (${newAuth},${newAuth},1,${Date.now()})`;
  const oldApi = `test:${crypto.randomUUID()}`,
    newApi = `test:${crypto.randomUUID()}`;
  bucketKeys.push(oldApi, newApi);
  await database.client`INSERT INTO request_buckets (key,count,expires_at) VALUES (${oldApi},1,now()-interval '2 hours'), (${newApi},1,now()+interval '1 minute')`;
  const results = await pruneExpired(database);
  expect(results.receipts).toBeGreaterThanOrEqual(1);
  expect(results.authLimits).toBeGreaterThanOrEqual(1);
  expect(results.apiLimits).toBeGreaterThanOrEqual(1);
  expect(
    (
      await database.client`SELECT key FROM mutation_receipts WHERE user_id=${a.userId}`
    ).map((r) => r.key),
  ).toEqual([newKey]);
  expect(
    await database.client`SELECT id FROM auth_rate_limit WHERE id=${oldAuth}`,
  ).toHaveLength(0);
  expect(
    await database.client`SELECT id FROM auth_rate_limit WHERE id=${newAuth}`,
  ).toHaveLength(1);
  expect(
    await database.client`SELECT key FROM request_buckets WHERE key=${newApi}`,
  ).toHaveLength(1);
  await database.client`DELETE FROM auth_rate_limit WHERE id=${newAuth}`;
});

test("HTTPS API responses include security headers, including errors", async () => {
  const previous = process.env.BETTER_AUTH_URL;
  process.env.BETTER_AUTH_URL = "https://tracker.example";
  try {
    const response = await app.request(
      "/api/v1/state",
      {},
      { clientIP: "203.0.113.100" },
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("strict-transport-security")).toBe(
      "max-age=31536000",
    );
    expect(response.headers.get("referrer-policy")).toBe("same-origin");
  } finally {
    process.env.BETTER_AUTH_URL = previous;
  }
});

test("concurrent public readiness probes issue only one database query", async () => {
  let queries = 0;
  const client = new Proxy(database.client, {
    apply(target, self, args) {
      queries++;
      return Reflect.apply(target, self, args);
    },
  });
  const { app: healthApp } = createApp({ ...database, client });
  const results = await Promise.all(
    Array.from({ length: 100 }, () => healthApp.request("/health/ready")),
  );
  expect(results.every((response) => response.status === 200)).toBe(true);
  expect(queries).toBe(1);
  expect((await healthApp.request("/health/live")).status).toBe(200);
  expect(queries).toBe(1);
});

test("an already throttled IP cannot drain the shared admission budget", async () => {
  const { app: isolated } = createApp(database);
  for (let i = 0; i < 1300; i++) {
    const response = await isolated.request(
      "/api/auth/not-a-route",
      {},
      { clientIP: "198.51.100.201" },
    );
    expect(response.status).toBe(i < 120 ? 404 : 429);
  }
  expect(
    (
      await isolated.request(
        "/api/auth/not-a-route",
        {},
        { clientIP: "198.51.100.202" },
      )
    ).status,
  ).toBe(404);
});

test("large exports roundtrip at the row and payload quota boundaries", async () => {
  for (const count of [40000, 50000]) {
    const source = await account();
    const target = await account();
    const ip = count === 40000 ? "192.0.2.201" : "192.0.2.202";
    bucketKeys.push(`transfer-ip:${ip}`);
    // Near the 5 MiB JSONB-data quota at 50,000 records, with all row metadata exported.
    await database.client`INSERT INTO tracking_entries (id,user_id,date,category,data)
      SELECT gen_random_uuid(), ${source.userId}, '2026-09-12', 'food',
      jsonb_build_object('note',repeat('x',${count === 50000 ? 90 : 5})) FROM generate_series(1,${count})`;
    const exported = await request("/export", source.cookie, undefined, ip);
    expect(exported.status).toBe(200);
    const file = await exported.json();
    expect(Buffer.byteLength(JSON.stringify(file))).toBeGreaterThan(
      4 * 1024 * 1024,
    );
    expect(
      Buffer.byteLength(JSON.stringify({ file, timezone: "UTC" })),
    ).toBeLessThan(16 * 1024 * 1024);
    const preview = await request(
      "/import/preview",
      target.cookie,
      { file, timezone: "UTC" },
      ip,
    );
    expect(preview.status).toBe(200);
    expect((await preview.json()).issues).toEqual([]);
    const imported = await request(
      "/import",
      target.cookie,
      { file, timezone: "UTC" },
      ip,
    );
    expect(imported.status).toBe(200);
    expect(((await imported.json()) as Snapshot).rows).toHaveLength(count);
    const [usage] =
      await database.client`SELECT row_count,data_bytes FROM tracker_usage WHERE user_id=${target.userId}`;
    expect(Number(usage.row_count)).toBe(count);
    expect(Number(usage.data_bytes)).toBeLessThanOrEqual(5 * 1024 * 1024);
  }
}, 30000);

test("authenticated imports have bounded bodies and per-account concurrency", async () => {
  const owner = await account();
  const ip = "192.0.2.203";
  bucketKeys.push(`transfer-ip:${ip}`);
  const abort = new AbortController();
  const first = app.request(
    "/api/v1/import/preview",
    {
      method: "POST",
      signal: abort.signal,
      headers: {
        cookie: owner.cookie,
        origin: "http://localhost:5173",
        "content-type": "application/json",
      },
      body: new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode("{"));
        },
      }),
    },
    { clientIP: ip },
  );
  // Wait until session authentication has consumed its budget before probing again.
  for (let i = 0; i < 100; i++) {
    const [bucket] =
      await database.client`SELECT key FROM request_buckets WHERE key=${`transfer:${owner.userId}`}`;
    if (bucket) break;
    await Bun.sleep(5);
  }
  await Bun.sleep(10);
  try {
    expect(
      (
        await request(
          "/import/preview",
          owner.cookie,
          { file: {}, timezone: "UTC" },
          ip,
        )
      ).status,
    ).toBe(429);
  } finally {
    abort.abort();
  }
  expect((await first).status).toBe(408);
  expect(
    (
      await request(
        "/import/preview",
        owner.cookie,
        { file: {}, timezone: "UTC" },
        ip,
      )
    ).status,
  ).toBe(200);
  expect(
    (
      await request(
        "/import/preview",
        owner.cookie,
        { file: "x".repeat(16 * 1024 * 1024), timezone: "UTC" },
        ip,
      )
    ).status,
  ).toBe(413);
  expect(
    (
      await request(
        "/commit",
        owner.cookie,
        { padding: "x".repeat(4 * 1024 * 1024) },
        ip,
      )
    ).status,
  ).toBe(413);
});

test("unauthenticated body reads cannot starve authenticated writes", async () => {
  const isolated = createApp(database).app;
  const { cookie } = await account();
  const controllers: ReadableStreamDefaultController<Uint8Array>[] = [];
  const signIn = (clientIP: string, body: BodyInit) =>
    isolated.request(
      "/api/auth/sign-in/email",
      {
        method: "POST",
        headers: {
          origin: "http://localhost:5173",
          "content-type": "application/json",
        },
        body,
      },
      { clientIP },
    );
  // Occupy every unauthenticated read slot with bodies that never finish.
  const pending = Array.from({ length: 4 }, (_, i) =>
    signIn(
      i < 2 ? "192.0.2.210" : "192.0.2.211",
      new ReadableStream<Uint8Array>({
        start(c) {
          controllers.push(c);
          c.enqueue(new TextEncoder().encode("{"));
        },
      }),
    ),
  );
  try {
    // Unknown routes are settled before a body is accepted, so a request that
    // can never succeed never occupies capacity.
    const unknown = await isolated.request(
      "/api/auth/not-a-route",
      { method: "POST", body: "{}" },
      { clientIP: "192.0.2.212" },
    );
    expect(unknown.status).toBe(404);
    // Further unauthenticated sign-in bodies are shed, as intended.
    expect((await signIn("192.0.2.213", "{}")).status).toBe(429);
    // A signed-in user's write proceeds on its own reserved capacity.
    const saved = await isolated.request(
      "/api/v1/commit",
      {
        method: "POST",
        headers: {
          cookie,
          origin: "http://localhost:5173",
          "content-type": "application/json",
          "idempotency-key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          operations: [
            {
              action: "put",
              row: row("settings", { ...defaults, timezone: "UTC" }),
            },
          ],
        }),
      },
      { clientIP: "192.0.2.214" },
    );
    expect(saved.status).toBe(200);
  } finally {
    controllers.forEach((c) => c.close());
    await Promise.all(pending);
  }
  // Capacity is released once the unfinished bodies end.
  expect((await signIn("192.0.2.213", "{}")).status).not.toBe(429);
});
