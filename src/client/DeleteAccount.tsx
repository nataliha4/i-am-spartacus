import { useState } from "react";
import { api } from "./api";

export function DeleteAccount({
  onDeleted,
}: {
  onDeleted: () => Promise<void>;
}) {
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <details>
      <summary>Delete my account</summary>
      <p>
        This permanently removes your tracker and signs out every device.
        Download an export first if you want a copy. A sign-in within the last
        10 minutes is required.
      </p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          try {
            await api("/account/delete", { confirmation });
            await onDeleted();
          } catch (error) {
            setError(
              error instanceof Error
                ? error.message
                : "Unable to delete account",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Type DELETE to confirm
          <input
            value={confirmation}
            autoComplete="off"
            disabled={busy}
            onChange={(e) => setConfirmation(e.target.value)}
          />
        </label>
        <button disabled={busy || confirmation !== "DELETE"}>
          {busy ? "Deleting…" : "Permanently delete my account"}
        </button>
        {error && <p role="alert">{error}</p>}
      </form>
    </details>
  );
}
