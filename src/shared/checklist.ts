import type { LegacyEntry, LegacyState } from "./legacy";
export function completeChecklist(
  entries: LegacyState["entries"],
  date: string,
  schedule: { id: string; name: unknown },
  category: "supplements" | "gym",
  time: string,
  notes: string,
): LegacyState["entries"] {
  const day = entries[date] ?? {};
  const key = `${category === "gym" ? "recurring-gym" : "recurring"}-${schedule.id}`;
  const dismissed = (day.dueDismissed ?? []) as string[];
  if (dismissed.includes(key)) return entries;
  const id = crypto.randomUUID();
  const log = {
    id,
    [category === "gym" ? "activity" : "name"]: schedule.name,
    time,
    notes: notes || "",
  };
  return {
    ...entries,
    [date]: {
      ...day,
      [category]: [...((day[category] ?? []) as LegacyEntry[]), log],
      dueDismissed: [
        ...dismissed,
        key,
        ...(category === "supplements" ? [`logged-${id}`] : []),
      ],
    },
  };
}
