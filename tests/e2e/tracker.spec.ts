import { test, expect, type Page } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { connect } from "../../src/db/connection";
import { createOperatorAuth } from "../../src/server/operator-auth";
import { legacyFixture } from "../fixtures/legacy";

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error(
    "E2E requires a disposable TEST_DATABASE_URL ending in _test",
  );
const database = connect(url);
const operator = createOperatorAuth(database);
const userIds: string[] = [];
test.beforeAll(async () => {
  await database.client`DELETE FROM auth_rate_limit`;
});
test.beforeEach(async ({ context }, testInfo) => {
  // Each independent account journey gets an independent client IP budget.
  const hash = createHash("sha256").update(testInfo.testId).digest();
  await context.setExtraHTTPHeaders({
    "x-forwarded-for": `198.18.${hash[0]}.${hash[1]}`,
  });
});
test.afterAll(async () => {
  for (const id of userIds)
    await database.client`DELETE FROM auth_user WHERE id=${id}`;
  await database.client.end();
});
async function createAccount() {
  const email = `${crypto.randomUUID()}@example.test`;
  const { user } = await operator.api.createUser({
    body: { email, name: "Browser test", password: "browser-test-password" },
  });
  userIds.push(user.id);
  return email;
}
async function login(page: Page, email: string) {
  const response = await page.request.post("/api/auth/sign-in/email", {
    headers: { origin: "http://localhost:4173" },
    data: { email, password: "browser-test-password" },
  });
  expect(response.status()).toBe(200);
  await page.goto("/");
}
test("familiar tracker: login, import, every screen, confirmed save, restart and offline", async ({
  page,
  context,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const email = await createAccount();
  await login(page, email);
  await expect(
    page.getByRole("button", { name: "Dashboard", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Account & data" }).click();
  await page.getByLabel("Tracker timezone").fill("America/New_York");
  await page.getByLabel("Choose export JSON").setInputFiles({
    name: "legacy.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(legacyFixture)),
  });
  await page
    .getByRole("button", { name: "Confirm import into this account" })
    .click();
  await expect(
    page.getByText("Import complete. Your original file is unchanged."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Account & data" }).click();
  const trackerDate = page.getByLabel("Tracker date");
  const selectedDate = await trackerDate.inputValue();
  await trackerDate.fill("");
  await expect(trackerDate).toHaveValue(selectedDate);
  for (const name of [
    "Day Timeline",
    "Stats and History",
    "Plan for Today",
    "Settings",
    "Dashboard",
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
    await expect(page.locator("h1")).toContainText("I AM SPARTACUS");
  }
  await page
    .getByRole("button", { name: "Stats and History", exact: true })
    .click();
  await page.getByRole("button", { name: /Charts/ }).click();
  await expect(page.locator("canvas").first()).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByPlaceholder("e.g., 70").fill("69");
  await page
    .getByRole("button", { name: "Save weight and fasting settings" })
    .click();
  await expect(page.getByText("✓ Saved", { exact: true })).toBeVisible();
  await page.getByPlaceholder("e.g., 70").fill("68");
  await page
    .getByRole("button", { name: "Save weight and fasting settings" })
    .click();
  await expect(page.getByText("✓ Saved", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Day Timeline", exact: true }).click();
  await page.getByRole("button", { name: /Food/ }).click();
  await page
    .getByPlaceholder("e.g., Grilled chicken, rice, and broccoli")
    .fill("Browser test lunch");
  await page.getByRole("button", { name: "Log Food" }).click();
  await expect(
    page
      .locator("#day-timeline-card")
      .getByText("Browser test lunch", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("tracker.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
  await page.getByRole("button", { name: "Day Timeline", exact: true }).click();
  await expect(
    page
      .locator("#day-timeline-card")
      .getByText("Browser test lunch", { exact: true }),
  ).toBeVisible();
  await context.setOffline(true);
  await expect(
    page.getByText("Offline — connect to save changes."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Food/ })).toBeDisabled();
  await context.setOffline(false);
  await expect(
    page.getByText("Offline — connect to save changes."),
  ).not.toBeVisible();
  expect(errors).toEqual([]);
});

test("symptoms save, edit, and move dates without duplicating date in their data", async ({
  page,
}) => {
  await login(page, await createAccount());
  await page.getByRole("button", { name: "Day Timeline", exact: true }).click();
  await page.getByRole("button", { name: /Symptom/ }).click();
  await page.getByPlaceholder("e.g., Headache").fill("Symptom regression");
  await page.getByRole("button", { name: "Log Symptom" }).click();
  const timeline = page.locator("#day-timeline-card");
  await expect(timeline.getByText(/Symptom regression/)).toBeVisible();
  const initial = await (await page.request.get("/api/v1/state")).json();
  const symptom = initial.rows.find(
    (row: { category: string }) => row.category === "symptoms",
  );
  expect(symptom.data).not.toHaveProperty("date");
  await page.reload();
  await page.getByRole("button", { name: "Day Timeline", exact: true }).click();
  await timeline.getByText(/Symptom regression/).click();
  await expect(timeline.locator('input[type="date"]')).toHaveValue(
    symptom.date,
  );
  await timeline.locator('input[type="text"]').fill("Edited symptom");
  await timeline.getByRole("button", { name: "Save", exact: true }).click();
  await expect(timeline.getByText(/Edited symptom/)).toBeVisible();
  await timeline.getByText(/Edited symptom/).click();
  await timeline.locator('input[type="date"]').fill("");
  await timeline.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "Dismiss", exact: true }).click();
  await timeline.locator('input[type="date"]').fill("2020-01-02");
  await timeline.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator('input[type="date"]').first()).toHaveValue(
    "2020-01-02",
  );
  await page.reload();
  const saved = await (await page.request.get("/api/v1/state")).json();
  const symptoms = saved.rows.filter(
    (row: { category: string }) => row.category === "symptoms",
  );
  expect(symptoms).toHaveLength(1);
  expect(symptoms[0]).toMatchObject({
    id: symptom.id,
    date: "2020-01-02",
    data: { symptom: "Edited symptom", level: 3, notes: "" },
  });
  expect(symptoms[0].data).not.toHaveProperty("date");
});

for (const entry of [
  {
    category: "food",
    button: "Food",
    placeholder: "e.g., Grilled chicken, rice, and broccoli",
    submit: "Log Food",
    field: "note",
  },
  {
    category: "supplements",
    button: "Supplement",
    placeholder: "e.g., Magnesium",
    submit: "Log Supplement",
    field: "name",
  },
  {
    category: "gym",
    button: "Gym",
    placeholder: "e.g., Planet Fitness — Chest & Triceps",
    submit: "Log Gym Activity",
    field: "activity",
  },
  {
    category: "medical",
    button: "Medical",
    placeholder: "e.g., Doctor visit, blood test, vaccination",
    submit: "Log Medical Event",
    field: "event",
  },
]) {
  test(`${entry.category} form creates, edits, reloads and deletes valid records`, async ({
    page,
  }) => {
    await login(page, await createAccount());
    await page
      .getByRole("button", { name: "Day Timeline", exact: true })
      .click();
    await page.getByRole("button", { name: new RegExp(entry.button) }).click();
    const name = `${entry.category} regression`;
    await page.getByPlaceholder(entry.placeholder).fill(name);
    await page.getByRole("button", { name: entry.submit, exact: true }).click();
    const timeline = page.locator("#day-timeline-card");
    await timeline.getByText(name, { exact: true }).click();
    await timeline
      .locator('input[type="text"], textarea')
      .first()
      .fill(`${name} edited`);
    await timeline.locator('input[type="time"]').fill("12:34");
    await timeline.getByRole("button", { name: "Save", exact: true }).click();
    await expect(
      timeline.getByText(`${name} edited`, { exact: true }),
    ).toBeVisible();
    await page.reload();
    const snapshot = await (await page.request.get("/api/v1/state")).json();
    expect(
      snapshot.rows.filter(
        (row: { category: string }) => row.category === entry.category,
      ),
    ).toEqual([
      expect.objectContaining({
        data: expect.objectContaining({
          [entry.field]: `${name} edited`,
          time: "12:34",
        }),
      }),
    ]);
    await page
      .getByRole("button", { name: "Day Timeline", exact: true })
      .click();
    await timeline.getByText(`${name} edited`, { exact: true }).click();
    const deleted = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/v1/commit") &&
        response.request().method() === "POST",
    );
    await timeline.getByRole("button", { name: "Delete", exact: true }).click();
    expect((await deleted).status()).toBe(200);
    await expect(
      timeline.getByText(`${name} edited`, { exact: true }),
    ).toHaveCount(0);
    expect(
      (await (await page.request.get("/api/v1/state")).json()).rows.filter(
        (row: { kind: string }) => row.kind === "entry",
      ),
    ).toHaveLength(0);
    await expect(page.getByRole("alert")).toHaveCount(0);
  });
}

test("weight forms, timezone and fasting actions persist schema-valid data", async ({
  page,
}) => {
  await login(page, await createAccount());
  await page.getByRole("button", { name: "Account & data" }).click();
  await page.getByLabel("Tracker timezone").fill("UTC");
  await page
    .getByRole("button", { name: "Save timezone", exact: true })
    .click();
  await expect(
    page.getByText("Timezone saved. Existing dates are preserved."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Account & data" }).click();
  // Changing timezone preserves the selected date. Select today in the new
  // timezone before exercising live fasting actions, including around midnight.
  await page
    .getByLabel("Tracker date")
    .fill(new Date().toISOString().slice(0, 10));
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByPlaceholder("e.g., 70").fill("65");
  await page.locator('input[type="number"]').nth(1).fill("14");
  await page.locator('input[type="time"]').first().fill("18:30");
  await page
    .getByRole("button", { name: "Save weight and fasting settings" })
    .click();
  await expect(page.getByText("✓ Saved", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  for (const weight of ["70", "71"]) {
    if (weight === "71")
      await page.getByText("+ Log another entry", { exact: true }).click();
    await page.getByPlaceholder("e.g., 75.5").fill(weight);
    await page.getByRole("button", { name: "Log", exact: true }).click();
    await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  }
  await page.getByRole("button", { name: "Day Timeline", exact: true }).click();
  const timeline = page.locator("#day-timeline-card");
  await timeline.getByText("Weight: 71 kg", { exact: true }).click();
  await timeline.locator('input[type="number"]').first().fill("72");
  await timeline.getByRole("button", { name: "Save", exact: true }).click();
  await timeline.getByText("Weight: 72 kg", { exact: true }).click();
  await timeline.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(
    timeline.getByText("Weight: 72 kg", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await page.getByRole("button", { name: "Start Now", exact: true }).click();
  await page.getByText("Edit start time", { exact: true }).click();
  await page.locator('input[type="time"]').fill("00:00");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Day Timeline", exact: true }).click();
  await timeline.getByText(/Fast started/).click();
  await timeline.locator('input[type="time"]').fill("00:00");
  await timeline.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await page.getByRole("button", { name: "Stop Fast", exact: true }).click();
  await page.getByRole("button", { name: "Day Timeline", exact: true }).click();
  await timeline.getByText(/Fast ended/).click();
  await timeline.locator('input[type="time"]').first().fill("00:00");
  await timeline.getByRole("button", { name: "Save", exact: true }).click();
  await timeline.getByText(/Fast ended/).click();
  const deletedFast = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/v1/commit") &&
      response.request().method() === "POST",
  );
  await timeline.getByRole("button", { name: "Delete", exact: true }).click();
  expect((await deletedFast).status()).toBe(200);
  await expect(timeline.getByText(/Fast ended/)).toHaveCount(0);
  await page.reload();
  const snapshot = await (await page.request.get("/api/v1/state")).json();
  expect(
    snapshot.rows.find((row: { kind: string }) => row.kind === "settings").data,
  ).toMatchObject({
    targetWeight: 65,
    fastingGoalHours: 14,
    fastingStartTime: "18:30",
    timezone: "UTC",
  });
  expect(
    snapshot.rows.filter((row: { kind: string }) => row.kind === "fast"),
  ).toHaveLength(0);
  expect(
    snapshot.rows.filter(
      (row: { category: string }) => row.category === "weight",
    ),
  ).toEqual([
    expect.objectContaining({
      data: expect.objectContaining({ weight: 70, target: 65 }),
    }),
  ]);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

for (const schedule of [
  {
    category: "supplements",
    label: "Recurring Supplement",
    placeholder: "e.g., Magnesium",
  },
  {
    category: "gym",
    label: "Recurring Gym Activity",
    placeholder: "e.g., Planet Fitness — Leg Day",
  },
]) {
  test(`${schedule.category} schedules and checklist actions save valid records`, async ({
    page,
  }) => {
    await login(page, await createAccount());
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    if (!(await page.getByPlaceholder(schedule.placeholder).isVisible()))
      await page.getByText(`+ Add ${schedule.label}`, { exact: true }).click();
    const name = `${schedule.category} schedule`;
    const form = page
      .locator("div")
      .filter({
        has: page.getByRole("button", {
          name: `Add ${schedule.label}`,
          exact: true,
        }),
      })
      .filter({ has: page.getByPlaceholder(schedule.placeholder) })
      .last();
    await page.getByPlaceholder(schedule.placeholder).fill(name);
    await form.locator('input[type="time"]').fill("00:00");
    await form.locator("select").first().selectOption("weekly");
    await form.locator("select").nth(1).selectOption("1");
    await page
      .getByRole("button", { name: `Add ${schedule.label}`, exact: true })
      .click();
    const scheduleName = page.getByText(name, { exact: true });
    await expect(scheduleName).toBeVisible();
    await expect
      .poll(async () => (await scheduleName.boundingBox())?.width ?? 0)
      .toBeGreaterThan(50);
    await scheduleName.click();
    const editor = page
      .locator("div")
      .filter({ has: page.getByRole("button", { name: "Save", exact: true }) })
      .filter({ has: page.locator('input[type="text"]') })
      .last();
    await editor.locator('input[type="text"]').fill(`${name} edited`);
    await editor.locator("select").first().selectOption("daily");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page
      .getByRole("button", { name: "Plan for Today", exact: true })
      .click();
    await page.getByText(`${name} edited`, { exact: true }).click();
    await page.getByText("Mark as Failed", { exact: true }).click();
    await expect(page.getByText("Failed", { exact: true })).toBeVisible();
    await page.getByText(`${name} edited`, { exact: true }).click();
    await expect(page.getByText("Failed", { exact: true })).toHaveCount(0);
    await page.getByText(`${name} edited`, { exact: true }).click();
    await page.getByRole("button", { name: "Confirm", exact: true }).click();
    await page.getByText(`${name} edited`, { exact: true }).click();
    await page
      .getByRole("button", { name: "Yes, Unmark", exact: true })
      .click();
    // Dashboard has a separate confirmation form; exercise that path too.
    await page.getByRole("button", { name: "Dashboard", exact: true }).click();
    await page.getByText(`${name} edited`, { exact: true }).click();
    await page.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Confirm", exact: true }),
    ).toHaveCount(0);
    await page.reload();
    const snapshot = await (await page.request.get("/api/v1/state")).json();
    expect(
      snapshot.rows.find((row: { kind: string }) => row.kind === "schedule")
        .data,
    ).toEqual({ name: `${name} edited`, time: "00:00", frequency: "daily" });
    expect(
      snapshot.rows.filter((row: { kind: string }) => row.kind === "entry"),
    ).toHaveLength(2);
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByText(`${name} edited`, { exact: true }).click();
    const removed = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/v1/commit") &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    expect((await removed).status()).toBe(200);
    expect(
      (await (await page.request.get("/api/v1/state")).json()).rows.filter(
        (row: { kind: string }) => row.kind === "schedule",
      ),
    ).toHaveLength(0);
    await expect(page.getByText(`${name} edited`, { exact: true })).toHaveCount(
      0,
    );
    await expect(page.getByRole("alert")).toHaveCount(0);
  });
}

test("weight and fasting goals update accurately at completion, across DST, and after reload", async ({
  page,
}) => {
  await login(page, await createAccount());
  const start = Date.parse("2026-03-07T21:00:00Z");
  const end = Date.parse("2026-03-08T13:00:00Z");
  const response = await page.request.post("/api/v1/commit", {
    headers: {
      origin: "http://localhost:4173",
      "idempotency-key": crypto.randomUUID(),
    },
    data: {
      operations: [
        {
          kind: "settings",
          date: null,
          category: null,
          data: {
            targetWeight: 65,
            fastingGoalHours: 16,
            fastingStartTime: "16:00",
            timezone: "America/New_York",
          },
        },
        {
          kind: "fast",
          date: null,
          category: null,
          data: {
            startTimestampMs: start,
            endTimestampMs: null,
            timezone: "America/New_York",
          },
        },
        {
          kind: "entry",
          date: "2026-03-08",
          category: "weight",
          data: { weight: 69, time: "08:00" },
        },
        {
          kind: "entry",
          date: "2026-03-08",
          category: "weight",
          data: { weight: 70, time: "07:00" },
        },
      ].map((row) => ({
        action: "put",
        row: { ...row, id: crypto.randomUUID(), revision: 0 },
      })),
    },
  });
  expect(response.status()).toBe(200);
  await page.clock.setFixedTime(new Date(end - 1000));
  await page.reload();
  const goalEnd = page.getByText("Fast Ends", { exact: true }).locator("..");
  await expect(goalEnd.getByText("9:00 AM", { exact: true })).toBeVisible();
  await expect(
    goalEnd.getByText("today · 0h 1m left", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("99%", { exact: true })).toBeVisible();
  await expect(page.getByText("Goal met", { exact: true })).toHaveCount(0);
  await expect(
    page
      .getByText("Today's Weight", { exact: true })
      .locator("..")
      .getByText("69 kg", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByText("Delta (kg)", { exact: true })
      .locator("..")
      .getByText("+4.0", { exact: true }),
  ).toBeVisible();
  await page.clock.setFixedTime(new Date(end));
  await page.reload();
  await expect(page.getByText("100%", { exact: true })).toBeVisible();
  await expect(page.getByText("Goal met", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByPlaceholder("e.g., 70").fill("70");
  await page.locator('input[type="number"]').nth(1).fill("18");
  await page
    .getByRole("button", { name: "Save weight and fasting settings" })
    .click();
  await expect(page.getByText("✓ Saved", { exact: true })).toBeVisible();
  await page.reload();
  await expect(goalEnd.getByText("11:00 AM", { exact: true })).toBeVisible();
  await expect(page.getByText("88%", { exact: true })).toBeVisible();
  await expect(page.getByText("Goal met", { exact: true })).toHaveCount(0);
  await expect(
    page
      .getByText("Delta (kg)", { exact: true })
      .locator("..")
      .getByText("-1.0", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.locator('input[type="number"]').nth(1).fill("0");
  await page
    .getByRole("button", { name: "Save weight and fasting settings" })
    .click();
  await expect(page.getByRole("alert")).toBeVisible();
  const snapshot = await (await page.request.get("/api/v1/state")).json();
  expect(
    snapshot.rows.find((row: { kind: string }) => row.kind === "settings").data
      .fastingGoalHours,
  ).toBe(18);
  await page.getByRole("button", { name: "Dismiss", exact: true }).click();
  await page.getByPlaceholder("e.g., 70").fill("");
  await page.locator('input[type="number"]').nth(1).fill("18");
  await page
    .getByRole("button", { name: "Save weight and fasting settings" })
    .click();
  await expect(page.getByText("✓ Saved", { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page
      .getByText("Target", { exact: true })
      .locator("..")
      .getByText("—", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("an uncertain save retains the form and retries once, then a stale editor conflicts", async ({
  page,
}) => {
  const email = await createAccount();
  await login(page, email);
  await page.getByRole("button", { name: "Day Timeline", exact: true }).click();
  await page.getByRole("button", { name: /Food/ }).click();
  const note = page.getByPlaceholder(
    "e.g., Grilled chicken, rice, and broccoli",
  );
  await note.fill("Retry-safe lunch");
  await page.route(
    "**/api/v1/commit",
    async (route) => {
      await route.fetch();
      await route.abort("failed");
    },
    { times: 1 },
  );
  await page.getByRole("button", { name: "Log Food" }).click();
  await expect(note).toHaveValue("Retry-safe lunch");
  await expect(
    page.getByRole("button", { name: "Retry unconfirmed save" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Retry unconfirmed save" }).click();
  await expect(
    page
      .locator("#day-timeline-card")
      .getByText("Retry-safe lunch", { exact: true }),
  ).toHaveCount(1);
  await expect(note).not.toBeVisible();
  await page
    .locator("#day-timeline-card")
    .getByText("Retry-safe lunch", { exact: true })
    .click();
  const editor = page.locator("textarea").first();
  await editor.fill("Stale local edit");
  const snapshot = await (await page.request.get("/api/v1/state")).json();
  const row = snapshot.rows.find(
    (r: { kind: string; data: { note?: string } }) =>
      r.kind === "entry" && r.data.note === "Retry-safe lunch",
  );
  const changed = await page.request.post("/api/v1/commit", {
    headers: {
      origin: "http://localhost:4173",
      "idempotency-key": crypto.randomUUID(),
    },
    data: {
      operations: [
        {
          action: "put",
          row: { ...row, data: { ...row.data, note: "Other device edit" } },
        },
      ],
    },
  });
  expect(changed.status()).toBe(200);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Reload latest data and review" }),
  ).toBeVisible();
  await expect(editor).toHaveValue("Stale local edit");
  await page
    .getByRole("button", { name: "Reload latest data and review" })
    .click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Reload latest data and review" }),
  ).toBeVisible();
  const latest = await (await page.request.get("/api/v1/state")).json();
  expect(
    latest.rows.find((r: { id: string }) => r.id === row.id).data.note,
  ).toBe("Other device edit");
});

test("PWA precaches static assets and never authenticated responses", async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== "chromium",
    "Chromium provides deterministic service-worker lifecycle testing",
  );
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  const manifestResponse = await page.request.get("/manifest.webmanifest");
  const manifest = await manifestResponse.json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons).toHaveLength(2);
  await page.reload();
  const cached = await page.evaluate(async () => {
    const keys: string[] = [];
    for (const cacheName of await caches.keys()) {
      const cache = await caches.open(cacheName);
      keys.push(
        ...(await cache.keys()).map((request) => new URL(request.url).pathname),
      );
    }
    return keys;
  });
  expect(cached.length).toBeGreaterThan(0);
  expect(
    cached.some(
      (path) =>
        path.startsWith("/api/") || ["/privacy", "/terms"].includes(path),
    ),
  ).toBe(false);
  const originalWorker = await readFile("dist/client/sw.js", "utf8");
  try {
    await page.getByText("Install this app", { exact: true }).click();
    await writeFile(
      "dist/client/sw.js",
      `${originalWorker}\n// lifecycle test ${crypto.randomUUID()}\n`,
    );
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      await registration!.update();
    });
    await expect(
      page.getByRole("button", { name: "Reload app" }),
    ).toBeVisible();
    await expect(page.getByText(/On Android or desktop Chrome/)).toBeVisible();
    await page.getByRole("button", { name: "Reload app" }).click();
    await expect(
      page.getByRole("button", { name: "Continue with Google" }),
    ).toBeVisible();
    await expect(
      page.getByText(/On Android or desktop Chrome/),
    ).not.toBeVisible();
  } finally {
    await writeFile("dist/client/sw.js", originalWorker);
  }
});

test("public policies and permanent deletion return to Google login", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Privacy", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Privacy and retention" }),
  ).toBeVisible();
  await expect(
    page.getByText("Inactive accounts are not automatically deleted."),
  ).toBeVisible();
  const requests: string[] = [];
  context.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/"))
      requests.push(request.url());
  });
  const email = await createAccount();
  await login(page, email);
  const other = await context.newPage();
  await other.goto("/");
  await expect(
    other.getByRole("button", { name: "Account & data" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Account & data" }).click();
  await expect(page.getByLabel("Current password")).toHaveCount(0);
  await page.getByText("Delete my account", { exact: true }).click();
  const remove = page.getByRole("button", {
    name: "Permanently delete my account",
  });
  await expect(remove).toBeDisabled();
  await page.getByLabel("Type DELETE to confirm").fill("DELETE");
  requests.length = 0;
  await remove.click();
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeVisible();
  await expect(
    other.getByRole("button", { name: "Continue with Google" }),
  ).toBeVisible();
  expect((await page.request.get("/api/v1/state")).status()).toBe(401);
  expect(
    await database.client`SELECT id FROM auth_user WHERE email=${email}`,
  ).toHaveLength(0);
  expect(requests.length).toBeLessThan(15); // No session-expiry refetch storm.
  await other.close();
});
