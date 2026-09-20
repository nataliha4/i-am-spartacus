import { instant, localDate, previousDate } from "../../src/shared/model";

export const legacyFixture = {
  format: "spartacus-legacy",
  version: 1,
  data: {
    trackerData: {
      "2026-09-11": {
        food: [
          {
            id: 101,
            note: "Dinner",
            time: "23:00",
            notes: "Rice",
            timestamp: "11:00 PM",
          },
        ],
      },
      "2026-09-12": {
        symptoms: [
          {
            id: 101,
            symptom: "Headache",
            level: 3,
            date: "2026-09-12",
            time: "01:00",
            notes: "",
          },
        ],
        supplements: [{ id: 102, name: "Magnesium", time: "08:00", notes: "" }],
        gym: [{ id: 103, activity: "Walk", time: "09:00", notes: "" }],
        medical: [{ id: 104, event: "Checkup", time: "10:00", notes: "" }],
        weight: [{ id: 105, weight: "70.5", target: "68", time: "07:30" }],
        fasting: [
          { id: 106, start: "16:00", end: "08:00", timestamp: "08:00 AM" },
        ],
        dueDismissed: ["recurring-1", "logged-102", "recurring-gym-2"],
        failedRecurring: ["recurring-3"],
      },
    },
    recurringSupps: {
      "1": { id: 1, name: "Magnesium", time: "08:00", frequency: "daily" },
      "3": {
        id: 3,
        name: "Vitamin D",
        time: "12:00",
        frequency: "weekly",
        dayOfWeek: "6",
      },
    },
    recurringGym: {
      "2": { id: 2, name: "Walk", time: "09:00", frequency: "daily" },
    },
    appSettings: {
      targetWeight: "68",
      fastingGoalHours: 16,
      fastingStartTime: "16:00",
    },
    activeFast: {
      startDateKey: "2026-09-12",
      startTime: "16:00",
      startTimestampMs: Date.parse("2026-09-12T20:00:00Z"),
    },
  },
};

// The fixture's 2026-09-11/12 days moved to the two days before today, for
// tests that go through date-windowed UI (e.g. the 7-day Charts range).
export function relativeLegacyFixture(timezone: string) {
  const day = previousDate(localDate(Date.now(), timezone));
  const dayBefore = previousDate(day);
  const fixture = JSON.parse(
    JSON.stringify(legacyFixture)
      .replaceAll("2026-09-12", day)
      .replaceAll("2026-09-11", dayBefore),
  ) as typeof legacyFixture;
  // Keep the weekly supplement on the (moved) day and the fast start at 16:00.
  fixture.data.recurringSupps["3"].dayOfWeek = String(
    new Date(`${day}T00:00:00Z`).getUTCDay(),
  );
  fixture.data.activeFast.startTimestampMs = instant(day, "16:00", timezone);
  return fixture;
}
