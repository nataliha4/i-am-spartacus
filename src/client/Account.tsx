import { useState, type FormEvent } from "react";
import { authClient } from "./auth-client";
import { api } from "./api";
import { useTracker } from "./TrackerProvider";
import type { ImportPreview } from "../shared/import";

export function Login({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await authClient.signIn.email({ email, password });
      if (result.error) setError(result.error.message ?? "Unable to sign in");
      else {
        setPassword("");
        onSuccess();
      }
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
      <form onSubmit={submit}>
        <h2>Sign in</h2>
        <label>
          Email
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
      <p className="muted">
        Accounts are managed by the operator. Contact them to get access or
        reset your password.
      </p>
      <InstallHelp />
    </main>
  );
}
export function InstallHelp() {
  return (
    <details>
      <summary>Install this app</summary>
      <p>
        On Android or desktop Chrome, choose “Install app” in the browser menu.
        On iPhone or iPad, open in Safari, tap Share, then “Add to Home Screen”.
        An internet connection is required to load your tracker and save
        changes.
      </p>
    </details>
  );
}
export function AccountTools({
  email,
  onLogout,
}: {
  email: string;
  onLogout: () => Promise<void>;
}) {
  const { state, setAppSettings, save } = useTracker();
  const [open, setOpen] = useState(false),
    [message, setMessage] = useState("");
  const [currentPassword, setCurrentPassword] = useState(""),
    [newPassword, setNewPassword] = useState("");
  const [timezone, setTimezone] = useState(String(state.appSettings.timezone));
  const [file, setFile] = useState<unknown>(null),
    [preview, setPreview] = useState<Omit<ImportPreview, "rows"> | null>(null),
    [busy, setBusy] = useState(false);
  async function changePassword(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      if (result.error)
        setMessage(result.error.message ?? "Unable to change password");
      else {
        setCurrentPassword("");
        setNewPassword("");
        setMessage("Password changed. Other sessions were revoked.");
      }
    } catch {
      setMessage("Unable to connect. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function loadFile(value: File | undefined) {
    setPreview(null);
    setFile(null);
    setMessage("");
    if (!value) return;
    if (value.size > 9 * 1024 * 1024) {
      setMessage("Choose an export smaller than 9 MB.");
      return;
    }
    setBusy(true);
    try {
      const parsed: unknown = JSON.parse(await value.text());
      const result = await api<Omit<ImportPreview, "rows">>("/import/preview", {
        file: parsed,
        timezone,
      });
      setFile(parsed);
      setPreview(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Invalid export");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="account-tools">
      <button onClick={() => setOpen(!open)}>Account &amp; data</button>
      <span>{email}</span>
      {open && (
        <div className="account-card">
          <button onClick={() => void onLogout()}>Sign out</button>
          <h2>Account</h2>
          <form onSubmit={changePassword}>
            <label>
              Current password
              <input
                type="password"
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </label>
            <label>
              New password
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </label>
            <button disabled={busy}>Change password</button>
          </form>
          <label>
            Tracker timezone
            <input
              value={timezone}
              onChange={(e) => {
                setTimezone(e.target.value);
                setPreview(null);
              }}
            />
          </label>
          <button
            disabled={busy}
            onClick={async () => {
              if (await setAppSettings({ ...state.appSettings, timezone }))
                setMessage("Timezone saved. Existing dates are preserved.");
            }}
          >
            Save timezone
          </button>
          <h2>Data transfer</h2>
          <a href="/api/v1/export" download>
            Download account export
          </a>
          <p>
            Import into an empty tracker before logging data or saving settings.
            Export each old browser on its original site. Keep the original file
            as a backup.
          </p>
          <label>
            Choose export JSON
            <input
              type="file"
              accept=".json,application/json"
              disabled={busy}
              onChange={(e) => void loadFile(e.target.files?.[0])}
            />
          </label>
          {preview && (
            <div>
              <p>Import timezone: {timezone}</p>
              <ul>
                {Object.entries(preview.counts).map(([kind, count]) => (
                  <li key={kind}>
                    {kind}: {count}
                  </li>
                ))}
              </ul>
              {preview.warnings.map((warning, i) => (
                <p key={i}>{warning}</p>
              ))}
              {preview.issues.map((issue, i) => (
                <p role="alert" key={i}>
                  {issue}
                </p>
              ))}
              <button
                disabled={busy || preview.issues.length > 0}
                onClick={async () => {
                  if (await save("/import", { file, timezone })) {
                    setPreview(null);
                    setFile(null);
                    setMessage(
                      "Import complete. Your original file is unchanged.",
                    );
                  }
                }}
              >
                Confirm import into this account
              </button>
            </div>
          )}
          {message && <p role="status">{message}</p>}
          <InstallHelp />
        </div>
      )}
    </div>
  );
}
