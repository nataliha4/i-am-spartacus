# Google sign-in setup

Google sign-in is implemented; creating the Google Cloud client and configuring your deployment are manual operator steps. No real Google credentials are needed for CI. Do not put them in Git, Docker build arguments, Vite variables, or chat.

## 1. Choose the public origin and publish the policy

Choose the final HTTPS origin, for example `https://tracker.example.com`. GitHub Pages continues to serve the old browser tracker/export tool; it cannot host this Bun app or its OAuth callback.

Set these **runtime** variables in your deployment secret/environment:

```dotenv
BETTER_AUTH_URL=https://tracker.example.com
BETTER_AUTH_SECRET=<stable random secret of at least 32 characters>
OPERATOR_NAME=<actual person or organisation operating the service>
PRIVACY_CONTACT=<monitored email address>
BACKUP_RETENTION_DAYS=<actual maximum backup retention, 0 if none>
LOG_RETENTION_DAYS=<actual maximum application and ingress log retention, 0 if none>
```

The retention variables have no defaults: they describe infrastructure policy and do not configure CNPG or log storage. Set and verify those systems to match before opening signup. Do not log OAuth callback query strings, cookies, authorization headers or request bodies in the ingress. Review the published notice against how you actually operate the service; add any operator-specific disclosures before launch.

Deploy the built application and run the separate migration image first, using the shared database account. You can initially leave both Google variables unset: the homepage and policy pages work, while Google sign-in returns a clear unavailable response. `/privacy` and `/terms` must be publicly accessible with the correct operator/contact and retention periods. Google signup in production fails startup if policy configuration is incomplete. Build artifacts contain no deployment credentials.

Active and inactive accounts keep their tracker until deletion; there is no automatic inactivity deletion. Account deletion erases live account/tracker/session data immediately. Keep a restricted deletion log outside the restored database for the backup retention period, and reapply those deletions before reopening a restored backup. Delete that log once all affected backups expire. Exported files and the old browser tracker are user-managed copies.

## 2. Create the Google OAuth client

1. Create or select a Google Cloud project and open **Google Auth Platform** (in some console views, **APIs & Services → OAuth consent screen / Credentials**).
2. Configure **Branding**: application name, support email, developer contact, homepage at your new origin, privacy URL `<origin>/privacy`, and terms URL `<origin>/terms`. Add/verify your authorised domain where Google requests it. Use your actual operator identity.
3. Select an **External** audience for personal Google accounts and users outside your organisation. During setup, add your own Google account as a test user.
4. Under **Data Access**, request only `openid`, `email`, and `profile`. The app requests only those scopes; it neither requests Google Drive/Gmail access nor keeps OAuth bearer tokens after login. Follow any verification or branding review the console requires; do not assume publishing alone guarantees approval.
5. Under **Clients**, create an OAuth client of type **Web application**. Register exact **Authorised redirect URIs**, including the entire path:
   - Development: `http://localhost:5173/api/auth/callback/google`
   - Production: `https://tracker.example.com/api/auth/callback/google` (substitute your actual origin)
   - Optional local Docker preview: `http://localhost:3000/api/auth/callback/google`
6. Copy the client ID and client secret into `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in the runtime environment, then restart the app. Use a separate development client if you want independent credential rotation. No Google JavaScript SDK is used, so authorised JavaScript origins are not needed for this server redirect flow.
7. Test with the configured test user. When ready for open signup, change the external audience's publishing status to **In production** and complete any console-required review. Confirm a Google account outside the test-user list can sign in.

Authoritative references: [Google web-server OAuth flow](https://developers.google.com/identity/protocols/oauth2/web-server) and [Google OAuth policies](https://developers.google.com/identity/protocols/oauth2/policies).

## 3. Local development and Docker

For Vite development, use `.env` with `BETTER_AUTH_URL=http://localhost:5173` and the development Google client. Vite proxies `/api`, `/privacy` and `/terms` to Bun on port 3000. Run `bun run db:migrate` and `bun run dev`.

For the production container locally, configure `.env` with `BETTER_AUTH_URL=http://localhost:3000`, all policy settings, and the matching Google redirect. Then:

```sh
docker compose up -d postgres
docker compose --profile app run --rm --build migrate
docker compose --profile app up -d --build app
```

