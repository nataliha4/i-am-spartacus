import { connect } from "../src/db/connection";
import { createOperatorAuth } from "../src/server/operator-auth";
import { prepareGoogleAccount } from "../src/server/account-admin";
import { z } from "zod";
const [command, emailArgument, ...nameParts] = process.argv.slice(2);
const email = z.email().parse(emailArgument).toLowerCase();
if (!["create", "reset", "revoke", "google"].includes(command))
  throw new Error(
    "Usage: bun run account:create <email> <name> | account:reset <email> | account:revoke <email> | account:google <email> --verified-owner. Supply the password on stdin.",
  );
const database = connect(process.env.DATABASE_URL ?? "");
try {
  if (command === "google") {
    if (nameParts.join(" ") !== "--verified-owner")
      throw new Error(
        "Verify control of this exact email/account independently, then pass --verified-owner. This removes its password and revokes all sessions.",
      );
    await prepareGoogleAccount(database, email);
    console.info(
      "Account prepared for Google sign-in; password removed and sessions revoked",
    );
  } else {
    let token: string | undefined;
    const auth = createOperatorAuth(database, {
      onResetToken: (value) => {
        token = value;
      },
    });
    if (command === "revoke") {
      const affected =
        await database.client`DELETE FROM auth_session WHERE user_id IN (SELECT id FROM auth_user WHERE email=${email}) RETURNING id`;
      console.info(`Revoked ${affected.length} sessions`);
    } else {
      if (process.stdin.isTTY)
        throw new Error(
          "Supply the password through stdin (not command-line arguments). See the administration guide.",
        );
      const password = z
        .string()
        .min(12)
        .max(128)
        .parse((await Bun.stdin.text()).replace(/\r?\n$/, ""));
      if (command === "create") {
        const name = z.string().min(1).parse(nameParts.join(" "));
        await auth.api.createUser({
          body: { email, name, password, role: "user" },
        });
        console.info("Account created");
      } else {
        await auth.api.requestPasswordReset({ body: { email } });
        if (!token) throw new Error("Account not found");
        await auth.api.resetPassword({
          body: { token, newPassword: password },
        });
        console.info("Password reset and existing sessions revoked");
      }
    }
  }
} finally {
  await database.client.end({ timeout: 5 });
}
