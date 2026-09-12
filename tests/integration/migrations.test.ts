import { expect, test } from "bun:test";
import {
  mkdtemp,
  cp,
  readFile,
  writeFile,
  appendFile,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect } from "../../src/db/connection";
import { migrateDatabase } from "../../scripts/migrate";

test("fresh install, failed upgrade rollback, successful upgrade and checksum drift", async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith("_test"))
    throw new Error(
      "A disposable TEST_DATABASE_URL ending in _test is required",
    );
  const admin = connect(url, 1);
  const name = `migration_${crypto.randomUUID().replaceAll("-", "")}_test`;
  const target = new URL(url);
  target.pathname = `/${name}`;
  const folder = await mkdtemp(join(tmpdir(), "spartacus-migrations-"));
  let database: ReturnType<typeof connect> | undefined;
  try {
    await admin.client`CREATE DATABASE ${admin.client(name)}`;
    database = connect(target.toString(), 1);
    await cp("drizzle", folder, { recursive: true });
    const first = await migrateDatabase(target.toString(), "apply", folder);
    expect(first.applied).toBeGreaterThan(0);
    const journalPath = join(folder, "meta/_journal.json");
    const journal = JSON.parse(await readFile(journalPath, "utf8"));
    const idx = journal.entries.length;
    journal.entries.push({
      idx,
      version: "7",
      when: Date.now(),
      tag: "test_upgrade",
      breakpoints: true,
    });
    await writeFile(journalPath, JSON.stringify(journal));
    const file = join(folder, "test_upgrade.sql");
    await writeFile(
      file,
      "CREATE TABLE rollback_probe (id integer);\n--> statement-breakpoint\nSELECT * FROM deliberately_missing_table;",
    );
    await expect(
      migrateDatabase(target.toString(), "apply", folder),
    ).rejects.toThrow();
    expect(
      (await database.client`SELECT to_regclass('rollback_probe') AS name`)[0]
        .name,
    ).toBeNull();
    expect(
      (await migrateDatabase(target.toString(), "status", folder)).pending,
    ).toBe(1);
    await writeFile(
      file,
      "ALTER TABLE tracking_entries ADD COLUMN upgrade_probe text;",
    );
    const results = await Promise.all([
      migrateDatabase(target.toString(), "apply", folder),
      migrateDatabase(target.toString(), "apply", folder),
    ]);
    expect(
      results.every((result) => result.applied === first.applied + 1),
    ).toBe(true);
    expect(
      (
        await database.client`SELECT count(*)::integer AS count FROM information_schema.columns WHERE table_name='tracking_entries' AND column_name='upgrade_probe'`
      )[0].count,
    ).toBe(1);
    await appendFile(file, "\n-- modified after apply");
    await expect(
      migrateDatabase(target.toString(), "apply", folder),
    ).rejects.toThrow("modified after being applied");
  } finally {
    await database?.client.end();
    await admin.client`DROP DATABASE IF EXISTS ${admin.client(name)} WITH (FORCE)`;
    await admin.client.end();
    await rm(folder, { recursive: true, force: true });
  }
}, 30000);

test("security migration preserves existing data while allowing tenant-scoped IDs", async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith("_test"))
    throw new Error("Disposable TEST_DATABASE_URL ending in _test is required");
  const admin = connect(url, 1);
  const name = `upgrade_${crypto.randomUUID().replaceAll("-", "")}_test`;
  const target = new URL(url);
  target.pathname = `/${name}`;
  const folder = await mkdtemp(join(tmpdir(), "spartacus-prior-release-"));
  let database: ReturnType<typeof connect> | undefined;
  try {
    await admin.client`CREATE DATABASE ${admin.client(name)}`;
    database = connect(target.toString(), 1);
    await cp("drizzle", folder, { recursive: true });
    const journalPath = join(folder, "meta/_journal.json");
    const journal = JSON.parse(await readFile(journalPath, "utf8"));
    journal.entries = journal.entries.slice(0, 1);
    await writeFile(journalPath, JSON.stringify(journal));
    await migrateDatabase(target.toString(), "apply", folder);
    await database.client`INSERT INTO auth_user (id,name,email) VALUES ('owner-a','A','a@example.test'), ('owner-b','B','b@example.test')`;
    const id = crypto.randomUUID();
    await database.client`INSERT INTO tracking_entries (id,user_id,date,category,data) VALUES (${id},'owner-a','2026-09-12','food','{"note":"Before upgrade"}')`;
    await migrateDatabase(target.toString());
    await database.client`INSERT INTO tracking_entries (id,user_id,date,category,data) VALUES (${id},'owner-b','2026-09-12','food','{"note":"Other account"}')`;
    const rows =
      await database.client`SELECT user_id,data FROM tracking_entries WHERE id=${id} ORDER BY user_id`;
    expect(rows).toHaveLength(2);
    expect(rows[0].data.note).toBe("Before upgrade");
    expect(rows[1].data.note).toBe("Other account");
    const usage =
      await database.client`SELECT user_id,row_count,data_bytes FROM tracker_usage ORDER BY user_id`;
    expect(usage.map((row) => row.row_count)).toEqual([1, 1]);
    expect(usage.map((row) => Number(row.data_bytes))).toEqual([
      Buffer.byteLength('{"note": "Before upgrade"}'),
      Buffer.byteLength('{"note": "Other account"}'),
    ]);
    expect(
      (
        await database.client`SELECT registered_users FROM registration_capacity WHERE id=1`
      )[0].registered_users,
    ).toBe(2);
  } finally {
    await database?.client.end();
    await admin.client`DROP DATABASE IF EXISTS ${admin.client(name)} WITH (FORCE)`;
    await admin.client.end();
    await rm(folder, { recursive: true, force: true });
  }
}, 30000);
