import { afterAll, beforeAll, expect, test } from "bun:test";
import { runWithEndpointContext } from "@better-auth/core/context";
import { handleOAuthUserInfo } from "better-auth/oauth2";
const admitIdentity = (
  endpoint: Parameters<typeof handleOAuthUserInfo>[0],
  info: Parameters<typeof handleOAuthUserInfo>[1],
) =>
  runWithEndpointContext(endpoint, () => handleOAuthUserInfo(endpoint, info));
import { connect } from "../../src/db/connection";
import { createApp } from "../../src/server/app";
import { createOperatorAuth } from "../../src/server/operator-auth";
import { prepareGoogleAccount } from "../../src/server/account-admin";
import { applyOperations, writeOnce, tables } from "../../src/server/store";
import { pruneExpired } from "../../src/server/maintenance";
import { migrateDatabase } from "../../scripts/migrate";
import { defaults, type Row } from "../../src/shared/model";

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error("Disposable TEST_DATABASE_URL ending in _test required");
process.env.NODE_ENV = "test";
process.env.BETTER_AUTH_URL = "http://localhost:5173";
process.env.BETTER_AUTH_SECRET =
  "google-tests-only-secret-at-least-32-characters";
process.env.GOOGLE_CLIENT_ID = "ci-dummy.apps.googleusercontent.com";
process.env.GOOGLE_CLIENT_SECRET = "ci-dummy-never-a-real-secret";
const database = connect(url);
const { app, auth } = createApp(database);
const operator = createOperatorAuth(database);
const users: string[] = [];
let ipCounter = 1;
const nextIP = () => `192.0.2.${ipCounter++}`;
async function account() {
  const email = `${crypto.randomUUID()}@example.test`;
  const { user } = await operator.api.createUser({
    body: { email, name: "Auth test", password: "integration-password-123" },
  });
  users.push(user.id);
  const login = await operator.api.signInEmail({
    body: { email, password: "integration-password-123" },
    asResponse: true,
  });
  const cookie = login.headers
    .getSetCookie()
    .map((s) => s.split(";")[0])
    .join("; ");
  return { user, cookie };
}
function request(
  path: string,
  body?: unknown,
  cookie = "",
  clientIP = nextIP(),
  origin = "http://localhost:5173",
) {
  return app.request(
    path,
    {
      method: body === undefined ? "GET" : "POST",
      headers: {
        cookie,
        origin,
        "content-type": "application/json",
        "idempotency-key": crypto.randomUUID(),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    { clientIP },
  );
}
const entry = (): Row => ({
  id: crypto.randomUUID(),
  kind: "entry",
  revision: 0,
  category: "food",
  date: "2026-09-12",
  data: { note: "Lunch" },
});
beforeAll(async () => {
  await migrateDatabase(url);
  await database.client`DELETE FROM request_buckets WHERE key LIKE 'transfer-ip:192.0.2.%'`;
  await database.client`DELETE FROM auth_rate_limit WHERE key LIKE '192.0.2.%'`;
});
afterAll(async () => {
  for (const id of users)
    await database.client`DELETE FROM auth_user WHERE id=${id}`;
  await database.client.end();
});

test("Google authorization uses minimal scopes, state, PKCE and exact callbacks; other auth routes stay closed", async () => {
  const response = await request("/api/auth/sign-in/social", {
    provider: "google",
    callbackURL: "/",
    errorCallbackURL: "/",
  });
  expect(response.status).toBe(200);
  const redirect = new URL((await response.json()).url);
  expect(redirect.origin).toBe("https://accounts.google.com");
  expect(redirect.searchParams.get("redirect_uri")).toBe(
    "http://localhost:5173/api/auth/callback/google",
  );
  expect(redirect.searchParams.get("scope")?.split(" ").sort()).toEqual([
    "email",
    "openid",
    "profile",
  ]);
  expect(redirect.searchParams.get("prompt")).toBe("select_account");
  expect(redirect.searchParams.get("access_type")).toBe("online");
  expect(redirect.searchParams.get("include_granted_scopes")).not.toBe("true");
  expect(redirect.searchParams.get("code_challenge_method")).toBe("S256");
  expect(redirect.searchParams.get("state")).toBeTruthy();
  expect(response.headers.getSetCookie().join(";")).toContain("HttpOnly");
  expect(response.headers.getSetCookie().join(";")).toContain("SameSite=Lax");
  const state = redirect.searchParams.get("state")!;
  const callback = await request(
    `/api/auth/callback/google?state=${encodeURIComponent(state)}&code=untrusted`,
  );
  expect(callback.status).toBe(302);
  expect(callback.headers.get("location")).toContain("error=");
  for (const path of [
    "/sign-up/email",
    "/admin/create-user",
    "/link-social",
    "/unlink-account",
    "/set-password",
    "/list-accounts",
  ])
    expect((await request(`/api/auth${path}`, {})).status).toBe(404);
  for (const extra of [
    { callbackURL: "https://evil.example" },
    { scopes: ["https://www.googleapis.com/auth/drive"] },
    { provider: "github" },
    { idToken: { token: "forged" } },
  ])
    expect(
      (
        await request("/api/auth/sign-in/social", {
          provider: "google",
          callbackURL: "/",
          ...extra,
        })
      ).status,
    ).toBe(400);
  expect(
    (
      await request(
        "/api/auth/sign-in/social",
        { provider: "google", callbackURL: "/" },
        "",
        nextIP(),
        "https://evil.example",
      )
    ).status,
  ).toBe(403);
});

test("unverified local email collisions fail closed; vetted transition removes passwords before linking", async () => {
  const { user, cookie } = await account();
  const context = await auth.$context;
  // Exercise Better Auth's post-verification linking seam, not a fake OIDC
  // server. The browser test above independently checks state-cookie rejection.
  const endpoint = {
    context,
    headers: new Headers(),
    request: new Request("http://localhost:5173/api/auth/callback/google"),
  } as Parameters<typeof handleOAuthUserInfo>[0];
  const info = {
    userInfo: {
      id: "google-sub-" + crypto.randomUUID(),
      name: "Google user",
      email: user.email,
      emailVerified: true,
    },
    account: {
      providerId: "google",
      accountId: "google-sub-" + crypto.randomUUID(),
      accessToken: "discard-access",
      refreshToken: "discard-refresh",
      idToken: "discard-id",
    },
  };
  const denied = await admitIdentity(endpoint, info);
  expect(denied.error).toBe("account not linked");
  expect(
    await database.client`SELECT id FROM auth_account WHERE user_id=${user.id} AND provider_id='google'`,
  ).toHaveLength(0);
  await prepareGoogleAccount(database, user.email);
  expect((await request("/api/v1/state", undefined, cookie)).status).toBe(401);
  expect(
    await database.client`SELECT id FROM auth_account WHERE user_id=${user.id} AND provider_id='credential'`,
  ).toHaveLength(0);
  const linked = await admitIdentity(endpoint, info);
  expect(linked.error).toBeNull();
  expect(linked.data?.user.id).toBe(user.id);
  const [stored] =
    await database.client`SELECT account_id,access_token,refresh_token,id_token FROM auth_account WHERE user_id=${user.id}`;
  expect(stored.account_id).toBe(info.account.accountId);
  expect([stored.access_token, stored.refresh_token, stored.id_token]).toEqual([
    null,
    null,
    null,
  ]);
  await context.internalAdapter.updateAccount(
    (await context.internalAdapter.findAccounts(user.id))[0].id,
    {
      accessToken: "new-access",
      refreshToken: "new-refresh",
      idToken: "new-id",
    },
  );
  const [updated] =
    await database.client`SELECT access_token,refresh_token,id_token FROM auth_account WHERE user_id=${user.id}`;
  expect(Object.values(updated)).toEqual([null, null, null]);
});

test("registration capacity is atomic across connections and deletion releases a slot", async () => {
  const other = connect(url!, 2);
  const [before] =
    await database.client`SELECT * FROM registration_capacity WHERE id=1`;
  const ids = Array.from({ length: 8 }, () => crypto.randomUUID());
  users.push(...ids);
  try {
    await database.client`UPDATE registration_capacity SET max_users=registered_users+2 WHERE id=1`;
    const results = await Promise.allSettled(
      ids.map(
        (id, i) =>
          (i % 2 ? database : other)
            .client`INSERT INTO auth_user (id,name,email) VALUES (${id},'Capacity',${id + "@example.test"})`,
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
    const [registered] =
      await database.client`SELECT registered_users FROM registration_capacity WHERE id=1`;
    expect(registered.registered_users).toBe(before.registered_users + 2);
    const [victim] =
      await database.client`SELECT id FROM auth_user WHERE id IN ${database.client(ids)}`;
    await database.client`DELETE FROM auth_user WHERE id=${victim.id}`;
    const replacement = crypto.randomUUID();
    users.push(replacement);
    await database.client`INSERT INTO auth_user (id,name,email) VALUES (${replacement},'Replacement',${replacement + "@example.test"})`;
  } finally {
    for (const id of ids)
      await database.client`DELETE FROM auth_user WHERE id=${id}`;
    await database.client`UPDATE registration_capacity SET max_users=${before.max_users} WHERE id=1`;
    await other.client.end();
  }
});

test("row and byte quotas reject concurrent writes atomically, roll back receipts and release space", async () => {
  const { user } = await account();
  // Seed near each real production boundary without 50,000 HTTP requests.
  await database.client`INSERT INTO tracking_entries (id,user_id,date,category,data)
    SELECT gen_random_uuid(),${user.id},'2026-09-12','food','{}'::jsonb FROM generate_series(1,49999)`;
  const write = (row: Row) =>
    writeOnce(database, user.id, crypto.randomUUID(), row, (sql) =>
      applyOperations(sql, user.id, [{ action: "put", row }]),
    );
  const attempts = await Promise.allSettled([write(entry()), write(entry())]);
  expect(attempts.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  const failure = attempts.find(
    (r) => r.status === "rejected",
  ) as PromiseRejectedResult;
  expect(failure.reason.code).toBe("STORAGE_LIMIT");
  expect(
    (
      await database.client`SELECT row_count FROM tracker_usage WHERE user_id=${user.id}`
    )[0].row_count,
  ).toBe(50000);
  expect(
    await database.client`SELECT key FROM mutation_receipts WHERE user_id=${user.id}`,
  ).toHaveLength(1);
  await database.client`DELETE FROM tracking_entries WHERE user_id=${user.id}`;
  // JSONB accounting measures UTF-8 bytes, not JavaScript character count.
  await database.client`INSERT INTO tracking_entries (id,user_id,date,category,data) VALUES (gen_random_uuid(),${user.id},'2026-09-12','food',jsonb_build_object('note',repeat('é',2621433)))`;
  const response = await request(
    "/api/v1/commit",
    { operations: [{ action: "put", row: entry() }] },
    (
      await operator.api.signInEmail({
        body: { email: user.email, password: "integration-password-123" },
        asResponse: true,
      })
    ).headers
      .getSetCookie()
      .map((s) => s.split(";")[0])
      .join("; "),
  );
  expect(response.status).toBe(413);
  expect((await response.json()).error.code).toBe("STORAGE_LIMIT");
  await database.client`DELETE FROM tracking_entries WHERE user_id=${user.id}`;
  await write(entry());
  expect(
    (
      await database.client`SELECT row_count FROM tracker_usage WHERE user_id=${user.id}`
    )[0].row_count,
  ).toBe(1);
});

test("own-account deletion requires origin, confirmation and a fresh session, and cascades every owned table", async () => {
  const a = await account(),
    b = await account();
  const rows: Row[] = [
    entry(),
    {
      ...entry(),
      kind: "schedule",
      date: null,
      category: "gym",
      data: { name: "Daily", time: "08:00", frequency: "daily" },
    },
    {
      ...entry(),
      kind: "checklist",
      category: null,
      data: { key: "logged-" + crypto.randomUUID(), done: true, failed: false },
    },
    {
      ...entry(),
      kind: "settings",
      date: null,
      category: null,
      data: defaults,
    },
    {
      ...entry(),
      kind: "fast",
      date: null,
      category: null,
      data: { startTimestampMs: 1000, endTimestampMs: null, timezone: "UTC" },
    },
  ];
  expect(
    (
      await request(
        "/api/v1/commit",
        { operations: rows.map((row) => ({ action: "put", row })) },
        a.cookie,
      )
    ).status,
  ).toBe(200);
  await database.client`INSERT INTO data_imports (user_id,fingerprint) VALUES (${a.user.id},'deletion-test')`;
  const pendingReset = crypto.randomUUID();
  await database.client`INSERT INTO auth_verification (id,identifier,value,expires_at) VALUES (${pendingReset},'reset-password:pending',${a.user.id},now()+interval '1 hour')`;
  expect(
    (
      await request(
        "/api/v1/account/delete",
        { confirmation: "DELETE", userId: b.user.id },
        a.cookie,
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await request(
        "/api/v1/account/delete",
        { confirmation: "DELETE" },
        a.cookie,
        nextIP(),
        "https://evil.example",
      )
    ).status,
  ).toBe(403);
  await database.client`UPDATE auth_session SET created_at=now()-interval '11 minutes' WHERE user_id=${a.user.id}`;
  expect(
    (
      await request(
        "/api/v1/account/delete",
        { confirmation: "DELETE" },
        a.cookie,
      )
    ).status,
  ).toBe(403);
  await database.client`UPDATE auth_session SET created_at=now() WHERE user_id=${a.user.id}`;
  const removed = await request(
    "/api/v1/account/delete",
    { confirmation: "DELETE" },
    a.cookie,
  );
  expect(removed.status).toBe(200);
  for (const table of [
    ...Object.values(tables),
    "auth_account",
    "auth_session",
    "mutation_receipts",
    "data_imports",
    "tracker_usage",
  ])
    expect(
      await database.client`SELECT user_id FROM ${database.client(table)} WHERE user_id=${a.user.id}`,
    ).toHaveLength(0);
  expect(
    await database.client`SELECT id FROM auth_user WHERE id=${a.user.id}`,
  ).toHaveLength(0);
  expect(
    await database.client`SELECT id FROM auth_verification WHERE id=${pendingReset}`,
  ).toHaveLength(0);
  expect((await request("/api/v1/state", undefined, a.cookie)).status).toBe(
    401,
  );
  expect((await request("/api/v1/state", undefined, b.cookie)).status).toBe(
    200,
  );
});

test("expensive requests share an IP budget across accounts and OAuth/session state is pruned", async () => {
  const a = await account(),
    b = await account();
  const ip = nextIP();
  await database.client`INSERT INTO request_buckets (key,count,expires_at) VALUES (${`transfer-ip:${ip}`},30,now()+interval '1 minute') ON CONFLICT (key) DO UPDATE SET count=30, expires_at=now()+interval '1 minute'`;
  expect(
    (await request("/api/v1/export", undefined, a.cookie, ip)).status,
  ).toBe(429);
  expect(
    (
      await request(
        "/api/v1/import/preview",
        { file: {}, timezone: "UTC" },
        b.cookie,
        ip,
      )
    ).status,
  ).toBe(429);
  expect((await request("/api/v1/export", undefined, b.cookie)).status).toBe(
    200,
  );
  const expired = crypto.randomUUID(),
    live = crypto.randomUUID();
  await database.client`INSERT INTO auth_verification (id,identifier,value,expires_at) VALUES (${expired},${expired},'state',now()-interval '1 hour'), (${live},${live},'state',now()+interval '1 hour')`;
  await database.client`UPDATE auth_session SET expires_at=now()-interval '1 hour' WHERE user_id=${a.user.id}`;
  const result = await pruneExpired(database);
  expect(result.verifications).toBeGreaterThan(0);
  expect(result.sessions).toBeGreaterThan(0);
  expect(
    await database.client`SELECT id FROM auth_verification WHERE id=${expired}`,
  ).toHaveLength(0);
  expect(
    await database.client`SELECT id FROM auth_verification WHERE id=${live}`,
  ).toHaveLength(1);
  await database.client`DELETE FROM auth_verification WHERE id=${live}`;
});

test("post-verification signup rejects unverified identities, creates verified users and keeps login at capacity", async () => {
  const context = await auth.$context;
  const endpoint = {
    context,
    headers: new Headers(),
    request: new Request("http://localhost:5173/api/auth/callback/google"),
  } as Parameters<typeof handleOAuthUserInfo>[0];
  const email = crypto.randomUUID() + "@example.test";
  const info = {
    userInfo: {
      id: crypto.randomUUID(),
      name: "New Google user",
      email,
      emailVerified: false,
    },
    account: { providerId: "google", accountId: crypto.randomUUID() },
  };
  await expect(admitIdentity(endpoint, info)).rejects.toThrow();
  expect(
    await database.client`SELECT id FROM auth_user WHERE email=${email}`,
  ).toHaveLength(0);
  info.userInfo.emailVerified = true;
  const created = await admitIdentity(endpoint, info);
  expect(created.error).toBeNull();
  const userId = created.data!.user.id;
  users.push(userId);
  expect(created.isRegister).toBe(true);
  expect(
    (
      await database.client`SELECT row_count FROM tracker_usage WHERE user_id=${userId}`
    )[0].row_count,
  ).toBe(0);
  const [before] =
    await database.client`SELECT max_users FROM registration_capacity WHERE id=1`;
  try {
    await database.client`UPDATE registration_capacity SET max_users=0 WHERE id=1`;
    const returning = await admitIdentity(endpoint, info);
    expect(returning.error).toBeNull();
    expect(returning.data!.user.id).toBe(userId);
    const fullEmail = crypto.randomUUID() + "@example.test";
    const rejected = await admitIdentity(endpoint, {
      ...info,
      userInfo: { ...info.userInfo, email: fullEmail },
      account: { ...info.account, accountId: crypto.randomUUID() },
    });
    expect(rejected.error).toBe("unable to create user");
    expect(
      await database.client`SELECT id FROM auth_user WHERE email=${fullEmail}`,
    ).toHaveLength(0);
  } finally {
    await database.client`UPDATE registration_capacity SET max_users=${before.max_users} WHERE id=1`;
  }
});

test("bulk imports cross insert chunks and roll back all chunks when storage runs out", async () => {
  const { user } = await account();
  const rows = Array.from({ length: 1200 }, () => entry());
  const commit = (batch: Row[]) =>
    writeOnce(database, user.id, crypto.randomUUID(), batch, (sql) =>
      applyOperations(
        sql,
        user.id,
        batch.map((row) => ({ action: "put", row })),
      ),
    );
  await commit(rows);
  const [usage] =
    await database.client`SELECT row_count,data_bytes FROM tracker_usage WHERE user_id=${user.id}`;
  expect(usage.row_count).toBe(1200);
  expect(Number(usage.data_bytes)).toBe(
    1200 * Buffer.byteLength('{"note": "Lunch"}'),
  );
  await database.client`INSERT INTO tracking_entries (id,user_id,date,category,data) VALUES (gen_random_uuid(),${user.id},'2026-09-12','food',jsonb_build_object('note',repeat('x',5200000)))`;
  const [before] =
    await database.client`SELECT row_count,data_bytes FROM tracker_usage WHERE user_id=${user.id}`;
  await expect(
    commit(Array.from({ length: 2000 }, () => entry())),
  ).rejects.toMatchObject({ code: "STORAGE_LIMIT" });
  expect(
    (
      await database.client`SELECT row_count,data_bytes FROM tracker_usage WHERE user_id=${user.id}`
    )[0],
  ).toEqual(before);
  expect(
    await database.client`SELECT key FROM mutation_receipts WHERE user_id=${user.id}`,
  ).toHaveLength(1);
});
