export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  body?: unknown,
  key?: string,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      method: body === undefined ? "GET" : "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers:
        body === undefined
          ? {}
          : {
              "Content-Type": "application/json",
              ...(key ? { "Idempotency-Key": key } : {}),
            },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new ApiError(
      0,
      "NETWORK",
      "Connection lost. This save is unconfirmed. Retry before making another change.",
    );
  }
  const result = await response.json();
  if (!response.ok)
    throw new ApiError(
      response.status,
      result.error?.code ?? "REQUEST_FAILED",
      result.error?.message ?? "Request failed",
    );
  return result as T;
}
