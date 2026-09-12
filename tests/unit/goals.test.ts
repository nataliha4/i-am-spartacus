import { expect, test } from "bun:test";
import { fastGoal, fastReminder } from "../../src/shared/goals";
import { instant } from "../../src/shared/model";
import { latestWeight } from "../../src/shared/selectors";

test("fasting goals use elapsed hours through both daylight-saving transitions", () => {
  const timezone = "America/New_York";
  for (const [date, endDate, time] of [
    ["2026-03-07", "2026-03-08", "09:00"],
    ["2026-10-31", "2026-11-01", "07:00"],
  ]) {
    const start = instant(date, "16:00", timezone);
    const goal = fastGoal(start, 16, timezone, start);
    expect(goal.date).toBe(endDate);
    expect(goal.time).toBe(time);
    expect(goal.dayLabel).toBe("tomorrow");
    expect(goal.endTimestampMs - start).toBe(16 * 3600000);
  }
});

test("goal completion is exact, clamps future starts, and handles fractional goals", () => {
  const start = instant("2026-09-12", "16:00", "UTC");
  const end = start + 16 * 3600000;
  expect(fastGoal(start, 16, "UTC", end - 1)).toMatchObject({
    percent: 99,
    goalMet: false,
    remainingMinutes: 1,
  });
  expect(fastGoal(start, 16, "UTC", end)).toMatchObject({
    percent: 100,
    goalMet: true,
    remainingMinutes: 0,
  });
  expect(fastGoal(start, 16, "UTC", end + 60000)).toMatchObject({
    goalMet: true,
    remainingMinutes: 1,
  });
  expect(fastGoal(start, 16, "UTC", start - 60000)).toMatchObject({
    percent: 0,
    elapsedHours: 0,
  });
  expect(fastGoal(start, 1.1, "UTC", start).time).toBe("17:06");
});

test("fasting target labels follow the actual calendar day, including long and overdue fasts", () => {
  const start = instant("2026-09-10", "16:00", "UTC");
  expect(fastGoal(start, 48, "UTC", start).dayLabel).toBe("2026-09-12");
  expect(
    fastGoal(start, 48, "UTC", instant("2026-09-12", "12:00", "UTC")).dayLabel,
  ).toBe("today");
  expect(
    fastGoal(start, 48, "UTC", instant("2026-09-13", "12:00", "UTC")).dayLabel,
  ).toBe("yesterday");
  expect(fastGoal(start, 168, "UTC", start).date).toBe("2026-09-17");
});

test("weight goal and charts choose the latest timed reading regardless of row order", () => {
  const early = { id: "early", time: "08:00", weight: 70 };
  const late = { id: "late", time: "20:00", weight: 69 };
  const untimed = { id: "untimed", weight: 72 };
  expect(latestWeight([late, early, untimed])).toEqual(late);
  expect(latestWeight([untimed, early, late])).toEqual(late);
  expect(latestWeight([untimed])).toEqual(untimed);
  expect(latestWeight([])).toBeUndefined();
});

test("daily fasting reminders count elapsed time across DST and respect the tracker timezone", () => {
  const timezone = "America/New_York";
  expect(
    fastReminder("03:30", timezone, instant("2026-03-08", "01:30", timezone)),
  ).toMatchObject({ hoursPart: 1, minutesPart: 0, isOverdue: false });
  expect(
    fastReminder("02:30", timezone, instant("2026-11-01", "00:30", timezone)),
  ).toMatchObject({ hoursPart: 3, minutesPart: 0, isOverdue: false });
  expect(
    fastReminder("16:00", timezone, instant("2026-09-12", "17:30", timezone)),
  ).toMatchObject({ hoursPart: 1, minutesPart: 30, isOverdue: true });
});
