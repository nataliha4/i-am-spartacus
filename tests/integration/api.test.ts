import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { connect } from "../../src/db/connection";
import { createOperatorAuth } from "../../src/server/operator-auth";
import { createApp } from "../../src/server/app";
import { migrateDatabase } from "../../scripts/migrate";
import type { Row, Snapshot } from "../../src/shared/model";
import { legacyFixture } from "../fixtures/legacy";

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error(
    "Set TEST_DATABASE_URL to a disposable PostgreSQL database whose name ends in _test",
  );
process.env.NODE_ENV = "test";
process.env.BETTER_AUTH_URL = "http://localhost:5173";
process.env.BETTER_AUTH_SECRET =
  "integration-tests-only-secret-at-least-32-characters";
const database = connect(url);
const { app } = createApp(database);
const operator = createOperatorAuth(database);
const users: string[] = [];
let cookieA = "",
  cookieB = "";
async function account() {
  const email = `${crypto.randomUUID()}@example.test`;
  const { user } = await operator.api.createUser({
    body: { email, name: "Test person", password: "test-password-12345" },
  });
  users.push(user.id);
  const result = await app.request(
    "/api/auth/sign-in/email",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:5173",
      },
      body: JSON.stringify({ email, password: "test-password-12345" }),
    },
    { clientIP: `192.0.2.${users.length}` },
  );
  expect(result.status).toBe(200);
  return result.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}
