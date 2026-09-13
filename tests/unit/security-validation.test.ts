import { expect, test } from "bun:test";
import {
  MAX_REPORTED_ISSUES,
  canonical,
  commitSchema,
  formatIssues,
  settingsSchema,
  validateRow,
} from "../../src/shared/model";
import { prepareImport } from "../../src/shared/import";

test("fingerprints reject deeply nested input with a bounded validation error", () => {
  const nested = JSON.parse("[".repeat(5000) + "0" + "]".repeat(5000));
  expect(() => canonical(nested)).toThrow("nesting limit");
  expect(canonical({ b: [1, { z: true }], a: "ok" })).toBe(
    '{"a":"ok","b":[1,{"z":true}]}',
  );
});
test("checklist keys require a real UUID", () => {
  const row = {
    id: crypto.randomUUID(),
    kind: "checklist" as const,
    date: "2026-09-12",
    category: null,
    revision: 0,
    data: { key: `logged-${"-".repeat(36)}`, done: true, failed: false },
  };
  expect(() => validateRow(row)).toThrow();
  row.data.key = `recurring-gym-${crypto.randomUUID()}`;
  expect(validateRow(row).data.key).toBe(row.data.key);
});

test("oversized collections are rejected before their contents are validated", () => {
  // An operation list far past the cap, sized like a body at the 4 MiB limit.
  // Validating first would emit one issue per element and a response many
  // times larger than the request.
  const operations = Array.from({ length: 246_722 }, () => ({
    action: "put",
    row: {},
  }));
  const result = commitSchema.safeParse({ operations });
  expect(result.success).toBe(false);
  expect(result.error!.issues).toHaveLength(1);
  expect(result.error!.issues[0].code).toBe("too_big");
  expect(formatIssues(result.error!).length).toBeLessThan(200);
  // A list within the cap is still validated element by element.
  const invalid = commitSchema.safeParse({ operations: [{ action: "put" }] });
  expect(invalid.success).toBe(false);
  expect(invalid.error!.issues.length).toBeGreaterThan(0);
});

test("validation messages stay bounded when every element is rejected", () => {
  const result = commitSchema.safeParse({
    operations: Array.from({ length: 1000 }, () => ({ action: "put" })),
  });
  expect(result.success).toBe(false);
  expect(result.error!.issues.length).toBeGreaterThan(MAX_REPORTED_ISSUES);
  const message = formatIssues(result.error!);
  expect(message.length).toBeLessThan(4096);
  expect(message).toContain("more problems");
});

test("legacy checklist markers are length-bounded before element validation", () => {
  const file = {
    format: "spartacus-legacy",
    version: 1,
    data: {
      trackerData: {
        "2026-09-12": {
          dueDismissed: Array.from({ length: 400_000 }, (_, i) => i),
        },
      },
      recurringSupps: {},
      recurringGym: {},
      appSettings: {},
      activeFast: null,
    },
  };
  const preview = prepareImport(file, "UTC");
  expect(preview.issues.length).toBeGreaterThan(0);
  expect(preview.issues.join("\n").length).toBeLessThan(4096);
});

test("timezone names are capped before zone resolution is attempted", () => {
  const oversized = "A".repeat(4 * 1024 * 1024);
  const started = performance.now();
  const result = settingsSchema.shape.timezone.safeParse(oversized);
  const elapsed = performance.now() - started;
  expect(result.success).toBe(false);
  // Resolving the string instead of rejecting it costs hundreds of ms.
  expect(elapsed).toBeLessThan(50);
  expect(settingsSchema.shape.timezone.safeParse("Europe/Berlin").success).toBe(
    true,
  );
  expect(settingsSchema.shape.timezone.safeParse("Not/AZone").success).toBe(
    false,
  );
});
