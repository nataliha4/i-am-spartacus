import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import type { Database } from "../db/connection";
import { authOptions } from "./auth";

// Only CLI tools and test provisioning import this module.
export function createOperatorAuth(
  database: Database,
  options: { onResetToken?: (token: string) => void } = {},
) {
  return betterAuth({
    ...authOptions(database, options),
    rateLimit: { enabled: false },
    plugins: [admin()],
  });
}
