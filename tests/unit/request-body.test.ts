import { expect, test } from "bun:test";
import { BodyReader, ConcurrencyGate } from "../../src/server/request-body";
function pending() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  let cancelled = false;
  const abort = new AbortController();
  const request = new Request("http://localhost/api/test", {
    method: "POST",
    signal: abort.signal,
    body: new ReadableStream<Uint8Array>({
      start(c) {
        controller = c;
      },
      cancel() {
        cancelled = true;
      },
    }),
  });
  return {
    request,
    abort,
    push: () => controller.enqueue(new Uint8Array([123])),
    close: () => controller.close(),
    cancelled: () => cancelled,
  };
}
test("body readers enforce per-IP/global limits and release on disconnect", async () => {
  const reader = new BodyReader();
  const requests = Array.from({ length: 4 }, pending);
  const reads = requests.map((r, i) =>
    reader.read(r.request, String(i >> 1), 100).catch((e) => e),
  );
  await expect(reader.read(pending().request, "0", 100)).rejects.toMatchObject({
    status: 429,
  });
  await expect(
    reader.read(pending().request, "different", 100),
  ).rejects.toMatchObject({ status: 429 });
  requests[0].abort.abort();
  expect(await reads[0]).toMatchObject({ status: 408 });
  expect(requests[0].cancelled()).toBe(true);
  expect(
    await reader.read(
      new Request("http://localhost", { method: "POST", body: "{}" }),
      "0",
      100,
    ),
  ).toBeInstanceOf(Request);
  for (const request of requests.slice(1)) request.close();
  await Promise.all(reads);
});
test("an absolute deadline cancels trickling bodies and releases capacity", async () => {
  const reader = new BodyReader(40);
  const slow = pending();
  const drip = setInterval(slow.push, 5);
  try {
    await expect(reader.read(slow.request, "ip", 100)).rejects.toMatchObject({
      status: 408,
    });
    expect(slow.cancelled()).toBe(true);
  } finally {
    clearInterval(drip);
  }
  await expect(
    reader.read(
      new Request("http://localhost", { method: "POST", body: "{}" }),
      "ip",
      100,
    ),
  ).resolves.toBeInstanceOf(Request);
});
test("actual bytes are bounded even with a misleading Content-Length", async () => {
  const reader = new BodyReader();
  await expect(
    reader.read(
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-length": "1" },
        body: "12345",
      }),
      "ip",
      4,
    ),
  ).rejects.toMatchObject({ status: 413 });
});
test("import operations have independent account and global concurrency limits", () => {
  const gate = new ConcurrencyGate(2, 1);
  const release = gate.acquire("first");
  expect(() => gate.acquire("first")).toThrow();
  const second = gate.acquire("second");
  expect(() => gate.acquire("third")).toThrow();
  release();
  release();
  gate.acquire("third")();
  second();
});
