import { z } from "zod";
import { Temporal } from "@js-temporal/polyfill";

export const kinds = [
  "entry",
  "schedule",
  "checklist",
  "settings",
  "fast",
] as const;
export const categories = [
  "supplements",
  "symptoms",
  "food",
  "gym",
  "medical",
  "weight",
] as const;
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    try {
      Temporal.PlainDate.from(value);
      return true;
    } catch {
      return false;
    }
  }, "Invalid calendar date");
export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const text = z.string().max(10000);
const optionalTime = z
  .union([timeSchema, z.literal(""), z.literal("No time set")])
  .optional();
const positive = z.coerce.number().positive().max(1000);
export const settingsSchema = z
  .object({
    targetWeight: z.union([positive, z.literal("")]),
    fastingGoalHours: z.coerce.number().positive().max(168),
    fastingStartTime: timeSchema,
    // Piped so the length check short-circuits: chaining .refine() after
    // .max() still runs the refinement, and resolving a multi-megabyte zone
    // name costs hundreds of milliseconds of blocking CPU. Longest real IANA
    // identifier is well under this bound.
    timezone: z
      .string()
      .max(64)
      .pipe(
        z.string().refine((value) => {
          try {
            Temporal.Now.zonedDateTimeISO(value);
            return true;
          } catch {
            return false;
          }
        }, "Invalid timezone"),
      ),
  })
  .strict();
export const defaults = {
  targetWeight: "",
  fastingGoalHours: 16,
  fastingStartTime: "16:00",
  timezone: "UTC",
};
const entrySchemas = {
  supplements: z
    .object({
      name: text.min(1),
      time: optionalTime,
      notes: text.optional(),
      timestamp: text.optional(),
    })
    .strict(),
  symptoms: z
    .object({
      symptom: text.min(1),
      level: z.coerce.number().int().min(1).max(5),
      time: optionalTime,
      notes: text.optional(),
      timestamp: text.optional(),
    })
    .strict(),
  food: z
    .object({
      note: text.min(1),
      time: optionalTime,
      notes: text.optional(),
      timestamp: text.optional(),
    })
    .strict(),
  gym: z
    .object({
      activity: text.min(1),
      time: optionalTime,
      notes: text.optional(),
      timestamp: text.optional(),
    })
    .strict(),
  medical: z
    .object({
      event: text.min(1),
      time: optionalTime,
      notes: text.optional(),
      timestamp: text.optional(),
    })
    .strict(),
  weight: z
    .object({
      weight: positive,
      target: z.union([positive, z.literal("")]).optional(),
      time: optionalTime,
      timestamp: text.optional(),
    })
    .strict(),
};
export const scheduleSchema = z
  .object({
    name: text.min(1),
    time: timeSchema,
    frequency: z.enum(["daily", "weekly"]),
    dayOfWeek: z.coerce.number().int().min(0).max(6).optional(),
  })
  .strict()
  .refine(
    (v) => v.frequency !== "weekly" || v.dayOfWeek !== undefined,
    "Weekly schedules require a weekday",
  );
export const fastSchema = z
  .object({
    startTimestampMs: z.number().int().nonnegative(),
    endTimestampMs: z.number().int().nonnegative().nullable(),
    timezone: settingsSchema.shape.timezone,
    inferred: z.boolean().optional(),
  })
  .strict()
  .refine((v) => {
    try {
      dateSchema.parse(localDate(v.startTimestampMs, v.timezone));
      if (v.endTimestampMs !== null)
        dateSchema.parse(localDate(v.endTimestampMs, v.timezone));
      return true;
    } catch {
      return false;
    }
  }, "Fast timestamps must fit the tracker calendar")
  .refine(
    (v) => v.endTimestampMs === null || v.endTimestampMs >= v.startTimestampMs,
    "Fast must end after it starts",
  );
export const rowSchema = z
  .object({
    id: z.uuid(),
    kind: z.enum(kinds),
    date: dateSchema.nullable(),
    category: z.string().max(32).nullable(),
    data: z.record(z.string(), z.unknown()),
    revision: z.number().int().nonnegative(),
  })
  .strict();
