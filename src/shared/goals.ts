import {
  fastHours,
  instant,
  localDate,
  localTime,
  previousDate,
} from "./model";

export function fastGoal(
  startTimestampMs: number,
  goalHours: number,
  timezone: string,
  now: number,
) {
  const endTimestampMs = startTimestampMs + Math.round(goalHours * 3600000);
  const date = localDate(endTimestampMs, timezone);
  const today = localDate(now, timezone);
  const elapsedHours = fastHours(startTimestampMs, now);
  const goalMet = now >= endTimestampMs;
  return {
    endTimestampMs,
    date,
    time: localTime(endTimestampMs, timezone),
    dayLabel:
      date === today
        ? "today"
        : previousDate(date) === today
          ? "tomorrow"
          : date === previousDate(today)
            ? "yesterday"
            : date,
    elapsedHours,
    percent: goalMet
      ? Math.max(100, Math.floor((elapsedHours / goalHours) * 100))
      : Math.min(99, Math.floor((elapsedHours / goalHours) * 100)),
    goalMet,
    remainingMinutes: goalMet
      ? Math.floor((now - endTimestampMs) / 60000)
      : Math.ceil((endTimestampMs - now) / 60000),
  };
}

export function fastReminder(time: string, timezone: string, now: number) {
  const scheduled = instant(localDate(now, timezone), time, timezone);
  const diffMin = Math.ceil((scheduled - now) / 60000);
  const absMin = Math.abs(diffMin);
  return {
    time: localTime(scheduled, timezone),
    hoursPart: Math.floor(absMin / 60),
    minutesPart: absMin % 60,
    isOverdue: scheduled <= now,
    urgency:
      diffMin <= -60
        ? "red"
        : diffMin <= 0
          ? "yellow"
          : diffMin <= 60
            ? "green"
            : "gray",
  };
}
