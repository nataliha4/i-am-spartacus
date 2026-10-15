import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { readFileSync } from "node:fs";
import * as schema from "./schema";
export function connect(
  url: string,
  max = Number(process.env.DB_POOL_MAX ?? 5),
) {
  if (!url) throw new Error("DATABASE_URL is required");
  const ssl =
    process.env.DB_SSL === "require"
      ? {
          rejectUnauthorized: true,
          ...(process.env.DB_SSL_CA_FILE
            ? { ca: readFileSync(process.env.DB_SSL_CA_FILE, "utf8") }
            : {}),
        }
      : // Encrypts the connection without verifying the server's certificate
        // chain — a deliberate interim stance (e.g. while a DB cert is being
        // renewed), not a default. Still vulnerable to an on-path attacker
        // substituting a cert; DB_SSL=require is what actually authenticates
        // the server.
        process.env.DB_SSL === "no-verify"
        ? { rejectUnauthorized: false }
        : false;
  const client = postgres(url, {
    max,
    ssl,
    connect_timeout: 10,
    idle_timeout: 20,
    connection: { application_name: "spartacus", statement_timeout: 15000 },
  });
  return { client, db: drizzle(client, { schema }) };
}
export type Database = ReturnType<typeof connect>;
