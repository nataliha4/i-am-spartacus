import { defineConfig, devices } from "@playwright/test";
process.env.BETTER_AUTH_URL = "http://localhost:4173";
process.env.BETTER_AUTH_SECRET ??=
  "e2e-only-secret-not-for-production-at-least-32-characters";
export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "test-results/playwright-output",
  reporter: process.env.CI
    ? [
        ["list"],
        ["junit", { outputFile: "test-results/e2e.xml" }],
        ["html", { open: "never" }],
      ]
    : "list",
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: "http://localhost:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-webkit", use: { ...devices["iPhone 13"] } },
  ],
  webServer: {
    command: "bun src/server/index.ts",
    url: "http://localhost:4173/health/ready",
    reuseExistingServer: false,
    env: {
      ...(process.env as Record<string, string>),
      NODE_ENV: "test",
      PORT: "4173",
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
    },
  },
});