async function request(
  path: string,
  cookie: string,
  body?: unknown,
  key = crypto.randomUUID(),
  origin = "http://localhost:5173",
) {
  return app.request(
    `/api/v1${path}`,
    {
      method: body === undefined ? "GET" : "POST",
      headers: {
        cookie,
        origin,
        "content-type": "application/json",
        "idempotency-key": key,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    { clientIP: "192.0.2.100" },
  );
}
function food(): Row {
  return {
    id: crypto.randomUUID(),
    kind: "entry",
    date: "2026-09-12",
    category: "food",
    revision: 0,
    data: { note: "Lunch", time: "12:00" },
  };
}
beforeAll(async () => {
  await migrateDatabase(url);
  cookieA = await account();
  cookieB = await account();
});
afterAll(async () => {
  for (const id of users)
    await database.client`DELETE FROM auth_user WHERE id=${id}`;
  await database.client.end();
});
describe("authenticated PostgreSQL API", () => {
  test("authentication, origin protection, and public signup/admin restrictions", async () => {
    expect((await request("/state", "")).status).toBe(401);
    expect(
      (
        await request(
          "/commit",
          cookieA,
          { operations: [{ action: "put", row: food() }] },
          crypto.randomUUID(),
          "https://evil.example",
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await app.request(
          "/api/auth/sign-up/email",
          { method: "POST" },
          { clientIP: "192.0.2.100" },
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await app.request(
          "/api/auth/admin/create-user",
          { method: "POST" },
          { clientIP: "192.0.2.100" },
        )
      ).status,
    ).toBe(404);
  });
  test("row ownership, revisions and idempotent retries", async () => {
    const row = food(),
      body = { operations: [{ action: "put", row }] },
      key = crypto.randomUUID();
    const saved = await request("/commit", cookieA, body, key);
    expect(saved.status).toBe(200);
    expect(saved.headers.get("cache-control")).toBe("no-store");
    const snapshot = (await saved.json()) as Snapshot;
    expect(snapshot.rows.find((r) => r.id === row.id)?.revision).toBe(1);
    expect((await request("/commit", cookieA, body, key)).status).toBe(200);
    expect(
      (
        await request(
          "/commit",
          cookieA,
          { operations: [{ action: "put", row: food() }] },
          key,
        )
      ).status,
    ).toBe(409);
    expect(
      ((await (await request("/state", cookieB)).json()) as Snapshot).rows,
    ).toEqual([]);
    expect(
      (
        await request("/commit", cookieB, {
          operations: [
            { action: "delete", kind: "entry", id: row.id, revision: 1 },
          ],
        })
      ).status,
    ).toBe(409);
    const updated = { ...row, revision: 1, data: { note: "Updated lunch" } };
    const responses = await Promise.all([
      request("/commit", cookieA, {
        operations: [{ action: "put", row: updated }],
      }),
      request("/commit", cookieA, {
        operations: [{ action: "put", row: updated }],
      }),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
  });
  test("a batch rolls back when any revision conflicts", async () => {
    const row = food();
    expect(
      (
        await request("/commit", cookieA, {
          operations: [
            { action: "put", row },
            {
              action: "delete",
              kind: "entry",
              id: crypto.randomUUID(),
              revision: 9,
            },
          ],
        })
      ).status,
    ).toBe(409);
    expect(
      ((await (await request("/state", cookieA)).json()) as Snapshot).rows.some(
        (r) => r.id === row.id,
      ),
    ).toBe(false);
  });
  test("simultaneous fast starts/stops are safe and retriable", async () => {
    const starts = await Promise.all([
      request("/fast/start", cookieA, { timezone: "America/New_York" }),
      request("/fast/start", cookieA, { timezone: "America/New_York" }),
    ]);
    expect(starts.map((r) => r.status).sort()).toEqual([200, 409]);
    const state = (await (await request("/state", cookieA)).json()) as Snapshot;
    const fast = state.rows.find(
      (r) => r.kind === "fast" && r.data.endTimestampMs === null,
    )!;
    const body = { id: fast.id, revision: fast.revision },
      key = crypto.randomUUID();
    expect((await request("/fast/stop", cookieB, body)).status).toBe(409);
    expect((await request("/fast/stop", cookieA, body, key)).status).toBe(200);
    expect((await request("/fast/stop", cookieA, body, key)).status).toBe(200);
    expect((await request("/fast/stop", cookieA, body)).status).toBe(409);
  });
  test("simultaneous checklist completion creates only one associated log", async () => {
    const schedule: Row = {
      id: crypto.randomUUID(),
      kind: "schedule",
      date: null,
      category: "supplements",
      revision: 0,
      data: { name: "Daily supplement", time: "08:00", frequency: "daily" },
    };
    expect(
      (
        await request("/commit", cookieA, {
          operations: [{ action: "put", row: schedule }],
        })
      ).status,
    ).toBe(200);
    const complete = () =>
      request("/commit", cookieA, {
        operations: [
          {
            action: "put",
            row: {
              id: crypto.randomUUID(),
              kind: "entry",
              date: "2026-09-12",
              category: "supplements",
              revision: 0,
              data: { name: "Concurrent checklist log", time: "08:00" },
            },
          },
          {
            action: "put",
            row: {
              id: crypto.randomUUID(),
              kind: "checklist",
              date: "2026-09-12",
              category: null,
              revision: 0,
              data: {
                key: `recurring-${schedule.id}`,
                done: true,
                failed: false,
              },
            },
          },
        ],
      });
    expect(
      (await Promise.all([complete(), complete()])).map((r) => r.status).sort(),
    ).toEqual([200, 409]);
    const rows = ((await (await request("/state", cookieA)).json()) as Snapshot)
      .rows;
    expect(
      rows.filter((row) => row.data.name === "Concurrent checklist log"),
    ).toHaveLength(1);
    const markerCookie = await account();
    expect(
      (
        await request("/commit", markerCookie, {
          operations: [
            {
              action: "put",
              row: {
                id: crypto.randomUUID(),
                kind: "checklist",
                date: "2026-09-12",
                category: null,
                revision: 0,
                data: {
                  key: `recurring-${schedule.id}`,
                  done: true,
                  failed: false,
                },
              },
            },
          ],
        })
      ).status,
    ).toBe(200);
  });
  test("operator reset revokes sessions and uses the new password", async () => {
    const email = `${crypto.randomUUID()}@example.test`;
    const { user } = await operator.api.createUser({
      body: { email, name: "Reset test", password: "original-password-123" },
    });
    users.push(user.id);
    const signedIn = await operator.api.signInEmail({
      body: { email, password: "original-password-123" },
      asResponse: true,
    });
    const cookie = signedIn.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    expect((await request("/state", cookie)).status).toBe(200);
    let token: string | undefined;
    const resetAuth = createOperatorAuth(database, {
      onResetToken: (value) => {
        token = value;
      },
    });
    await resetAuth.api.requestPasswordReset({ body: { email } });
    expect(token).toBeDefined();
    await resetAuth.api.resetPassword({
      body: { token: token!, newPassword: "replacement-password-123" },
    });
    expect((await request("/state", cookie)).status).toBe(401);
    const newSession = await operator.api.signInEmail({
      body: { email, password: "replacement-password-123" },
      asResponse: true,
    });
    expect(newSession.status).toBe(200);
  });
  test("preview, atomic import, duplicate import and new export", async () => {
    const body = { file: legacyFixture, timezone: "America/New_York" };
    const preview = await request("/import/preview", cookieB, body);
    expect(preview.status).toBe(200);
    expect((await preview.json()).issues).toEqual([]);
    const invalid = structuredClone(legacyFixture);
    invalid.data.trackerData["2026-09-12"].symptoms[0].level = 99;
    expect(
      (await request("/import", cookieB, { ...body, file: invalid })).status,
    ).toBe(400);
    expect(
      ((await (await request("/state", cookieB)).json()) as Snapshot).rows,
    ).toEqual([]);
    const imported = await request("/import", cookieB, body);
    expect(imported.status).toBe(200);
    const count = ((await imported.json()) as Snapshot).rows.length;
    expect(
      ((await (await request("/import", cookieB, body)).json()) as Snapshot)
        .rows,
    ).toHaveLength(count);
    expect((await request("/import", cookieA, body)).status).toBe(409);
    const exported = await (await request("/export", cookieB)).json();
    expect(exported.format).toBe("spartacus");
    expect(exported.data.rows).toHaveLength(count);
    expect(JSON.stringify(exported)).not.toContain("userId");
  });
  test("migration status and simultaneous runners are repeatable", async () => {
    const results = await Promise.all([
      migrateDatabase(url),
      migrateDatabase(url),
    ]);
    expect(results.every((r) => r.pending === 0)).toBe(true);
    expect((await migrateDatabase(url, "status")).pending).toBe(0);
  });
});
