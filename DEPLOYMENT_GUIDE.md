# Operating the Bun application

The service is stateless outside PostgreSQL. Serve it behind HTTPS at one origin, including `/api`. No persistent app filesystem, Redis, SMTP, or separate frontend server is needed. CNPG provisioning and Kubernetes configuration remain separate infrastructure work.

## GitHub Actions and container releases

`.github/workflows/ci.yml` runs on pull requests and pushes to `main`. It checks formatting, lint, types and generated migration drift; runs domain, component, PostgreSQL integration and Chromium/mobile WebKit tests; builds both Docker targets; then smoke-tests the actual images against a fresh, isolated PostgreSQL instance. The smoke test checks repeatable migrations using the same database account as the app, login/save, PWA assets, and session/data persistence across a container restart. Runtime is tested with a read-only filesystem and dropped capabilities.

Each suite emits JUnit XML. The run summary records outcomes, and `test-results` plus `playwright-report` artifacts retain reports, screenshots and failure traces for 14 days. A failed or skipped required suite blocks image publication. Pull requests build and test images but do not log in to GHCR or publish.

Successful `main` runs publish the exact tested images, tagged with the seven-character commit SHA:

- `ghcr.io/nataliha4/i-am-spartacus:COMMIT_SHA`
- `ghcr.io/nataliha4/i-am-spartacus-migrate:COMMIT_SHA`

Names derive from the lowercase repository name, so forks use their own namespace. Both images carry source/revision OCI labels. Builds currently target **linux/amd64**, with separate GitHub Actions layer caches. There is no moving `latest` tag. Use the same release tag for migration and runtime; for deployment immutability, record the registry digests. The two pushes are not atomic: use a release only after the entire CI run succeeds.

A separate `publish` job downloads the verified image artifact and pushes it with `GITHUB_TOKEN` and `packages: write`. The verification job, including same-repository pull requests, has only `contents: read`. No checkout, dependency installation, build, test, or container execution runs in the publish job. No registry password or deployment token is needed. An existing GHCR package must grant this repository Actions access. Configure package visibility/pull credentials for your cluster separately. CI uses disposable local databases and never connects to CNPG. Kubernetes manifests, deployment-repository promotion, and production migrations are not triggered by this workflow.

To repeat the image check locally after building both targets:

```sh
APP_IMAGE=spartacus:RELEASE MIGRATION_IMAGE=spartacus-migrate:RELEASE bun run test:images
```

The script requires Docker, creates its own network/database and removes them on completion. It does not use your configured database URLs.

## GitHub Pages cutover

