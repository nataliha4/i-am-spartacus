import { connect } from "../src/db/connection";
import { createOperatorAuth } from "../src/server/operator-auth";
import { z } from "zod";
const [command, emailArgument, ...nameParts] = process.argv.slice(2);
const email = z.email().parse(emailArgument).toLowerCase();
if (!["create", "reset", "revoke"].includes(command))
  throw new Error(
    "Usage: bun run account:create <email> <name> | account:reset <email> | account:revoke <email>. Supply the password on stdin.",
  );
const database = connect(process.env.DATABASE_URL ?? "");
try {
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
      await auth.api.resetPassword({ body: { token, newPassword: password } });
      console.info("Password reset and existing sessions revoked");
    }
  }
} finally {
  await database.client.end({ timeout: 5 });
}
