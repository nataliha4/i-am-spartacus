import { expect, test } from "bun:test";
import { MemoryLimiter } from "../../src/server/rate-limits";

test("admission limits expire, stay isolated, and never evict active buckets on overflow", () => {
  const limiter = new MemoryLimiter(2);
  expect(limiter.consume("a", 1, 1000, 0)).toBe(0);
  expect(limiter.consume("a", 1, 1000, 1)).toBe(1);
  expect(limiter.consume("b", 1, 1000, 1)).toBe(0);
  expect(limiter.consume("c", 1, 1000, 2)).toBe(1);
  expect(limiter.consume("a", 1, 1000, 3)).toBe(1);
  expect(limiter.consume("c", 1, 1000, 1001)).toBe(0);
});
