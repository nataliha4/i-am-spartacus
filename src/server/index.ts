import { resolve } from "node:path";
import { connect } from "../db/connection";
import { createApp } from "./app";
import { resolveClientIP, trustedProxiesFromEnv } from "./client-ip";
import { serveStatic } from "./static";
import { startMaintenance } from "./maintenance";
const database = connect(process.env.DATABASE_URL ?? "");
const { app } = createApp(database);
const root = resolve(process.env.STATIC_DIR ?? "dist/client");
const trustedProxies = trustedProxiesFromEnv();
const server = Bun.serve({
  port: Number(process.env.PORT ?? 3000),
  async fetch(request, server) {
    const url = new URL(request.url);
    if (
      url.pathname.startsWith("/api/") ||
      url.pathname.startsWith("/health/")
    ) {
      const clientIP = resolveClientIP(
        server.requestIP(request)?.address,
        request.headers.get("x-forwarded-for"),
        trustedProxies,
      );
      return app.fetch(request, { clientIP });
    }
    return serveStatic(request, root);
  },
});
const stopMaintenance = startMaintenance(database);
console.info(JSON.stringify({ event: "listening", port: server.port }));
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, async () => {
    await server.stop();
    await stopMaintenance();
    await database.client.end({ timeout: 5 });
    process.exit(0);
  });
