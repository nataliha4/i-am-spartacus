import { useCallback, useEffect, useState, lazy, Suspense } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRegisterSW } from "virtual:pwa-register/react";
import { authClient } from "./auth-client";
import { Login } from "./Login";
import { AccountTools } from "./AccountTools";
import { TrackerProvider } from "./TrackerProvider";
const Tracker = lazy(() => import("./tracker/Tracker"));

export default function App() {
  const session = authClient.useSession();
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  // Unmount private queries immediately on expiry/deletion/sign-out. Clearing
  // their cache while still mounted can otherwise refetch in a 401 loop.
  // Google login navigates the document, resetting this flag for the new session.
  const [sessionInvalid, setSessionInvalid] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  const expired = useCallback(() => {
    setSessionInvalid(true);
    queryClient.clear();
    void session.refetch();
  }, [queryClient, session.refetch]);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  useEffect(() => {
    const channel = new BroadcastChannel("spartacus-session");
    channel.onmessage = () => {
      expired();
    };
    return () => channel.close();
  }, [expired]);
  async function clearSession() {
    setSessionInvalid(true);
    queryClient.clear();
    const channel = new BroadcastChannel("spartacus-session");
    channel.postMessage("changed");
    channel.close();
    await session.refetch();
  }
  async function logout() {
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setError("Sign out failed. Please retry.");
        return;
      }
      await clearSession();
    } catch {
      setError(
        "Unable to sign out while disconnected. Please reconnect and retry.",
      );
    }
  }
  return (
    <>
      {!online && !session.data && (
        <p className="account-card" role="status">
          Offline — connect to open your tracker.
        </p>
      )}
      {needRefresh && (
        <div className="update-banner">
          <p>
            An update is ready. Save or finish your current form before
            reloading.
          </p>
          <button onClick={() => void updateServiceWorker(true)}>
            Reload app
          </button>
          <button onClick={() => setNeedRefresh(false)}>Later</button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      {session.isPending ? (
        <p className="account-card">Loading…</p>
      ) : session.data && !sessionInvalid ? (
        <TrackerProvider
          key={session.data.user.id}
          userId={session.data.user.id}
          onExpired={expired}
          onLogout={logout}
        >
          <AccountTools
            email={session.data.user.email}
            onLogout={logout}
            onDeleted={clearSession}
          />
          <Suspense fallback={<p className="account-card">Loading tracker…</p>}>
            <Tracker />
          </Suspense>
        </TrackerProvider>
      ) : (
        <Login />
      )}
    </>
  );
}
