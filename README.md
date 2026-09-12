# 💪 I AM SPARTACUS

A private health and activity tracker with the original mobile interface, now backed by PostgreSQL. Each account has its own fasting sessions, symptoms, food, supplements, weight, medical events, workouts, recurring plans, and history charts.

One Bun service serves a built React PWA and a same-origin Hono API with Better Auth sessions. PostgreSQL is the source of truth; no health data is persisted in localStorage, IndexedDB, or service-worker caches. Opening the tracker and saving changes require a connection.

## Local development

Prerequisites: Bun **1.4.2**, Docker for local PostgreSQL, and Node **24** for development/test tools. Production and migration images require only Bun.

```sh
bun install --frozen-lockfile
cp .env.example .env
docker compose up -d postgres
# Set a random BETTER_AUTH_SECRET in .env before starting.
bun run db:migrate
# Configure a Google OAuth Web client using GOOGLE_AUTH_SETUP.md.
bun run dev
```

Open <http://localhost:5173> and continue with Google. Follow [GOOGLE_AUTH_SETUP.md](GOOGLE_AUTH_SETUP.md) to create the OAuth client and publish the operator/privacy settings. Signup is open up to 100 total accounts; each tracker has a 50,000-record / 5 MiB data limit. Account & data provides export and permanent deletion. Inactive accounts are not automatically deleted.

Production: `bun run build`, then `bun start`. The app and separate migration command share `DATABASE_URL` and one database account. Set `BETTER_AUTH_URL` to the external origin. See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for configuration, roles, images, release order, and account recovery.

## Project layout

- `src/client`: authentication, account/import UI, query state, and PWA integration. `tracker/` contains the extracted original screens and presentation model; these remain JavaScript/JSX to preserve the UI, with typed persistence and domain boundaries.
- `src/shared`: TypeScript/Zod contracts, row-level change generation, dates, selectors, and import conversion. No server/auth implementation is imported into the browser.
- `src/server` and `src/db`: Hono routes, Better Auth, transactional persistence, and Drizzle schema.
- `drizzle` and `scripts`: reviewed SQL migrations, a separate runner, and account commands.
- `legacy/index.html`: the old application plus an export button. Serve it at the **old application's original URL** during transfer; another origin cannot access that browser's data.
- `tests`: domain, component, real PostgreSQL integration, and browser tests.

## Data transfer

1. Keep the old application available. Publish `legacy/index.html` as its index page on its existing origin.
2. In the browser containing the old data, choose **Export data for the new app**. Keep the JSON file.
3. Sign into an empty tracker account. Open **Account & data**, select the original data's timezone, and choose the export. Do this before saving settings or logging data.
4. Choose an export smaller than 4 MiB (including request wrapping). Review counts, warnings, and errors, then confirm. Invalid data prevents the entire import. The exporter never deletes the original browser records.

All five storage records are covered, including checklist markers and active fasts. IDs are remapped to handle old timestamp collisions across dates/categories. Completed legacy fasts lack dates; the importer reports its same-day/previous-day inference. Repeating an identical import is harmless. Different imports into populated accounts are rejected; history merging is outside v1.

**Download account export** creates a versioned file that can also be imported into an empty account. Exports contain tracker data, not credentials or sessions. They complement database backups rather than replacing them.

## Verification and TDD

```sh
bun run typecheck
bun run lint
bun run format:check
bun run test
bun run test:components
bun run build
```

Create a **disposable** PostgreSQL database ending in `_test`, then configure:

```sh
export TEST_DATABASE_URL=postgres://spartacus:spartacus@localhost:5433/spartacus_test
bun run test:integration
bun x playwright install chromium webkit
bun run test:e2e
```

The test role needs `CREATEDB` for isolated migration-upgrade tests. Tests apply committed SQL migrations against real PostgreSQL. Browser tests use the production frontend build on port 4173. CI supplies PostgreSQL and checks migrations, tests, builds, and both images. Successful pushes to `main` publish matching app and migration images to GHCR with commit SHA tags; pull requests only verify. JUnit and Playwright reports are retained for 14 days. See the [GitHub Actions and Pages cutover instructions](DEPLOYMENT_GUIDE.md#github-actions-and-container-releases) before merging: Pages must switch from publishing the repository root to the dedicated legacy-exporter workflow.

For behavior changes, start with a failing domain/API test, implement, then refactor. Use component/browser tests for meaningful behavior such as failed saves, conflicts, account isolation, and PWA lifecycle. `bun run format` formats source; the legacy artifact is excluded.

## API contract

Tracker endpoints require a Better Auth cookie. Mutations require the trusted `Origin`, JSON content type, and a UUID `Idempotency-Key` (preview does not require a key).

| Endpoint                                     | Behavior                                      |
| -------------------------------------------- | --------------------------------------------- |
| `GET /api/v1/state`                          | Consistent snapshot of this user's records    |
| `GET /api/v1/days/:date`                     | Day records, schedules, settings, active fast |
| `GET /api/v1/history?from=…&to=…&category=…` | Inclusive date range and optional category    |
| `POST /api/v1/commit`                        | Atomic batch of typed row puts/deletes        |
| `POST /api/v1/fast/start`, `/fast/stop`      | Server-timestamped transactional actions      |
| `GET /api/v1/export`                         | Version 1 tracker export                      |
| `POST /api/v1/import/preview`, `/import`     | Preview and all-or-nothing import             |

Account deletion uses `POST /api/v1/account/delete` with `{ "confirmation": "DELETE" }` and a session created within the last 10 minutes. It returns `{ "deleted": true }` and revokes every session.

Commits use `{ operations: [...] }`. Puts contain `{ action: "put", row }`; a row has `id`, `kind`, `date`, `category`, `data`, and `revision`. Revision `0` creates a record. Deletes contain `action`, `kind`, `id`, and `revision`. Exact contracts are in `src/shared/model.ts`. User IDs are never accepted from the client.

Successful mutations return `{ rows }`; errors return `{ error: { code, message } }`. Statuses: `400` validation, `401` missing/expired session, `403` wrong origin, `409` stale revision or singleton conflict, `413` storage/request limit, `429` rate limited (honor `Retry-After`), and `503` unconfirmed service failure. Retry unconfirmed requests with the same key and body within seven days; after that, reload and review the current state. Reusing a key with another body is rejected. On conflict, reload/review and cancel/reopen the affected editor to use its latest revision; there is no silent overwrite.

The existing UI reads a full per-user snapshot, refreshing on focus/reconnect and every 30 seconds while active. Writes change individual records. Draft editors retain their original revisions across background refreshes. Larger-scale pagination, sharing, offline edits, reminders, and Kubernetes manifests are outside v1.
