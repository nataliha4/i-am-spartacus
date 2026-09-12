import { expect, test } from "bun:test";
import { completeChecklist } from "../../src/shared/checklist";
test("a confirmation left open during another device completion does not duplicate its log", () => {
  const schedule = { id: crypto.randomUUID(), name: "Vitamin D" };
  const first = completeChecklist(
    {},
    "2026-09-12",
    schedule,
    "supplements",
    "08:00",
    "",
  );
  const second = completeChecklist(
    first,
    "2026-09-12",
    schedule,
    "supplements",
    "08:15",
    "",
  );
  expect(second).toBe(first);
  expect(second["2026-09-12"].supplements).toHaveLength(1);
  expect(second["2026-09-12"].dueDismissed).toHaveLength(2);
});
