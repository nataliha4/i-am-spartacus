import { instant } from "./model";
import type { Day, LegacyEntry, LegacyState } from "./legacy";

type HistoryItem = {
  category: string;
  icon: string;
  label: string;
  time: string | null;
  detail: string;
};
const timed = (entry: LegacyEntry) =>
  typeof entry.time === "string" && /^\d{2}:\d{2}$/.test(entry.time);
export function historyItems(day: Day, filters: string[]): HistoryItem[] {
  const result: HistoryItem[] = [];
  const push = (
    category: string,
    icon: string,
    entry: LegacyEntry,
    label: string,
    detail = String(entry.notes ?? ""),
  ) => {
    if (!filters.length || filters.includes(category))
      result.push({
        category,
        icon,
        label,
        detail,
        time: timed(entry) ? String(entry.time) : null,
      });
  };
  for (const [category, icon, field] of [
    ["supplements", "💊", "name"],
    ["food", "🍎", "note"],
    ["gym", "🏋️‍♀️", "activity"],
    ["medical", "⛑️", "event"],
  ] as const) {
    for (const entry of (day[category] ?? []) as LegacyEntry[])
      push(category, icon, entry, String(entry[field]));
  }
  for (const entry of (day.symptoms ?? []) as LegacyEntry[])
    push("symptoms", "🤒", entry, `${entry.symptom} — Level ${entry.level}/5`);
  for (const entry of (day.weight ?? []) as LegacyEntry[])
    push(
      "weight",
      "⚖️",
      entry,
      `Weight: ${entry.weight} kg`,
      entry.target ? `Target: ${entry.target} kg` : "",
    );
  for (const entry of (day.fasting ?? []) as LegacyEntry[])
    push(
      "fasting",
      "⏳",
      { ...entry, time: entry.end },
      `Fasted ${clockLabel(String(entry.start))} – ${clockLabel(String(entry.end))}`,
      "",
    );
  return result.sort((a, b) =>
    a.time && b.time
      ? a.time.localeCompare(b.time)
      : a.time
        ? -1
        : b.time
          ? 1
          : 0,
  );
}
function clockLabel(time: string): string {
  const [hour, minute] = time.split(":").map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
}
export function symptomFoodContext(
  entries: LegacyState["entries"],
  from: string,
  to: string,
  windowHours: number,
  minimumSeverity: number,
  timezone: string,
) {
  const foods = Object.entries(entries).flatMap(([date, day]) =>
    ((day.food ?? []) as LegacyEntry[]).filter(timed).map((food) => ({
      food,
      timestamp: instant(date, String(food.time), timezone),
    })),
  );
  return Object.keys(entries)
    .filter((date) => (!from || date >= from) && (!to || date <= to))
    .sort()
    .reverse()
    .flatMap((date) => {
      const symptoms = ((entries[date].symptoms ?? []) as LegacyEntry[])
        .filter(
          (entry) => timed(entry) && Number(entry.level) >= minimumSeverity,
        )
        .sort((a, b) => String(a.time).localeCompare(String(b.time)));
      if (!symptoms.length) return [];
      return [
        {
          date,
          symptomRows: symptoms.map((symptom) => {
            const timestamp = instant(date, String(symptom.time), timezone);
            return {
              symptom,
              precedingFoods: foods
                .map(({ food, timestamp: foodTime }) => ({
                  food,
                  diffMin: (timestamp - foodTime) / 60000,
                }))
                .filter(
                  (item) =>
                    item.diffMin >= 0 && item.diffMin <= windowHours * 60,
                )
                .sort((a, b) => a.diffMin - b.diffMin),
            };
          }),
        },
      ];
    });
}
