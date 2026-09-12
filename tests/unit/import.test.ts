import { expect, test } from "bun:test";
import { prepareImport } from "../../src/shared/import";
import { project, diffState } from "../../src/shared/legacy";
import { legacyFixture } from "../fixtures/legacy";
test("legacy import preserves all categories, checklist links, settings and active fast", () => {
  const preview = prepareImport(legacyFixture, "America/New_York");
  expect(preview.issues).toEqual([]);
  expect(preview.counts).toEqual({
    settings: 1,
    schedule: 3,
    food: 1,
    symptoms: 1,
    supplements: 1,
    gym: 1,
    medical: 1,
    weight: 1,
    fast: 2,
    checklist: 4,
  });
  expect(preview.warnings).toHaveLength(1);
  const state = project(preview.rows);
  const supplement = Object.values(state.recurringSupps).find(
    (e) => e.name === "Magnesium",
  )!;
  expect(state.entries["2026-09-12"].dueDismissed).toContain(
    `recurring-${supplement.id}`,
  );
  expect(state.activeFast?.startTimestampMs).toBe(
    legacyFixture.data.activeFast.startTimestampMs,
  );
  expect(diffState(state, state, preview.rows)).toEqual([]);
});
test("bad records prevent import instead of being silently dropped", () => {
  const fixture = structuredClone(legacyFixture);
  fixture.data.trackerData["2026-09-12"].symptoms[0].level = 99;
  expect(prepareImport(fixture, "UTC").issues.length).toBeGreaterThan(0);
  expect(prepareImport({ format: "unknown" }, "UTC").issues).toEqual([
    "Unsupported export format or version",
  ]);
});
test("new exports roundtrip with remapped ownership-free identifiers", () => {
  const original = prepareImport(legacyFixture, "America/New_York");
  const restored = prepareImport(
    { format: "spartacus", version: 1, data: { rows: original.rows } },
    "UTC",
  );
  expect(restored.issues).toEqual([]);
  expect(restored.counts).toEqual(original.counts);
  expect(restored.rows[0].id).not.toBe(original.rows[0].id);
});

test("imports stop at the record budget and reject duplicate IDs in either format", () => {
  const fixture = structuredClone(legacyFixture);
  const record = fixture.data.trackerData["2026-09-11"].food[0];
  fixture.data.trackerData["2026-09-11"].food.push({ ...record });
  expect(prepareImport(fixture, "UTC").issues.join(" ")).toContain("duplicate");
  const rows = prepareImport(legacyFixture, "UTC").rows;
  expect(
    prepareImport(
      { format: "spartacus", version: 1, data: { rows: [rows[0], rows[0]] } },
      "UTC",
    ).issues.join(" "),
  ).toContain("duplicate");
  const huge = {
    format: "spartacus-legacy",
    version: 1,
    data: {
      trackerData: {
        "2026-09-12": {
          food: Array.from({ length: 50001 }, (_, id) => ({ id, note: "a" })),
        },
      },
      recurringSupps: {},
      recurringGym: {},
      appSettings: {},
      activeFast: null,
    },
  };
  const result = prepareImport(huge, "UTC");
  expect(result.rows.length).toBeLessThanOrEqual(50000);
  expect(result.issues.join(" ")).toContain("50,000");
});

test("the import budget is enforced across collections as rows are accumulated", () => {
  const entries = Array.from({ length: 25000 }, (_, id) => ({ id, note: "a" }));
  const result = prepareImport(
    {
      format: "spartacus-legacy",
      version: 1,
      data: {
        trackerData: {
          "2026-09-11": { food: entries },
          "2026-09-12": { food: entries },
        },
        recurringSupps: {},
        recurringGym: {},
        appSettings: {},
        activeFast: null,
      },
    },
    "UTC",
  );
  expect(result.rows).toHaveLength(50000);
  expect(result.issues.join(" ")).toContain("50,000");
});
