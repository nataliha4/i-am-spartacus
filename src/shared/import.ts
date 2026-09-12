import { z } from "zod";
import {
  defaults,
  instant,
  localDate,
  previousDate,
  validateRow,
  type Row,
} from "./model";

export type ImportPreview = {
  rows: Row[];
  counts: Record<string, number>;
  warnings: string[];
  issues: string[];
};
const MAX_IMPORT_RECORDS = 50000;
const limitMessage = "Export exceeds the 50,000 record import limit";
const records = z.array(z.unknown()).max(MAX_IMPORT_RECORDS, limitMessage);
const object = z.record(z.string(), z.unknown());
export function prepareImport(file: unknown, timezone: string): ImportPreview {
  const result: ImportPreview = {
    rows: [],
    counts: {},
    warnings: [],
    issues: [],
  };
  const envelope = z
    .object({
      format: z.enum(["spartacus-legacy", "spartacus"]),
      version: z.literal(1),
      data: z.unknown(),
      exportedAt: z.string().optional(),
    })
    .strict()
    .safeParse(file);
  if (!envelope.success)
    return { ...result, issues: ["Unsupported export format or version"] };
  const ids = new Map<string, string>();
  const remap = (key: string) => {
    if (!ids.has(key)) ids.set(key, crypto.randomUUID());
    return ids.get(key)!;
  };
  let attempted = 0;
  const seen = new Set<string>();
  const add = (row: Row, label: string) => {
    if (++attempted > MAX_IMPORT_RECORDS) throw new Error(limitMessage);
    if (result.issues.length >= 100)
      throw new Error("Too many invalid records");
    const key = `${row.kind}:${row.id}`;
    if (seen.has(key)) throw new Error(`${label}: duplicate record ID`);
    seen.add(key);
    try {
      result.rows.push(validateRow(row));
      result.counts[row.kind === "entry" ? row.category! : row.kind] =
        (result.counts[row.kind === "entry" ? row.category! : row.kind] ?? 0) +
        1;
    } catch (error) {
      result.issues.push(
        `${label}: ${error instanceof z.ZodError ? error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") : "Invalid record"}`,
      );
    }
  };
  try {
    if (envelope.data.format === "spartacus") {
      const rows = z
        .object({ rows: records })
        .strict()
        .parse(envelope.data.data).rows;
      for (const value of rows) {
        const row = validateRow(value as Row);
        const data = { ...row.data };
        if (row.kind === "checklist")
          data.key = String(data.key).replace(/[0-9a-f-]{36}$/, (old) =>
            remap(old),
          );
        add({ ...row, id: remap(row.id), revision: 0, data }, row.kind);
      }
    } else {
      const data = z
        .object({
          trackerData: object,
          recurringSupps: object,
          recurringGym: object,
          appSettings: object,
          activeFast: object.nullable(),
        })
        .strict()
        .parse(envelope.data.data);
      add(
        {
          id: remap("settings"),
          kind: "settings",
          date: null,
          category: null,
          data: { ...defaults, ...data.appSettings, timezone },
          revision: 0,
        },
        "Settings",
      );
      for (const [category, values] of [
        ["supplements", data.recurringSupps],
        ["gym", data.recurringGym],
      ] as const) {
        for (const [key, value] of Object.entries(values)) {
          const record = object.parse(value);
          const { id: _id, ...fields } = record;
          add(
            {
              id: remap(`schedule:${category}:${key}`),
              kind: "schedule",
              date: null,
              category,
              revision: 0,
              data: { frequency: "daily", ...fields },
            },
            `Schedule ${key}`,
          );
        }
      }
      for (const [date, value] of Object.entries(data.trackerData)) {
        const day = object.parse(value);
        for (const [category, values] of Object.entries(day)) {
          if (["dueDismissed", "failedRecurring"].includes(category)) continue;
          for (const value of records.parse(values)) {
            const { id: oldId, ...fields } = object.parse(value);
            if (typeof oldId !== "string" && typeof oldId !== "number")
              throw new Error(`${date}/${category}: missing legacy ID`);
            // Legacy Date.now IDs can collide across dates and categories.
            const id = remap(`entry:${date}:${category}:${oldId}`);
            if (category === "fasting") {
              const start = z.string().parse(fields.start),
                end = z.string().parse(fields.end);
              const startDate = start > end ? previousDate(date) : date;
              add(
                {
                  id,
                  kind: "fast",
                  date,
                  category: null,
                  revision: 0,
                  data: {
                    startTimestampMs: instant(startDate, start, timezone),
                    endTimestampMs: instant(date, end, timezone),
                    timezone,
                    inferred: true,
                  },
                },
                `Fast ${date}`,
              );
              if (
                Object.keys(fields).some(
                  (key) => !["start", "end", "timestamp"].includes(key),
                )
              )
                result.issues.push(`Fast ${date}: unknown legacy fields`);
            } else
              add(
                {
                  id,
                  kind: "entry",
                  date,
                  category,
                  revision: 0,
                  data: fields,
                },
                `${date}/${category}`,
              );
          }
        }
        const done = new Set(z.array(z.string()).parse(day.dueDismissed ?? []));
        const failed = new Set(
          z.array(z.string()).parse(day.failedRecurring ?? []),
        );
        for (const key of new Set([...done, ...failed])) {
          let reference: string;
          if (key.startsWith("recurring-gym-"))
            reference = `recurring-gym-${remap(`schedule:gym:${key.slice(14)}`)}`;
          else if (key.startsWith("recurring-"))
            reference = `recurring-${remap(`schedule:supplements:${key.slice(10)}`)}`;
          else if (key.startsWith("logged-"))
            reference = `logged-${remap(`entry:${date}:supplements:${key.slice(7)}`)}`;
          else throw new Error(`Unrecognized checklist marker: ${key}`);
          add(
            {
              id: remap(`checklist:${date}:${key}`),
              kind: "checklist",
              date,
              category: null,
              revision: 0,
              data: {
                key: reference,
                done: done.has(key),
                failed: failed.has(key),
              },
            },
            `Checklist ${date}`,
          );
        }
      }
      if (data.activeFast) {
        const start = z.number().int().parse(data.activeFast.startTimestampMs);
        add(
          {
            id: remap("activeFast"),
            kind: "fast",
            date: null,
            category: null,
            revision: 0,
            data: { startTimestampMs: start, endTimestampMs: null, timezone },
          },
          "Active fast",
        );
        if (data.activeFast.startDateKey !== localDate(start, timezone))
          result.warnings.push(
            "The active fast date differs in the selected timezone; its original timestamp is preserved.",
          );
      }
      if (result.rows.some((row) => row.data.inferred))
        result.warnings.push(
          "Completed legacy fast dates are inferred using the original same-day/previous-day rule. Historical multi-day durations cannot be recovered.",
        );
    }
    if (result.rows.filter((row) => row.kind === "settings").length > 1)
      throw new Error("An export must contain at most one settings record");
    if (
      result.rows.filter(
        (row) => row.kind === "fast" && row.data.endTimestampMs === null,
      ).length > 1
    )
      throw new Error("An export must contain at most one active fast");
  } catch (error) {
    result.issues.push(
      error instanceof z.ZodError
        ? error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; ")
        : String(error instanceof Error ? error.message : error),
    );
  }
  return result;
}
