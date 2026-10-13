// One-time backfill: adds the ⌛/🥕 icon prefixes (introduced after these
// notes were written) to existing symptom entries' auto-generated
// "Fasting for ..." / "... since last meal" lines. Safe to re-run — an
// already-prefixed line no longer matches, so nothing changes on a second
// pass. Pass --dry-run to preview without writing.
import { connect } from "../src/db/connection";

const dryRun = process.argv.includes("--dry-run");
const FASTING_LINE = /^Fasting for \d+h \d+m$/;
const MEAL_LINE = /^\d+h \d+m since last meal$/;

function addIcons(notes: string): string {
  return notes
    .split("\n")
    .map((line) => {
      if (FASTING_LINE.test(line)) return `⌛ ${line}`;
      if (MEAL_LINE.test(line)) return `🥕 ${line}`;
      return line;
    })
    .join("\n");
}

const database = connect(process.env.DATABASE_URL ?? "", 1);
try {
  const rows = await database.client`
    SELECT id, user_id, revision, data
    FROM tracking_entries
    WHERE category = 'symptoms' AND data ? 'notes' AND data->>'notes' <> ''
  `;
  let updated = 0,
    conflicted = 0;
  for (const row of rows) {
    const notes = String(row.data.notes ?? "");
    const next = addIcons(notes);
    if (next === notes) continue;
    if (dryRun) {
      console.info(
        `[dry-run] ${row.id}: ${JSON.stringify(notes)} -> ${JSON.stringify(next)}`,
      );
      updated++;
      continue;
    }
    const nextData = { ...row.data, notes: next };
    const result = await database.client`
      UPDATE tracking_entries
      SET data = ${JSON.stringify(nextData)}::jsonb, revision = revision + 1, updated_at = now()
      WHERE id = ${row.id} AND user_id = ${row.user_id} AND revision = ${row.revision}
      RETURNING id
    `;
    if (result.length) updated++;
    else conflicted++;
  }
  console.info(
    JSON.stringify({ scanned: rows.length, updated, conflicted, dryRun }),
  );
} finally {
  await database.client.end({ timeout: 5 });
}
