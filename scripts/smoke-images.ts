import assert from "node:assert/strict";

// This test owns an isolated Docker network/database; it ignores host database URLs.
const appImage = process.env.APP_IMAGE;
const migrationImage = process.env.MIGRATION_IMAGE;
if (!appImage || !migrationImage)
  throw new Error("Set APP_IMAGE and MIGRATION_IMAGE to locally built images");
const suffix = crypto.randomUUID().slice(0, 8);
const network = `spartacus-smoke-${suffix}`;
const postgres = `${network}-db`;
const app = `${network}-app`;
const databaseUrl = `postgres://spartacus_app:smoke-app-password@${postgres}:5432/spartacus_smoke_test`;
const secret = "image-smoke-only-secret-at-least-32-characters";

async function docker(args: string[], input?: string) {
  const process = Bun.spawn(["docker", ...args], {
    stdin: input === undefined ? "ignore" : new Blob([input]),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [code, stdout, stderr] = await Promise.all([
    process.exited,
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
  ]);
  if (code !== 0) throw new Error(`Docker ${args[0]} failed: ${stderr}`);
  return stdout.trim();
}
async function eventually(check: () => Promise<void>) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      await check();
      return;
    } catch (error) {
      lastError = error;
      await Bun.sleep(500);
    }
  }
  throw lastError;
}
async function sql(statement: string) {
  return docker(
    [
      "exec",
      "-i",
      postgres,
      "psql",
      "-h",
      "127.0.0.1",
      "-U",
      "spartacus",
      "-d",
      "spartacus_smoke_test",
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
    ],
    statement,
  );
}
try {
  await docker(["network", "create", network]);
  await docker([
    "run",
    "--detach",
    "--name",
    postgres,
    "--network",
    network,
    "--env",
    "POSTGRES_USER=spartacus",
    "--env",
    "POSTGRES_PASSWORD=smoke-owner-password",
    "--env",
    "POSTGRES_DB=spartacus_smoke_test",
    "postgres:17-alpine",
  ]);
  await eventually(async () => {
    assert.equal(await sql("SELECT 1"), "1");
  });
  // Provision one non-superuser owner for both migrations and the app.
  await sql(`
    CREATE ROLE spartacus_app LOGIN PASSWORD 'smoke-app-password';
    ALTER DATABASE spartacus_smoke_test OWNER TO spartacus_app;
    ALTER SCHEMA public OWNER TO spartacus_app;
  `);
  const migrate = (mode: string) =>
    docker([
      "run",
      "--rm",
      "--network",
      network,
      "--read-only",
      "--cap-drop=ALL",
      "--security-opt=no-new-privileges",
      "--env",
      `DATABASE_URL=${databaseUrl}`,
      migrationImage,
      mode,
    ]);
  await migrate("apply");
  await migrate("apply"); // Retrying a release must be harmless.
  const status = JSON.parse(await migrate("status"));
  assert.ok(status.applied > 0);
  assert.equal(status.pending, 0);
  // The container trusts this browser origin, irrespective of its internal port.
  const origin = "http://localhost:3000";
  const runtimeEnv = [
    "--env",
    `DATABASE_URL=${databaseUrl}`,
    "--env",
    `BETTER_AUTH_URL=${origin}`,
    "--env",
    `BETTER_AUTH_SECRET=${secret}`,
    "--env",
    "TRUST_PROXY=true",
    "--env",
    "TRUSTED_PROXY_CIDRS=192.0.2.0/24",
  ];
  await docker(
    [
      "run",
      "--rm",
      "-i",
      "--network",
      network,
      "--read-only",
      ...runtimeEnv,
      appImage,
      "bun",
      "scripts/accounts.ts",
      "create",
      "image-smoke@example.test",
      "Image smoke",
    ],
    "smoke-account-password-123\n",
  );
  await docker([
    "run",
    "--detach",
    "--name",
    app,
    "--network",
    network,
    "--publish",
    "127.0.0.1::3000",
    "--read-only",
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges",
    ...runtimeEnv,
    appImage,
  ]);
  let base = `http://${await docker(["port", app, "3000/tcp"])}`;
  const ready = () =>
    eventually(async () => {
      assert.equal((await fetch(`${base}/health/ready`)).status, 200);
    });
  await ready();
  assert.equal((await fetch(`${base}/health/live`)).status, 200);
  assert.match(await (await fetch(`${base}/`)).text(), /I AM SPARTACUS/);
  const manifest = await fetch(`${base}/manifest.webmanifest`);
  assert.equal(manifest.status, 200);
  assert.equal((await manifest.json()).display, "standalone");
  assert.equal((await fetch(`${base}/sw.js`)).status, 200);
  assert.equal((await fetch(`${base}/%00/foo`)).status, 400);
  assert.equal((await fetch(`${base}/api/v1/state`)).status, 401);

  const login = await fetch(`${base}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({
      email: "image-smoke@example.test",
      password: "smoke-account-password-123",
    }),
  });
  assert.equal(
    login.status,
    200,
    "image can authenticate a provisioned account",
  );
  const cookie = login.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  assert.ok(cookie);
  const id = crypto.randomUUID();
  const saved = await fetch(`${base}/api/v1/commit`, {
    method: "POST",
    headers: {
      cookie,
      origin,
      "content-type": "application/json",
      "idempotency-key": crypto.randomUUID(),
    },
    body: JSON.stringify({
      operations: [
        {
          action: "put",
          row: {
            id,
            kind: "entry",
            date: "2026-09-12",
            category: "food",
            revision: 0,
            data: { note: "Image restart persistence" },
          },
        },
      ],
    }),
  });
  assert.equal(saved.status, 200, "shared app/migration account can save");
  assert.equal(saved.headers.get("cache-control"), "no-store");
  await docker(["restart", app]);
  // Docker may allocate a new ephemeral host port after a restart.
  base = `http://${await docker(["port", app, "3000/tcp"])}`;
  await ready();
  const response = await fetch(`${base}/api/v1/state`, { headers: { cookie } });
  assert.equal(response.status, 200, "session survives restart");
  const state = await response.json();
  assert.ok(
    state.rows.some((row: { id: string }) => row.id === id),
    "data survives restart",
  );
  // The socket peer is outside the configured proxy CIDR. Rotating forged
  // forwarding headers cannot create new login buckets, even after restart.
  for (let attempt = 0; attempt < 10; attempt++) {
    const denied = await fetch(`${base}/api/auth/sign-in/email`, {
      method: "POST",
      headers: {
        origin,
        "content-type": "application/json",
        "x-forwarded-for": `198.51.100.${attempt}`,
        "x-spartacus-client-ip": `198.51.100.${attempt}`,
      },
      body: JSON.stringify({
        email: "image-smoke@example.test",
        password: "wrong-account-password",
      }),
    });
    assert.equal(
      denied.status,
      attempt < 9 ? 401 : 429,
      "socket-bound sign-in throttling",
    );
  }
  console.info(
    "Images verified: fresh/repeated migrations with one database account, PWA, login/save, restart persistence and proxy-spoof resistance.",
  );
} catch (error) {
  for (const container of [app, postgres])
    console.error(await docker(["logs", container]).catch(() => ""));
  throw error;
} finally {
  for (const container of [app, postgres])
    await docker(["rm", "--force", "--volumes", container]).catch(() => {});
  await docker(["network", "rm", network]).catch(() => {});
}
