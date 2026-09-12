import { z } from "zod";

// Secrets and operator policy are runtime configuration, never Vite build inputs.
export function googleCredentials(env = process.env) {
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  if (Boolean(clientId) !== Boolean(clientSecret))
    throw new Error(
      "Set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or neither",
    );
  if (!clientId || !clientSecret) return undefined;
  if (env.NODE_ENV === "production") {
    policyConfiguration(env); // Do not open signup without a published operator policy.
    const url = new URL(env.BETTER_AUTH_URL!);
    if (url.protocol !== "https:" && url.hostname !== "localhost")
      throw new Error(
        "Production Google sign-in requires an HTTPS BETTER_AUTH_URL",
      );
  }
  return { clientId, clientSecret };
}
export function policyConfiguration(env = process.env) {
  return z
    .object({
      operator: z.string().trim().min(1).max(200),
      contact: z.email(),
      backupDays: z
        .string()
        .regex(/^\d+$/)
        .transform(Number)
        .pipe(z.number().int().min(0).max(365)),
      logDays: z
        .string()
        .regex(/^\d+$/)
        .transform(Number)
        .pipe(z.number().int().min(0).max(365)),
    })
    .parse({
      operator: env.OPERATOR_NAME,
      contact: env.PRIVACY_CONTACT,
      backupDays: env.BACKUP_RETENTION_DAYS,
      logDays: env.LOG_RETENTION_DAYS,
    });
}
