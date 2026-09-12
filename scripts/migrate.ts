import { readMigrationFiles } from "drizzle-orm/migrator";
import { connect } from "../src/db/connection";

export async function migrateDatabase(
  url: string,
  mode: "apply" | "status" = "apply",
  migrationsFolder = "drizzle",
) {
  const database = connect(url, 1);
  const connection = await database.client.reserve();
  try {
    const migrations = readMigrationFiles({ migrationsFolder });
    if (mode === "apply") {
      await connection`SELECT pg_advisory_lock(731802514)`;
      await connection`CREATE TABLE IF NOT EXISTS app_schema_migrations (id integer PRIMARY KEY, hash text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`;
    }
    const [exists] =
      await connection`SELECT to_regclass('app_schema_migrations') AS name`;
    const applied = exists.name
      ? await connection`SELECT id,hash FROM app_schema_migrations ORDER BY id`
      : [];
    if (applied.length > migrations.length)
      throw new Error("Database schema is newer than this release");
    for (let i = 0; i < applied.length; i++)
      if (applied[i].id !== i || applied[i].hash !== migrations[i].hash)
        throw new Error(
          `Migration ${i} was modified after being applied; restore it and create a new migration`,
        );
    if (mode === "apply")
      for (let i = applied.length; i < migrations.length; i++) {
        await connection`BEGIN`;
        try {
          for (const statement of migrations[i].sql)
            if (statement.trim()) await connection.unsafe(statement);
          await connection`INSERT INTO app_schema_migrations (id,hash) VALUES (${i},${migrations[i].hash})`;
          await connection`COMMIT`;
        } catch (error) {
          await connection`ROLLBACK`;
          throw error;
        }
        console.info(`Applied migration ${i}`);
      }
    const pending = migrations.length - applied.length;
    if (mode === "status")
      console.info(JSON.stringify({ applied: applied.length, pending }));
    return {
      applied: mode === "apply" ? migrations.length : applied.length,
      pending: mode === "apply" ? 0 : pending,
    };
  } finally {
    if (mode === "apply")
      await connection`SELECT pg_advisory_unlock(731802514)`.catch(() => {});
    connection.release();
    await database.client.end({ timeout: 5 });
  }
}
if (import.meta.main) {
  const mode = process.argv[2] ?? "apply";
  if (!["apply", "status"].includes(mode))
    throw new Error("Usage: bun scripts/migrate.ts apply|status");
  await migrateDatabase(
    process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL ?? "",
    mode as "apply" | "status",
  );
}
