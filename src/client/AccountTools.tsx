import { IMPORT_FILE_BYTES } from "../shared/limits";
import { useState } from "react";
import { InstallHelp } from "./InstallHelp";
import { DeleteAccount } from "./DeleteAccount";
import { api } from "./api";
import { useTracker } from "./TrackerProvider";
import type { ImportPreview } from "../shared/import";

export function AccountTools({
  email,
  onLogout,
  onDeleted,
}: {
  email: string;
  onLogout: () => Promise<void>;
  onDeleted: () => Promise<void>;
}) {
  const { state, setAppSettings, save } = useTracker();
  const [open, setOpen] = useState(false),
    [message, setMessage] = useState("");
  const [timezone, setTimezone] = useState(String(state.appSettings.timezone));
  const [file, setFile] = useState<unknown>(null),
    [preview, setPreview] = useState<Omit<ImportPreview, "rows"> | null>(null),
    [busy, setBusy] = useState(false);
  async function loadFile(value: File | undefined) {
    setPreview(null);
    setFile(null);
    setMessage("");
    if (!value) return;
    if (value.size > IMPORT_FILE_BYTES) {
      setMessage("Choose an export smaller than 16 MiB.");
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
          <p>
            <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a>
          </p>
          <DeleteAccount onDeleted={onDeleted} />
          <InstallHelp />
        </div>
      )}
    </div>
  );
}
