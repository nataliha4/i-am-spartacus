import { defineConfig, devices } from "@playwright/test";
process.env.BETTER_AUTH_URL = "http://localhost:4173";
process.env.BETTER_AUTH_SECRET ??=
  "e2e-only-secret-not-for-production-at-least-32-characters";
process.env.GOOGLE_CLIENT_ID ??= "ci-dummy.apps.googleusercontent.com";
process.env.GOOGLE_CLIENT_SECRET ??= "ci-dummy-never-a-real-secret";
process.env.OPERATOR_NAME ??= "Browser test operator";
process.env.PRIVACY_CONTACT ??= "browser@example.test";
process.env.BACKUP_RETENTION_DAYS ??= "0";
process.env.LOG_RETENTION_DAYS ??= "0";
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
      // Browser tests model separate clients via X-Forwarded-For. Only the
      // local test runner is trusted; production rate limits remain enabled.
      TRUST_PROXY: "true",
      TRUSTED_PROXY_CIDRS: "127.0.0.1/32,::1/128",
    },
  },
});
