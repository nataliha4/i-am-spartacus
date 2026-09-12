import { useState } from "react";
import { authClient } from "./auth-client";
import { InstallHelp } from "./InstallHelp";

function callbackError() {
  const code = new URLSearchParams(window.location.search).get("error");
  if (!code) return "";
  if (code === "account_not_linked")
    return "This email belongs to an existing account. Contact the operator to move it to Google sign-in.";
  if (code === "unable_to_create_user")
    return "Signup could not be completed. Account capacity may be full; contact the operator.";
  return "Google sign-in was not completed. Please try again or contact the operator.";
}
export function Login() {
  const [error, setError] = useState(callbackError);
  const [busy, setBusy] = useState(false);
  async function signIn() {
    setBusy(true);
    setError("");
    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: "/",
        errorCallbackURL: "/",
      });
      if (result.error) setError(result.error.message ?? "Unable to sign in");
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="account-card">
      <h1>💪 I AM SPARTACUS 💪</h1>
      <p>My Daily Tracker for Health and Activity</p>
      <h2>Sign in or create an account</h2>
      <p>
        Keep your tracker private and available across devices. New accounts are
        welcome while space is available.
      </p>
      {error && <p role="alert">{error}</p>}
      <button disabled={busy} onClick={() => void signIn()}>
        {busy ? "Connecting…" : "Continue with Google"}
      </button>
      <p>
        By continuing, you agree to the <a href="/terms">Terms</a>. Read how we
        handle your data in <a href="/privacy">Privacy</a>.
      </p>
      <InstallHelp />
    </main>
  );
}
