import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
test("legacy exporter preserves storage, including malformed values, without external requests", async ({
  page,
}) => {
  const origin = "https://legacy.example.test";
  const seen: string[] = [];
  page.on("request", (request) => seen.push(request.url()));
  await page.route(`${origin}/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    const name = path === "/" ? "index.html" : path.slice(1);
    if (!["index.html", "export.js", "export.css"].includes(name))
      return route.abort();
    await route.fulfill({
      body: await readFile(`legacy/${name}`),
      contentType: name.endsWith("js")
        ? "text/javascript"
        : name.endsWith("css")
          ? "text/css"
          : "text/html",
    });
  });
  await page.goto(origin);
  const raw = {
    trackerData: JSON.stringify({
      "2026-09-12": { food: [{ id: 123, note: "Lunch" }] },
    }),
    unrelated: "retain this too",
  };
  await page.evaluate((values) => {
    for (const [key, value] of Object.entries(values))
      localStorage.setItem(key, value);
  }, raw);
  await page.reload();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export data for the new app" })
    .click();
  const exported = JSON.parse(
    await readFile(await (await download).path(), "utf8"),
  );
  expect(exported.format).toBe("spartacus-legacy");
  expect(exported.data.trackerData).toEqual(JSON.parse(raw.trackerData));
  expect(await page.evaluate(() => ({ ...localStorage }))).toEqual(raw);
  await page.evaluate(() => localStorage.setItem("trackerData", "{broken"));
  await page.reload();
  await page
    .getByRole("button", { name: "Export data for the new app" })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "not directly importable",
  );
  const recovery = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download raw recovery copy" })
    .click();
  expect(
    JSON.parse(await readFile(await (await recovery).path(), "utf8")).raw
      .trackerData,
  ).toBe("{broken");
  expect(await page.evaluate(() => ({ ...localStorage }))).toEqual({
    ...raw,
    trackerData: "{broken",
  });
  expect(seen.every((url) => url.startsWith(origin + "/"))).toBe(true);
});