The migration container does not need OAuth credentials. Migrations never run at app startup. In production, connect both containers to the existing CNPG writer with the same `DATABASE_URL`; the Compose PostgreSQL password is only for local development.

## 4. Existing accounts and capacity

A new Google user receives a private tracker automatically while capacity remains. PostgreSQL atomically enforces **100 total accounts**, including operator-created accounts, across all instances. Existing users can still sign in at capacity. Deleting an account frees a slot. The migration briefly locks user/tracker writes while seeding counters and installing triggers. It counts existing users and preserves their records, even if they already exceed a limit; reduce usage or deliberately change capacity before growing further.

An existing password account with an unverified email **will not automatically link**. Independently verify that the requester controls both the exact email and the existing account, then run:

```sh
bun run account:google person@example.com --verified-owner
```

This targets only that account, removes its credential login and pending password-reset tokens, revokes sessions, and marks the local email verified so Google can link on next sign-in. Do not bulk-verify unknown accounts or disable `requireLocalEmailVerified`. The original tracker is preserved. Hidden credential login and the operator create/reset/revoke commands remain for test provisioning and controlled recovery; resetting a Google-only account must be treated as an explicit recovery operation by a trusted operator.

Capacity is database configuration, shared by all pods. Inspect it with:

```sql
SELECT registered_users, max_users FROM registration_capacity WHERE id = 1;
SELECT user_id, row_count, data_bytes FROM tracker_usage ORDER BY data_bytes DESC;
```

To deliberately change signup capacity, an operator can update `max_users` in that singleton row; setting it to zero closes new signup while retaining existing logins. Each tracker is limited to **50,000 records and 5 MiB of JSONB payload text in UTF-8** across all five tracker tables. Indexes, row metadata, receipts, sessions and PostgreSQL overhead are additional disk usage. All tracker writes, imports and fast actions enforce storage limits transactionally. A rejected batch leaves its records and retry receipts unchanged. Legacy over-limit data can be reduced without deleting the account. Imports have a **4 MiB HTTP body limit**, including JSON request wrapping.

## 5. Launch and recovery checks

- Sign in with a new Google account; sign out and return; confirm the same tracker appears. Try a second Google account and verify it has an independent tracker.
- Cancel consent and try again. Test an existing unverified operator account, then its deliberate Google transition. Verify the callback URI exactly matches the public origin and that trusted-proxy configuration describes the actual ingress.
- Use Account & data to export and delete a disposable account. Deletion needs a sign-in within the past 10 minutes. Confirm other tabs/devices lose access and that another user's data is untouched.
- Verify `/privacy` and `/terms` render unauthenticated, on mobile and outside the PWA cache, and match your real retention settings. Test the PWA on the intended production origin.
- Configure a CNPG/data-volume disk alert before public launch (for example warning below 25% free, critical below 15%) with a reachable operator. Also monitor database growth, `registration_capacity`, quota rejections, HTTP 429s and `maintenance_failed`. Quotas are abuse bounds, not a prediction of total disk consumption. Load-test against the actual database/storage before raising the 100-account cap. Kubernetes alert installation remains infrastructure work.
- CI checks callback/state rejection, the post-verification account-linking seam, quotas, deletion and private credential-backed browser journeys. It deliberately does **not** simulate Google or claim to verify Google's live consent/token exchange. Perform the real sign-in checks after the cloud client is configured.

For Google client-secret rotation, create/reset the secret in Google Cloud, update the runtime secret on every app instance, restart/roll out, verify sign-in, and retire the old secret as permitted by Google. Do not change `BETTER_AUTH_SECRET` as part of client-secret rotation: changing it separately invalidates sessions and in-flight OAuth state. This app discards Google tokens instead of requiring their re-encryption.

### Deferred launch requirement: deletion journal

The application currently deletes live data only. It does not yet write the independent, durable deletion journal needed to reapply self-service deletions after a database restore. Backup-safe deletion remains unresolved until that journal and a tested replay procedure exist. Do not reopen a restored backup to users without reconciling deletions; an older backup can contain deleted accounts, sessions, and tracker data. This requirement was explicitly deferred from the code audit fixes.
