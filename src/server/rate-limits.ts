import type { Database } from "../db/connection";

// Bounded fixed-window admission protection before authentication/DB work.
// Capacity exhaustion rejects new keys rather than evicting active limits.
export class MemoryLimiter {
  private entries = new Map<string, { count: number; expires: number }>();
  private nextSweep = 0;
  constructor(private capacity = 10000) {}
  consume(key: string, max: number, windowMs: number, now = Date.now()) {
    if (now >= this.nextSweep) {
      for (const [key, entry] of this.entries)
        if (entry.expires <= now) this.entries.delete(key);
      this.nextSweep = now + Math.min(windowMs, 30000);
    }
    let entry = this.entries.get(key);
    if (entry && entry.expires <= now) {
      this.entries.delete(key);
      entry = undefined;
    }
    if (!entry) {
      if (this.entries.size >= this.capacity) return Math.ceil(windowMs / 1000);
      entry = { count: 0, expires: now + windowMs };
      this.entries.set(key, entry);
    }
    if (entry.count >= max)
      return Math.max(1, Math.ceil((entry.expires - now) / 1000));
    entry.count++;
    return 0;
  }
}

// PostgreSQL serializes concurrent increments, including requests to other pods.
export async function consumeBudget(
  database: Database,
  key: string,
  max: number,
  windowSeconds = 60,
) {
  const [bucket] = await database.client`
    INSERT INTO request_buckets (key, count, expires_at)
    VALUES (${key}, 1, now() + ${windowSeconds} * interval '1 second')
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN request_buckets.expires_at <= now() THEN 1 ELSE request_buckets.count + 1 END,
      expires_at = CASE WHEN request_buckets.expires_at <= now() THEN now() + ${windowSeconds} * interval '1 second' ELSE request_buckets.expires_at END
    WHERE request_buckets.expires_at <= now() OR request_buckets.count < ${max}
    RETURNING count`;
  return Boolean(bucket);
}
