import { expect, test } from "bun:test";
import { canonical, validateRow } from "../../src/shared/model";

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
