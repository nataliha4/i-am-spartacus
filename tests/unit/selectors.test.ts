import { expect, test } from "bun:test";
import { historyItems, symptomFoodContext } from "../../src/shared/selectors";
import type { LegacyState } from "../../src/shared/legacy";
test("history is chronological with untimed entries last and filtering applied", () => {
  const day = {
    food: [
      { id: "1", note: "Lunch", time: "12:00" },
      { id: "2", note: "Untimed" },
    ],
    symptoms: [{ id: "3", symptom: "Headache", level: 3, time: "09:00" }],
  };
  expect(historyItems(day, []).map((item) => item.label)).toEqual([
    "Headache — Level 3/5",
    "Lunch",
    "Untimed",
  ]);
  expect(historyItems(day, ["food"])).toHaveLength(2);
});
test("food context crosses midnight and uses elapsed time across DST", () => {
  const entries: LegacyState["entries"] = {
    "2026-03-07": { food: [{ id: "1", note: "Dinner", time: "23:30" }] },
    "2026-03-08": {
      food: [
        { id: "2", note: "Snack", time: "01:30" },
        { id: "3", note: "No timestamp" },
      ],
      symptoms: [{ id: "4", symptom: "Headache", level: 3, time: "03:30" }],
    },
  };
  const result = symptomFoodContext(
    entries,
    "2026-03-08",
    "2026-03-08",
    4,
    2,
    "America/New_York",
  );
  expect(
    result[0].symptomRows[0].precedingFoods.map((item) => item.diffMin),
  ).toEqual([60, 180]);
  expect(
    symptomFoodContext(
      entries,
      "2026-03-08",
      "2026-03-08",
      4,
      4,
      "America/New_York",
    ),
  ).toEqual([]);
});
