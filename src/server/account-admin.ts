import type { Database } from "../db/connection";

// Only call after the operator independently verifies control of this exact
// email/account. Remove the old password and sessions before Google can link.
export async function prepareGoogleAccount(database: Database, email: string) {
  return database.client.begin(async (sql) => {
    const [user] = await sql`SELECT id FROM auth_user WHERE email=${email}`;
    if (!user) throw new Error("Account not found");
    await sql`SELECT pg_advisory_xact_lock(hashtextextended(${user.id},0))`;
    await sql`DELETE FROM auth_account WHERE user_id=${user.id} AND provider_id='credential'`;
    await sql`DELETE FROM auth_session WHERE user_id=${user.id}`;
    await sql`DELETE FROM auth_verification WHERE identifier LIKE 'reset-password:%' AND value=${user.id}`;
    await sql`UPDATE auth_user SET email_verified=true, updated_at=now() WHERE id=${user.id}`;
  });
}
