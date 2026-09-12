import { expect, test } from "bun:test";
import { cacheReadiness } from "../../src/server/readiness";

test("readiness floods share one check and a five-second result, including failures", async () => {
  let calls = 0,
    now = 1;
  const read = cacheReadiness(
    async () => {
      calls++;
      if (calls > 1) throw new Error("database down");
      return "ready";
    },
    () => now,
  );
  expect(await Promise.all(Array.from({ length: 100 }, () => read()))).toEqual(
    Array(100).fill("ready"),
  );
  expect(calls).toBe(1);
  now = 5000;
  expect(await read()).toBe("ready");
  expect(calls).toBe(1);
  now = 5001;
  expect(await read()).toBe("unavailable");
  expect(calls).toBe(2);
  expect(await read()).toBe("unavailable");
  expect(calls).toBe(2);
});
