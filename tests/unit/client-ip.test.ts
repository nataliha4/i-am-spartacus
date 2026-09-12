import { expect, test } from "bun:test";
import {
  resolveClientIP,
  trustedProxiesFromEnv,
} from "../../src/server/client-ip";

test("forwarded headers cannot override an untrusted socket peer", () => {
  const proxies = ["10.42.1.0/24", "2001:db8:abcd::/64"];
  expect(resolveClientIP("198.51.100.8", "1.2.3.4,10.42.1.9", proxies)).toBe(
    "198.51.100.8",
  );
  expect(
    resolveClientIP("10.42.1.9", "6.6.6.6,198.51.100.8,10.42.1.10", proxies),
  ).toBe("198.51.100.8");
  expect(resolveClientIP("10.42.1.9", "198.51.100.8", [])).toBe("10.42.1.9");
  expect(resolveClientIP("::ffff:198.51.100.8", "1.2.3.4", proxies)).toBe(
    "198.51.100.8",
  );
  expect(resolveClientIP("2001:db8:abcd::1", "198.51.100.8", proxies)).toBe(
    "198.51.100.8",
  );
});
test("missing or malformed trusted chains fail closed and configuration is validated", () => {
  expect(resolveClientIP(undefined, "198.51.100.8", [])).toBeNull();
  expect(resolveClientIP("unknown", null, [])).toBeNull();
  expect(resolveClientIP("10.42.1.9", "garbage", ["10.42.1.0/24"])).toBeNull();
  expect(resolveClientIP("10.42.1.9", null, ["10.42.1.0/24"])).toBeNull();
  expect(() => trustedProxiesFromEnv({ TRUST_PROXY: "true" })).toThrow();
  expect(() =>
    trustedProxiesFromEnv({ TRUST_PROXY: "true", TRUSTED_PROXY_CIDRS: "nope" }),
  ).toThrow();
  expect(
    trustedProxiesFromEnv({
      TRUST_PROXY: "true",
      TRUSTED_PROXY_CIDRS: "10.42.1.0/24, ::1",
    }),
  ).toEqual(["10.42.1.0/24", "::1"]);
});
