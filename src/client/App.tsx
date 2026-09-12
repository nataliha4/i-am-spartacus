import { useCallback, useEffect, useState, lazy, Suspense } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRegisterSW } from "virtual:pwa-register/react";
import { authClient } from "./auth-client";
import { Login, AccountTools } from "./Account";
import { TrackerProvider } from "./TrackerProvider";
const Tracker = lazy(() => import("./tracker/Tracker"));

export default function App() {
  const session = authClient.useSession();
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
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
    queryClient.clear();
    void session.refetch();
  }, [queryClient, session.refetch]);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  useEffect(() => {
    const clear = () => queryClient.clear();
    const channel = new BroadcastChannel("spartacus-session");
    channel.onmessage = () => {
      clear();
      void session.refetch();
    };
    return () => channel.close();
  }, [queryClient, session.refetch]);
  async function logout() {
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setError("Sign out failed. Please retry.");
        return;
      }
      queryClient.clear();
      const channel = new BroadcastChannel("spartacus-session");
      channel.postMessage("changed");
      channel.close();
      await session.refetch();
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
      ) : session.data ? (
        <TrackerProvider
          key={session.data.user.id}
          userId={session.data.user.id}
          onExpired={expired}
        >
          <AccountTools email={session.data.user.email} onLogout={logout} />
          <Suspense fallback={<p className="account-card">Loading tracker…</p>}>
            <Tracker />
          </Suspense>
        </TrackerProvider>
      ) : (
        <Login onSuccess={() => void session.refetch()} />
      )}
    </>
  );
}
