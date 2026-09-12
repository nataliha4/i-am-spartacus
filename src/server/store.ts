import type postgres from "postgres";
import {
  canonical,
  kinds,
  validateRow,
  type Kind,
  type Operation,
  type Row,
} from "../shared/model";
import type { Database } from "../db/connection";

export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export const tables: Record<Kind, string> = {
  entry: "tracking_entries",
  schedule: "tracking_schedules",
  checklist: "tracking_checklists",
  settings: "tracking_settings",
  fast: "tracking_fasts",
};
type SQL = postgres.Sql | postgres.TransactionSql;
export type RowFilter =
  { day: string } | { from: string; to: string; category?: string };
export async function readRows(
  sql: SQL,
  userId: string,
  filter?: RowFilter,
): Promise<Row[]> {
  const rows: Row[] = [];
  for (const kind of kinds) {
    let predicate = sql`true`;
    if (filter && "day" in filter) {
      if (kind === "fast")
        predicate = sql`(date=${filter.day} OR data->>'endTimestampMs' IS NULL)`;
      else if (kind !== "settings" && kind !== "schedule")
        predicate = sql`date=${filter.day}`;
    } else if (filter) {
      predicate = sql`date >= ${filter.from} AND date <= ${filter.to}`;
      if (filter.category)
        predicate = sql`${predicate} AND category=${filter.category}`;
    }
    const found =
      await sql`SELECT id, date::text, category, data, revision FROM ${sql(tables[kind])} WHERE user_id=${userId} AND ${predicate} ORDER BY created_at, id`;
    rows.push(...found.map((row) => ({ ...row, kind }) as Row));
  }
  return rows;
}
export async function readSnapshot(
  database: Database,
  userId: string,
  filter?: RowFilter,
): Promise<Row[]> {
  const result = await database.client.begin(
    "isolation level repeatable read read only",
    (sql) => readRows(sql, userId, filter),
  );
  return result as Row[];
}
export async function applyOperations(
  sql: postgres.TransactionSql,
  userId: string,
  operations: Operation[],
) {
  // The same lock serializes commits, imports and account deletion across pods.
  await sql`SELECT pg_advisory_xact_lock(hashtextextended(${userId},0))`;
  try {
    let pending: Row[] = [];
    async function flushInserts() {
      if (!pending.length) return;
      const kind = pending[0].kind;
      await sql`INSERT INTO ${sql(tables[kind])} ${sql(
        pending.map((row) => ({
          id: row.id,
          user_id: userId,
          date: row.date,
          category: row.category,
          data: JSON.stringify(row.data),
        })),
        "id",
        "user_id",
        "date",
        "category",
        "data",
      )}`;
      pending = [];
    }
    const seen = new Set<string>();
    for (const operation of operations) {
      const kind =
        operation.action === "put" ? operation.row.kind : operation.kind;
      const id = operation.action === "put" ? operation.row.id : operation.id;
      if (seen.has(`${kind}:${id}`))
        throw new AppError(
          400,
          "DUPLICATE_OPERATION",
          "A record may only be changed once per request",
        );
      seen.add(`${kind}:${id}`);
      if (
        pending.length &&
        (pending[0].kind !== kind ||
          pending.length >= 1000 ||
          operation.action === "delete" ||
          operation.row.revision !== 0)
      )
        await flushInserts();
      if (operation.action === "delete") {
        const result =
          await sql`DELETE FROM ${sql(tables[kind])} WHERE id=${id} AND user_id=${userId} AND revision=${operation.revision} RETURNING id`;
        if (!result.length)
          throw new AppError(
            409,
            "CONFLICT",
            "This record changed on another device. Reload and review your changes.",
          );
      } else {
        const row = validateRow(operation.row);
        if (row.revision === 0) {
          pending.push(row);
        } else {
          const result =
            await sql`UPDATE ${sql(tables[kind])} SET date=${row.date}, category=${row.category}, data=${JSON.stringify(row.data)}::jsonb, revision=revision+1, updated_at=now() WHERE id=${id} AND user_id=${userId} AND revision=${row.revision} RETURNING id`;
          if (!result.length)
            throw new AppError(
              409,
              "CONFLICT",
              "This record changed on another device. Reload and review your changes.",
            );
        }
      }
    }
    await flushInserts();
  } catch (error) {
    if (
      error instanceof Error &&
      "constraint_name" in error &&
      error.constraint_name === "tracker_storage_limit"
    )
      throw new AppError(
        413,
        "STORAGE_LIMIT",
        "Your tracker is limited to 50,000 records and 5 MiB of data. Export and remove records before adding more.",
      );
    throw error;
  }
  // Checklist references are namespaced by this user, just like row IDs.
  // Missing references are allowed because markers outlive deleted records.
}
export function fingerprint(value: unknown): string {
  return new Bun.CryptoHasher("sha256").update(canonical(value)).digest("hex");
}
export async function writeOnce(
  database: Database,
  userId: string,
  key: string,
  body: unknown,
  work: (sql: postgres.TransactionSql) => Promise<void>,
): Promise<{ rows: Row[] }> {
  const result = await database.client.begin(async (sql) => {
    await sql`SELECT pg_advisory_xact_lock(hashtextextended(${userId},0))`;
    const hash = fingerprint(body);
    const [receipt] =
      await sql`SELECT hash FROM mutation_receipts WHERE user_id=${userId} AND key=${key}`;
    if (receipt && receipt.hash !== hash)
      throw new AppError(
        409,
        "IDEMPOTENCY_CONFLICT",
        "This request key was already used for a different operation",
      );
    if (!receipt) {
      await work(sql);
      await sql`INSERT INTO mutation_receipts (user_id,key,hash) VALUES (${userId},${key},${hash})`;
    }
    return { rows: await readRows(sql, userId) };
  });
  return result as { rows: Row[] };
}