export type Row = z.infer<typeof rowSchema>;
export type Kind = Row["kind"];
export const operationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("put"), row: rowSchema }).strict(),
  z
    .object({
      action: z.literal("delete"),
      kind: z.enum(kinds),
      id: z.uuid(),
      revision: z.number().int().positive(),
    })
    .strict(),
]);
export type Operation = z.infer<typeof operationSchema>;
// Bound the collection before validating its contents. Zod applies array
// length checks after parsing every element, so validating first lets an
// in-limit body allocate an issue per rejected operation.
export const commitSchema = z
  .object({
    operations: z
      .array(z.unknown())
      .min(1)
      .max(1000)
      .pipe(z.array(operationSchema)),
  })
  .strict();
export type Snapshot = { rows: Row[] };

export function validateRow(input: Row): Row {
  const row = rowSchema.parse(input);
  let data: Record<string, unknown>;
  switch (row.kind) {
    case "entry": {
      const category = z.enum(categories).parse(row.category);
      dateSchema.parse(row.date);
      data = entrySchemas[category].parse(row.data);
      break;
    }
    case "schedule":
      z.enum(["supplements", "gym"]).parse(row.category);
      z.null().parse(row.date);
      data = scheduleSchema.parse(row.data);
      break;
    case "checklist":
      dateSchema.parse(row.date);
      z.null().parse(row.category);
      data = z
        .object({
          key: z
            .string()
            .refine(
              (key) =>
                /^(recurring-gym|recurring|logged)-/.test(key) &&
                z
                  .uuid()
                  .safeParse(
                    key.replace(/^(recurring-gym|recurring|logged)-/, ""),
                  ).success,
              "Checklist key must end in a UUID",
            ),
          done: z.boolean(),
          failed: z.boolean(),
        })
        .strict()
        .parse(row.data);
      break;
    case "settings":
      z.null().parse(row.date);
      z.null().parse(row.category);
      data = settingsSchema.parse(row.data);
      break;
    case "fast":
      z.null().parse(row.category);
      data = fastSchema.parse(row.data);
      row.date =
        data.endTimestampMs === null
          ? null
          : localDate(Number(data.endTimestampMs), String(data.timezone));
      break;
  }
  return { ...row, data };
}

export function localDate(ms: number, timezone: string): string {
  return Temporal.Instant.fromEpochMilliseconds(ms)
    .toZonedDateTimeISO(timezone)
    .toPlainDate()
    .toString();
}
export function localTime(ms: number, timezone: string): string {
  return Temporal.Instant.fromEpochMilliseconds(ms)
    .toZonedDateTimeISO(timezone)
    .toPlainTime()
    .toString()
    .slice(0, 5);
}
export function instant(date: string, time: string, timezone: string): number {
  return Temporal.PlainDate.from(date)
    .toPlainDateTime(Temporal.PlainTime.from(time))
    .toZonedDateTime(timezone, { disambiguation: "compatible" })
    .epochMilliseconds;
}
export function previousDate(date: string): string {
  return Temporal.PlainDate.from(date).subtract({ days: 1 }).toString();
}
export function fastHours(start: number, end: number): number {
  return Math.max(0, end - start) / 3600000;
}
export function scheduledOn(
  schedule: { frequency?: string; dayOfWeek?: string | number },
  date: string,
): boolean {
  return (
    schedule.frequency !== "weekly" ||
    Temporal.PlainDate.from(date).dayOfWeek % 7 === Number(schedule.dayOfWeek)
  );
}
/** Formats a bounded prefix of a validation failure. A rejected collection can
 * carry one issue per element, so the joined text is never allowed to scale
 * with the request. */
export const MAX_REPORTED_ISSUES = 20;
export function formatIssues(error: z.ZodError): string {
  const shown = error.issues
    .slice(0, MAX_REPORTED_ISSUES)
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  const hidden = error.issues.length - MAX_REPORTED_ISSUES;
  return hidden > 0 ? `${shown}; and ${hidden} more problems` : shown;
}
export class JsonDepthError extends Error {}
export function canonical(value: unknown, depth = 0): string {
  if (depth > 32)
    throw new JsonDepthError("JSON exceeds the 32-level nesting limit");
  if (Array.isArray(value))
    return `[${value.map((v) => canonical(v, depth + 1)).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v, depth + 1)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
