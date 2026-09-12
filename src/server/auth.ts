import { type BetterAuthOptions, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Database } from "../db/connection";
import * as schema from "../db/schema";
import { googleCredentials } from "./public-config";
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
  const google = googleCredentials();
  return {
    baseURL,
    secret,
    database: drizzleAdapter(database.db, {
      provider: "pg",
      schema,
      transaction: true,
    }),
    trustedOrigins: [new URL(baseURL).origin],
    socialProviders: google
      ? {
          google: {
            ...google,
            prompt: "select_account",
            accessType: "online",
            includeGrantedScopes: false,
            scope: ["openid", "email", "profile"],
            disableDefaultScope: true,
            requireEmailVerification: true,
            mapProfileToUser: () => ({ image: "" }),
          },
        }
      : {},
    user: {
      validateUserInfo: ({ user, source }) => {
        if (source.method === "oauth" && user.emailVerified !== true)
          return { error: "A verified Google email is required" };
      },
    },
    account: {
      encryptOAuthTokens: true,
      storeStateStrategy: "database",
      skipStateCookieCheck: false,
      accountLinking: {
        enabled: true,
        trustedProviders: ["google"],
        requireLocalEmailVerified: true,
      },
    },
    databaseHooks: {
      // Identity is verified before these storage hooks. This app never calls
      // Google APIs after login, so discard all unused bearer tokens, including
      // idToken (Better Auth 1.7.4 does not encrypt that field).
      account: {
        create: {
          before: async (account) => ({
            data: {
              ...account,
              accessToken: null,
              refreshToken: null,
              idToken: null,
            },
          }),
        },
        update: {
          before: async (account) => ({
            data: {
              ...account,
              accessToken: null,
              refreshToken: null,
              idToken: null,
            },
          }),
        },
      },
    },
    onAPIError: { errorURL: "/" },
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
      customRules: {
        "/sign-in/email": { window: 60, max: 10 },
        "/sign-in/social": { window: 60, max: 10 },
        "/callback/google": { window: 60, max: 20 },
      },
    },
    // Upstream errors can include OAuth state and database parameter values.
    // Keep operational severity without persisting identity/token details.
    logger: {
      log: (level) => {
        if (process.env.NODE_ENV !== "test")
          console.warn(JSON.stringify({ event: "auth_event", level }));
      },
    },
    telemetry: { enabled: false },
  } satisfies BetterAuthOptions;
}
export function createAuth(database: Database) {
  return betterAuth(authOptions(database));
}
export type Auth = ReturnType<typeof createAuth>;
