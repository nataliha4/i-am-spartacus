export type Readiness = "ready" | "migration_required" | "unavailable";
export function cacheReadiness(
  check: () => Promise<Readiness>,
  now = Date.now,
) {
  let cached: Readiness = "unavailable";
  let expires = 0;
  let pending: Promise<Readiness> | undefined;
  return () => {
    if (pending) return pending;
    if (now() < expires) return Promise.resolve(cached);
    pending = Promise.resolve()
      .then(check)
      .catch((error) => {
        console.error(
          JSON.stringify({
            event: "readiness_check_failed",
            name: error instanceof Error ? error.name : typeof error,
            message: error instanceof Error ? error.message : String(error),
            code: (error as { code?: unknown })?.code,
          }),
        );
        return "unavailable" as const;
      })
      .then((status) => {
        cached = status;
        expires = now() + 5000;
        return status;
      })
      .finally(() => {
        pending = undefined;
      });
    return pending;
  };
}
