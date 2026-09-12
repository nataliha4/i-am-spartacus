import { test, expect } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
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
test("familiar tracker: login, import, every screen, confirmed save, restart and offline", async ({
  page,
  context,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const email = await createAccount();
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("browser-test-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
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

test("an uncertain save retains the form and retries once, then a stale editor conflicts", async ({
  page,
}) => {
  const email = await createAccount();
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("browser-test-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
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
  expect(cached.some((path) => path.startsWith("/api/"))).toBe(false);
  const originalWorker = await readFile("dist/client/sw.js", "utf8");
  try {
    await page
      .getByLabel("Email", { exact: true })
      .fill("unfinished@example.test");
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
    await expect(page.getByLabel("Email", { exact: true })).toHaveValue(
      "unfinished@example.test",
    );
    await page.getByRole("button", { name: "Reload app" }).click();
    await expect(page.getByLabel("Email", { exact: true })).toHaveValue("");
  } finally {
    await writeFile("dist/client/sw.js", originalWorker);
  }
});
