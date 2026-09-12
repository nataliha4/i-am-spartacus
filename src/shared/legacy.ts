import {
  canonical,
  categories,
  defaults,
  instant,
  localDate,
  localTime,
  previousDate,
  validateRow,
  type Operation,
  type Row,
} from "./model";

export type LegacyEntry = Record<string, unknown> & { id: string };
export type Day = Record<string, LegacyEntry[] | string[]>;
export type LegacyState = {
  entries: Record<string, Day>;
  recurringSupps: Record<string, LegacyEntry>;
  recurringGym: Record<string, LegacyEntry>;
  appSettings: Record<string, unknown>;
  activeFast: (Record<string, unknown> & { id: string }) | null;
};
export function project(rows: Row[], timezone = "UTC"): LegacyState {
  const state: LegacyState = {
    entries: {},
    recurringSupps: {},
    recurringGym: {},
    appSettings: { ...defaults, timezone },
    activeFast: null,
  };
  for (const row of rows) {
    if (row.kind === "settings")
      state.appSettings = { ...row.data, _revision: row.revision };
    if (row.kind === "schedule")
      (row.category === "gym" ? state.recurringGym : state.recurringSupps)[
        row.id
      ] = { ...row.data, id: row.id, _revision: row.revision };
    if (row.kind === "entry") {
      const day = (state.entries[row.date!] ??= {});
      (day[row.category!] ??= []).push({
        ...row.data,
        id: row.id,
        _revision: row.revision,
      } as never);
    }
    if (row.kind === "checklist") {
      const day = (state.entries[row.date!] ??= {});
      if (row.data.done)
        (day.dueDismissed ??= []).push(String(row.data.key) as never);
      if (row.data.failed)
        (day.failedRecurring ??= []).push(String(row.data.key) as never);
    }
    if (row.kind === "fast") {
      const start = Number(row.data.startTimestampMs),
        tz = String(row.data.timezone);
      if (row.data.endTimestampMs === null)
        state.activeFast = {
          ...row.data,
          id: row.id,
          _revision: row.revision,
          startDateKey: localDate(start, tz),
          startTime: localTime(start, tz),
        };
      else {
        const end = Number(row.data.endTimestampMs),
          day = (state.entries[row.date!] ??= {});
        (day.fasting ??= []).push({
          ...row.data,
          start: localTime(start, tz),
          end: localTime(end, tz),
          id: row.id,
          _revision: row.revision,
        } as never);
      }
    }
  }
  return state;
}

/** Converts the old view model into row-level operations; unchanged records never get written. */
export function diffState(
  before: LegacyState,
  after: LegacyState,
  rows: Row[],
): Operation[] {
  const wanted: Row[] = [];
  const existing = new Map(rows.map((row) => [row.id, row]));
  const put = (
    kind: Row["kind"],
    id: string,
    date: string | null,
    category: string | null,
    data: Record<string, unknown>,
    revision?: unknown,
  ) =>
    wanted.push(
      validateRow({
        id,
        kind,
        date,
        category,
        data,
        revision: Number(revision ?? existing.get(id)?.revision ?? 0),
      }),
    );
  for (const [date, day] of Object.entries(after.entries)) {
    for (const category of categories)
      for (const entry of (day[category] ?? []) as LegacyEntry[]) {
        const { id, _revision, ...data } = entry;
        put("entry", id, date, category, data, _revision);
      }
    for (const entry of (day.fasting ?? []) as LegacyEntry[]) {
      const tz = String(entry.timezone ?? after.appSettings.timezone);
      const old = ((before.entries[date]?.fasting ?? []) as LegacyEntry[]).find(
        (e) => e.id === entry.id,
      );
      const startDate =
        entry.startTimestampMs === undefined
          ? String(entry.start) > String(entry.end)
            ? previousDate(date)
            : date
          : localDate(Number(entry.startTimestampMs), tz);
      const start =
        old?.start === entry.start && entry.startTimestampMs !== undefined
          ? Number(entry.startTimestampMs)
          : instant(startDate, String(entry.start), tz);
      const end =
        old?.end === entry.end && entry.endTimestampMs !== undefined
          ? Number(entry.endTimestampMs)
          : instant(date, String(entry.end), tz);
      put(
        "fast",
        entry.id,
        date,
        null,
        {
          startTimestampMs: start,
          endTimestampMs: end,
          timezone: tz,
          ...(entry.inferred === undefined ? {} : { inferred: entry.inferred }),
        },
        entry._revision,
      );
    }
    const done = new Set((day.dueDismissed ?? []) as string[]),
      failed = new Set((day.failedRecurring ?? []) as string[]);
    for (const key of new Set([...done, ...failed])) {
      const old = rows.find(
        (row) =>
          row.kind === "checklist" && row.date === date && row.data.key === key,
      );
      put("checklist", old?.id ?? crypto.randomUUID(), date, null, {
        key,
        done: done.has(key),
        failed: failed.has(key),
      });
    }
  }
  for (const [category, schedules] of [
    ["supplements", after.recurringSupps],
    ["gym", after.recurringGym],
  ] as const) {
    for (const entry of Object.values(schedules)) {
      const { id, _revision, ...data } = entry;
      put("schedule", id, null, category, data, _revision);
    }
  }
  const settings = rows.find((row) => row.kind === "settings");
  if (
    settings ||
    canonical(after.appSettings) !== canonical(before.appSettings)
  ) {
    const { _revision, ...data } = after.appSettings;
    put(
      "settings",
      settings?.id ?? crypto.randomUUID(),
      null,
      null,
      data,
      _revision,
    );
  }
  if (after.activeFast) {
    const fast = after.activeFast;
    put(
      "fast",
      fast.id,
      null,
      null,
      {
        startTimestampMs: fast.startTimestampMs,
        endTimestampMs: null,
        timezone: fast.timezone ?? after.appSettings.timezone,
      },
      fast._revision,
    );
  }
  const ids = new Set(wanted.map((row) => row.id));
  const operations: Operation[] = [];
  for (const row of wanted) {
    const old = existing.get(row.id);
    if (!old || canonical(old) !== canonical(row))
      operations.push({ action: "put", row });
  }
  for (const row of rows)
    if (!ids.has(row.id))
      operations.push({
        action: "delete",
        kind: row.kind,
        id: row.id,
        revision: row.revision,
      });
  // Persist the detected timezone with the first tracker write, while leaving a new account empty for import.
  if (
    operations.length &&
    !settings &&
    !operations.some((op) => op.action === "put" && op.row.kind === "settings")
  ) {
    const { _revision: _ignored, ...data } = after.appSettings;
    operations.push({
      action: "put",
      row: validateRow({
        id: crypto.randomUUID(),
        kind: "settings",
        date: null,
        category: null,
        data,
        revision: 0,
      }),
    });
  }
  return operations;
}
