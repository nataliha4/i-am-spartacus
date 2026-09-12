export function securityHeaders(baseURL = process.env.BETTER_AUTH_URL ?? "") {
  const headers = new Headers({
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
    "Content-Security-Policy":
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  });
  if (baseURL.startsWith("https:"))
    headers.set("Strict-Transport-Security", "max-age=31536000");
  return headers;
}
