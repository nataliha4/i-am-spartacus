import { expect, test } from "bun:test";
import { serveStatic } from "../../src/server/static";
import { securityHeaders } from "../../src/server/security-headers";

test("static control characters and traversal are rejected before file access", async () => {
  for (const path of ["/%00/foo", "/%1f/foo", "/%7f/foo", "/%ZZ"]) {
    const response = await serveStatic(
      new Request(`https://tracker.example${path}`),
      "public",
      "https://tracker.example",
    );
    expect(response.status).toBe(400);
    expect(response.headers.get("strict-transport-security")).toBe(
      "max-age=31536000",
    );
    expect(response.headers.get("referrer-policy")).toBe("same-origin");
  }
  expect(
    (
      await serveStatic(
        new Request("https://tracker.example/..%2fpackage.json"),
        "public",
      )
    ).status,
  ).toBe(404);
});
test("security headers cover successful static responses and HTTPS deployments only", async () => {
  const response = await serveStatic(
    new Request("https://tracker.example/icon-192.png"),
    "public",
    "https://tracker.example",
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("referrer-policy")).toBe("same-origin");
  expect(response.headers.get("strict-transport-security")).toBe(
    "max-age=31536000",
  );
  expect(
    securityHeaders("http://localhost:3000").has("strict-transport-security"),
  ).toBe(false);
});
