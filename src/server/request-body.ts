import { AppError } from "./store";

/** Bounded maps contain only active work. Release is idempotent. */
export class ConcurrencyGate {
  private total = 0;
  private keys = new Map<string, number>();
  constructor(
    private maximum: number,
    private perKey: number,
  ) {}
  acquire(key: string) {
    const count = this.keys.get(key) ?? 0;
    if (this.total >= this.maximum || count >= this.perKey)
      throw new AppError(
        429,
        "RATE_LIMITED",
        "Too many concurrent requests. Please retry shortly.",
      );
    this.total++;
    this.keys.set(key, count + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.total--;
      const remaining = this.keys.get(key)! - 1;
      if (remaining) this.keys.set(key, remaining);
      else this.keys.delete(key);
    };
  }
}

export class BodyReader {
  private gate = new ConcurrencyGate(4, 2);
  constructor(private deadlineMs = 30_000) {}
  async read(request: Request, ip: string, maximum: number): Promise<Request> {
    if (!request.body) return request;
    let release: () => void;
    try {
      release = this.gate.acquire(ip);
    } catch (error) {
      void request.body.cancel().catch(() => {});
      throw error;
    }
    const reader = request.body.getReader();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    let abort = () => {};
    const stop = () => {
      stopped = true;
      void reader.cancel().catch(() => {});
    };
    try {
      const interrupted = new Promise<never>((_, reject) => {
        abort = () => {
          reject(
            new AppError(
              408,
              "REQUEST_TIMEOUT",
              "Request body was interrupted or timed out.",
            ),
          );
          stop();
        };
        timer = setTimeout(abort, this.deadlineMs);
        request.signal.addEventListener("abort", abort, { once: true });
        if (request.signal.aborted) abort();
      });
      const consume = async () => {
        const chunks: Uint8Array<ArrayBuffer>[] = [];
        let size = 0;
        while (!stopped) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > maximum)
            throw new AppError(
              413,
              "BODY_TOO_LARGE",
              `Request exceeds the ${maximum / 1024 / 1024} MiB limit, including wrapping.`,
            );
          chunks.push(value);
        }
        return new Request(request, { body: new Blob(chunks) });
      };
      return await Promise.race([interrupted, consume()]);
    } catch (error) {
      stop();
      throw error;
    } finally {
      clearTimeout(timer);
      request.signal.removeEventListener("abort", abort);
      release();
    }
  }
}
