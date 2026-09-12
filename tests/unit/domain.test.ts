import { describe, expect, test } from "bun:test";
import {
  fastHours,
  instant,
  localDate,
  scheduledOn,
  validateRow,
} from "../../src/shared/model";
import { diffState, project } from "../../src/shared/legacy";
describe("calendar and tracking behavior", () => {
  test("calendar dates are local and weekly schedules use Sunday=0", () => {
    expect(
      localDate(Date.parse("2026-09-13T01:00:00Z"), "America/New_York"),
    ).toBe("2026-09-12");
    expect(
      scheduledOn({ frequency: "weekly", dayOfWeek: 0 }, "2026-09-13"),
    ).toBe(true);
    expect(
      scheduledOn({ frequency: "weekly", dayOfWeek: 0 }, "2026-09-12"),
    ).toBe(false);
  });
  test("fasts preserve multi-day duration and DST elapsed time", () => {
    expect(
      fastHours(
        instant("2026-03-07", "16:00", "America/New_York"),
        instant("2026-03-08", "12:00", "America/New_York"),
      ),
    ).toBe(19);
    expect(
      fastHours(
        instant("2026-09-10", "16:00", "UTC"),
        instant("2026-09-12", "12:00", "UTC"),
      ),
    ).toBe(44);
  });
  test("empty and invalid fields are validated at the boundary", () => {
    expect(() =>
      validateRow({
        id: crypto.randomUUID(),
        kind: "entry",
        date: "2026-02-30",
        category: "food",
        revision: 0,
        data: { note: "Lunch" },
      }),
    ).toThrow();
    expect(() =>
      validateRow({
        id: crypto.randomUUID(),
        kind: "entry",
        date: "2026-09-12",
        category: "symptoms",
        revision: 0,
        data: { symptom: "Headache", level: 9 },
      }),
    ).toThrow();
  });
  test("a projection roundtrip does not write unchanged rows", () => {
    const rows = [
      validateRow({
        id: crypto.randomUUID(),
        kind: "entry",
        date: "2026-09-12",
        category: "food",
        revision: 1,
        data: { note: "Lunch", time: "12:00" },
      }),
    ];
    const state = project(rows);
    expect(diffState(state, state, rows)).toEqual([]);
    const changed = structuredClone(state);
    changed.entries["2026-09-12"].food = [];
    expect(diffState(state, changed, rows)).toContainEqual({
      action: "delete",
      kind: "entry",
      id: rows[0].id,
      revision: 1,
    });
  });
  test("an edit draft keeps its original revision after a background refresh", () => {
    const row = validateRow({
      id: crypto.randomUUID(),
      kind: "entry",
      date: "2026-09-12",
      category: "food",
      revision: 1,
      data: { note: "Original" },
    });
    const draft = {
      ...(project([row]).entries["2026-09-12"].food[0] as object),
      note: "My draft",
    };
    const latest = { ...row, revision: 2, data: { note: "Other device" } };
    const current = project([latest]);
    const next = structuredClone(current);
    next.entries["2026-09-12"].food = [draft as never];
    const operation = diffState(current, next, [latest]).find(
      (op) => op.action === "put" && op.row.kind === "entry",
    );
    expect(operation?.action === "put" && operation.row.revision).toBe(1);
  });
});
