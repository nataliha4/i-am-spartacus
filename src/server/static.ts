import { resolve, extname } from "node:path";
import { securityHeaders } from "./security-headers";

export async function serveStatic(
  request: Request,
  root: string,
  baseURL?: string,
) {
  root = resolve(root);
  const headers = securityHeaders(baseURL);
  const respond = (body: BodyInit | null, status: number) =>
    new Response(body, { status, headers });
  if (request.method !== "GET" && request.method !== "HEAD")
    return respond("Method not allowed", 405);
  const url = new URL(request.url);
  let decoded: string;
  try {
    decoded = decodeURIComponent(url.pathname);
  } catch {
    return respond("Bad request", 400);
  }
  if (
    [...decoded].some(
      (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
    )
  )
    return respond("Bad request", 400);
  const path = resolve(root, `.${decoded}`);
  if (!path.startsWith(`${root}/`) && path !== root)
    return respond("Not found", 404);
  let file = Bun.file(path === root ? resolve(root, "index.html") : path);
  if (!(await file.exists())) {
    if (extname(path)) return respond("Not found", 404);
    file = Bun.file(resolve(root, "index.html"));
  }
  if (!(await file.exists())) return respond("Frontend build is missing", 503);
  headers.set("Content-Type", file.type);
  headers.set(
    "Cache-Control",
    url.pathname.startsWith("/assets/")
      ? "public, max-age=31536000, immutable"
      : "no-cache",
  );
  return respond(request.method === "HEAD" ? null : file, 200);
}