The repository currently publishes `main` from `/`. **Before merging the Bun conversion into `main`, change Settings → Pages → Build and deployment → Source to GitHub Actions.** The new repository-root `index.html` is a Vite entry point and cannot be published as the old static site. See [GitHub's publishing-source instructions](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

`.github/workflows/pages.yml` publishes only `legacy/`, making its index page available at the existing `https://nataliha4.github.io/i-am-spartacus/` URL. It runs when the legacy site/workflow changes on `main`, and can also be started manually on `main`. If a GitHub Pages environment approval rule is enabled, approve that deployment in Actions. This workflow is independent of the Bun image build so users retain export access during the migration.

After the first deployment, open the old URL in the browser that contains the original data and verify the **Export data for the new app** button. Keep that URL available until users have transferred their records. Host the new Bun application at its own HTTPS origin; Pages continues serving the old browser-backed application/exporter during cutover.

## Configuration

| Variable                 | Purpose                                                                                 |
| ------------------------ | --------------------------------------------------------------------------------------- |
| `DATABASE_URL`           | Shared PostgreSQL connection for the app and migrations                                 |
| `MIGRATION_DATABASE_URL` | Optional migration-only override; defaults to `DATABASE_URL`                            |
| `BETTER_AUTH_SECRET`     | Stable random secret, at least 32 characters                                            |
| `BETTER_AUTH_URL`        | External origin, e.g. `https://tracker.example.com`; the only trusted origin            |
| `PORT`                   | Default `3000`                                                                          |
| `DB_POOL_MAX`            | Connections per instance; default `5`                                                   |
| `DB_SSL`                 | `disable` locally; `require` for certificate-verified TLS                               |
| `DB_SSL_CA_FILE`         | Optional custom CA certificate path                                                     |
| `TRUST_PROXY`            | Default `false`; enabling requires `TRUSTED_PROXY_CIDRS`                                |
| `TRUSTED_PROXY_CIDRS`    | Comma-separated actual proxy IPs/CIDRs; the socket peer anchors forwarded-IP resolution |
| `STATIC_DIR`             | Built frontend location; default `dist/client`                                          |

Keep credentials out of Git and frontend builds. Every instance's pool counts against the cluster connection budget. Connect to CNPG's writer service, not a read replica.

## Database account

Use one PostgreSQL login that owns the dedicated application database and its schema/tables. Supply the same `DATABASE_URL` to the app and migration image; this account can both change the schema and read/write tracker data. A regular database owner is sufficient; PostgreSQL superuser privileges are not required.

The example environment and CI use this shared connection. `MIGRATION_DATABASE_URL` remains an optional override if separate credentials are useful later. Migration generation, status and apply all use that override when set, otherwise `DATABASE_URL`.

## Schema changes and releases

1. Edit the Drizzle schema, run `bun run db:generate`, and review/commit SQL plus metadata. Auth changes share this history; update schema fields to match enabled Better Auth features. Do not use a separate auth migrator or production schema push.
2. Run PostgreSQL tests. Append forward migrations; never edit applied SQL.
3. Build both images from the same commit:

   ```sh
   docker build --target runtime -t spartacus:RELEASE .
   docker build --target migrate -t spartacus-migrate:RELEASE .
   ```

4. With a verified recovery point, run migrations using the same environment file as the app, containing `DATABASE_URL` and any required TLS settings:

   ```sh
   docker run --rm --env-file /secure/app.env spartacus-migrate:RELEASE status
   docker run --rm --env-file /secure/app.env spartacus-migrate:RELEASE apply
   ```

5. Start the application image with the same database configuration and verify readiness, login, and a test save.

Startup **never runs migrations**. The runner reserves one connection, acquires a PostgreSQL advisory lock, verifies applied checksums, and executes each pending migration transactionally. Failed statements roll back together with their history entry; earlier successful migrations remain applied. Concurrent runners serialize and recheck history. Status writes nothing. An older runner refuses to migrate a newer database.

Only transactional SQL is supported; `CREATE INDEX CONCURRENTLY` needs a deliberately designed future mechanism. Use additive schema changes before deploying compatible code; remove obsolete columns in a later release. Roll back application code only while its schema is compatible. There are no automatic down migrations.

`/health/live` checks the process without database access. `/health/ready` checks database access and required migration hashes in one query. Concurrent probes share that query, and both success and failure results are cached for five seconds per process. Block `/health/*` at the public ingress; expose it only to internal probes. Logs contain request IDs, methods, sanitized paths, status, and duration; no bodies, query strings, cookies, passwords, or health payloads. SIGTERM stops accepting requests and closes the pool.

## Traffic limits and retention

`TRUST_PROXY=true` requires `TRUSTED_PROXY_CIDRS` containing the actual ingress IPs/subnets, not a broad network also occupied by clients. Forwarded chains are walked from the actual socket peer toward the client; headers from an untrusted direct caller cannot replace its socket IP. Requests without a resolvable client address are rejected before authentication rather than sharing a placeholder rate-limit key.

Before database access, each instance permits up to 1,200 API requests/minute, 120 per client IP/minute (IPv6 grouped by /64), and 20 in-flight requests. Admission storage has a fixed capacity and rejects new keys when full. Auth retains its database-backed limit of 10 email sign-in attempts/minute per client IP. Tracker requests have an additional PostgreSQL-backed limit of 120/minute per session across all instances; import, preview and export share a 10/minute per-account budget. Exceeded tracker/admission limits return `429` with `Retry-After`. Day and history queries filter by user/date/category in SQL.

Each app instance runs bounded cleanup on startup and every minute, coordinated with a database advisory lock. It removes mutation receipts older than **7 days**, auth rate-limit keys inactive for an hour, and API buckets expired for an hour. Each pass removes at most 10,000 rows per table using indexed cutoffs. Monitor `maintenance_failed` log events. An operator can run a pass manually with the shared app database account:

```sh
bun run db:prune
# Or inside the app image:
docker run --rm --env-file /secure/app.env spartacus:RELEASE bun scripts/prune.ts
```

Idempotency retries are guaranteed for seven days after the original successful mutation. After that window, reload and review current state before submitting another change. A matching key inside the retention window still returns the current snapshot without applying the operation again.

HTTPS deployments send HSTS on API and static responses. Both also send the same content security, content type and referrer policies. The web auth instance does not install the admin plugin; only the operator CLI instantiates it.

## Accounts and recovery

Public signup/admin HTTP endpoints are disabled. Run commands in the application image or a trusted checkout with the runtime database/auth environment configured:

```sh
bun run account:create person@example.com "Person Name" < /secure/password-file
bun run account:reset person@example.com < /secure/new-password-file
bun run account:revoke person@example.com
```

Passwords arrive through stdin and must be 12–128 characters. The CLI uses Better Auth's server APIs for credentials, with no custom hashing or direct credential writes. Reset generates/consumes a short-lived token inside the operator process, sends no email, and revokes existing sessions. Changing a known password in the UI revokes other sessions. Sessions expire after 14 days and renew while active.

## Legacy cutover and backups

Keep `legacy/index.html` on the original site's origin until users have downloaded and checked their exports. Do not redirect away before transfer. The new service cannot read another origin's localStorage and does not serve/mutate legacy data automatically.

Use the existing CNPG backup process for the complete database: auth, tracker data, receipts, and migration history. Verify restoration into a separate database with readiness/login/read checks. Tracker JSON exports omit accounts and sessions and are not full disaster recovery. Backup scheduling, retention, and Kubernetes rollout automation are infrastructure work.
