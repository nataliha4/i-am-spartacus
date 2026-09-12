import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Database } from "../db/connection";
import * as schema from "../db/schema";
export function authOptions(
  database: Database,
  options: { onResetToken?: (token: string) => void } = {},
) {
  const baseURL = process.env.BETTER_AUTH_URL;
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!baseURL || !secret || secret.length < 32)
    throw new Error(
      "BETTER_AUTH_URL and a BETTER_AUTH_SECRET of at least 32 characters are required",
    );
  return {
    baseURL,
    secret,
    database: drizzleAdapter(database.db, {
      provider: "pg",
      schema,
      transaction: true,
    }),
    trustedOrigins: [new URL(baseURL).origin],
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 12,
      revokeSessionsOnPasswordReset: true,
      ...(options.onResetToken
        ? {
            sendResetPassword: async ({ token }: { token: string }) => {
              options.onResetToken!(token);
            },
          }
        : {}),
    },
    session: {
      expiresIn: 60 * 60 * 24 * 14,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    advanced: {
      useSecureCookies: baseURL.startsWith("https:"),
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax" as const },
      ipAddress: { ipAddressHeaders: ["x-spartacus-client-ip"] },
    },
    rateLimit: {
      enabled: true,
      storage: "database" as const,
      window: 60,
      max: 60,
      customRules: { "/sign-in/email": { window: 60, max: 10 } },
    },
    telemetry: { enabled: false },
  };
}
export function createAuth(database: Database) {
  return betterAuth(authOptions(database));
}
export type Auth = ReturnType<typeof createAuth>;
