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
          { id: 101, symptom: "Headache", level: 3, time: "01:00", notes: "" },
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
