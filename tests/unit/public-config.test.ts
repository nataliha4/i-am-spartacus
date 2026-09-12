import { expect, test } from "bun:test";
import {
  googleCredentials,
  policyConfiguration,
} from "../../src/server/public-config";
const policy = {
  OPERATOR_NAME: "Test operator",
  PRIVACY_CONTACT: "test@example.test",
  BACKUP_RETENTION_DAYS: "30",
  LOG_RETENTION_DAYS: "14",
};
test("Google signup fails closed on partial credentials or missing production policy", () => {
  expect(googleCredentials({})).toBeUndefined();
  expect(() => googleCredentials({ GOOGLE_CLIENT_ID: "partial" })).toThrow();
  const google = {
    GOOGLE_CLIENT_ID: "client",
    GOOGLE_CLIENT_SECRET: "secret",
    NODE_ENV: "production",
    BETTER_AUTH_URL: "https://tracker.example",
  };
  expect(() => googleCredentials(google)).toThrow();
  expect(googleCredentials({ ...google, ...policy })).toEqual({
    clientId: "client",
    clientSecret: "secret",
  });
  expect(() =>
    googleCredentials({
      ...google,
      ...policy,
      BETTER_AUTH_URL: "http://tracker.example",
    }),
  ).toThrow();
  expect(() =>
    policyConfiguration({ ...policy, BACKUP_RETENTION_DAYS: "" }),
  ).toThrow();
  expect(() =>
    policyConfiguration({ ...policy, LOG_RETENTION_DAYS: "-1" }),
  ).toThrow();
});

test("public policy escapes operator text and uses configured retention", async () => {
  const { policyPage } = await import("../../src/server/policy");
  const keys = [
    "OPERATOR_NAME",
    "PRIVACY_CONTACT",
    "BACKUP_RETENTION_DAYS",
    "LOG_RETENTION_DAYS",
  ] as const;
  const previous = Object.fromEntries(
    keys.map((key) => [key, process.env[key]]),
  );
  try {
    Object.assign(process.env, policy, {
      OPERATOR_NAME: '<script>alert("x")</script>',
    });
    const response = await policyPage("/privacy");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const html = await response.text();
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>alert");
    expect(html).toMatch(/30 days/);
    expect(html).toContain("test@example.test");
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
