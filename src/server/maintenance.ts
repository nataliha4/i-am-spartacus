import type { Database } from "../db/connection";

export const RECEIPT_RETENTION_DAYS = 7;
// Each pass is bounded. Per-instance admission allows at most 1,200 API
// requests/minute, below this per-table cleanup batch size.
export async function pruneExpired(database: Database) {
  return database.client.begin(async (sql) => {
    const [lock] =
      await sql`SELECT pg_try_advisory_xact_lock(731802515) AS acquired`;
    if (!lock.acquired) return { receipts: 0, authLimits: 0, apiLimits: 0 };
    const receipts =
      await sql`DELETE FROM mutation_receipts WHERE (user_id,key) IN (
      SELECT user_id,key FROM mutation_receipts WHERE created_at < now() - ${RECEIPT_RETENTION_DAYS} * interval '1 day'
      ORDER BY created_at LIMIT 10000
    ) RETURNING key`;
    const authLimits = await sql`DELETE FROM auth_rate_limit WHERE id IN (
      SELECT id FROM auth_rate_limit WHERE last_request < (extract(epoch FROM (now() - interval '1 hour')) * 1000)::bigint
      ORDER BY last_request LIMIT 10000
    ) RETURNING id`;
    const apiLimits = await sql`DELETE FROM request_buckets WHERE key IN (
      SELECT key FROM request_buckets WHERE expires_at < now() - interval '1 hour'
      ORDER BY expires_at LIMIT 10000
    ) RETURNING key`;
    return {
      receipts: receipts.length,
      authLimits: authLimits.length,
      apiLimits: apiLimits.length,
    };
  });
}
export function startMaintenance(database: Database) {
  let running: Promise<unknown> | undefined;
  const tick = () => {
    if (running) return;
    running = pruneExpired(database)
      .catch(() =>
        console.error(JSON.stringify({ event: "maintenance_failed" })),
      )
      .finally(() => {
        running = undefined;
      });
  };
  const timer = setInterval(tick, 60000);
  timer.unref();
  tick();
  return async () => {
    clearInterval(timer);
    await running;
  };
}
