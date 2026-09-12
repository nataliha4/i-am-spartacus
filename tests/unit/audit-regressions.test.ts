import { expect, test } from "bun:test";
import { defaults, validateRow, type Row } from "../../src/shared/model";
import { diffState, project } from "../../src/shared/legacy";
import { prepareImport } from "../../src/shared/import";

test("fast timestamps must fit the tracker calendar, including active fasts", () => {
  for (const startTimestampMs of [Number.MAX_SAFE_INTEGER, 253402300800000]) {
    expect(() =>
      validateRow({
        id: crypto.randomUUID(),
        kind: "fast",
        date: null,
        category: null,
        revision: 0,
        data: { startTimestampMs, endTimestampMs: null, timezone: "UTC" },
      }),
    ).toThrow();
  }
});

test("cross-kind IDs remain distinct when diffing and importing references", () => {
  const id = crypto.randomUUID();
  const rows: Row[] = [
    {
      id,
      kind: "entry",
      date: "2026-09-12",
      category: "supplements",
      revision: 1,
      data: { name: "Lunch supplement" },
    },
    {
      id,
      kind: "schedule",
      date: null,
      category: "supplements",
      revision: 2,
      data: { name: "Daily supplement", time: "09:00", frequency: "daily" },
    },
    {
      id: crypto.randomUUID(),
      kind: "settings",
      date: null,
      category: null,
      revision: 1,
      data: defaults,
    },
    {
      id: crypto.randomUUID(),
      kind: "checklist",
      date: "2026-09-12",
      category: null,
      revision: 1,
      data: { key: `logged-${id}`, done: true, failed: false },
    },
    {
      id: crypto.randomUUID(),
      kind: "checklist",
      date: "2026-09-12",
      category: null,
      revision: 1,
      data: { key: `recurring-${id}`, done: true, failed: false },
    },
  ];
  const state = project(rows);
  expect(diffState(state, state, rows)).toEqual([]);
  const changed = structuredClone(state);
  changed.entries["2026-09-12"].supplements = [];
  expect(diffState(state, changed, rows)).toContainEqual({
    action: "delete",
    kind: "entry",
    id,
    revision: 1,
  });
  const imported = prepareImport(
    { format: "spartacus", version: 1, data: { rows } },
    "UTC",
  );
  expect(imported.issues).toEqual([]);
  const entry = imported.rows.find((row) => row.kind === "entry")!;
  const schedule = imported.rows.find((row) => row.kind === "schedule")!;
  expect(entry.id).not.toBe(schedule.id);
  expect(
    imported.rows
      .filter((row) => row.kind === "checklist")
      .map((row) => row.data.key),
  ).toEqual([`logged-${entry.id}`, `recurring-${schedule.id}`]);
});
