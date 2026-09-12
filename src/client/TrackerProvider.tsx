import {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "./api";
import { canonical, type Kind, type Snapshot } from "../shared/model";
import { diffState, project, type LegacyState } from "../shared/legacy";

type Update<T> = T | ((previous: T) => T);
type Save = (path: string, body: unknown) => Promise<boolean>;
type Context = {
  state: LegacyState;
  setEntries: (update: Update<LegacyState["entries"]>) => Promise<boolean>;
  setRecurringSupps: (
    update: Update<LegacyState["recurringSupps"]>,
  ) => Promise<boolean>;
  setRecurringGym: (
    update: Update<LegacyState["recurringGym"]>,
  ) => Promise<boolean>;
  setAppSettings: (
    update: Update<LegacyState["appSettings"]>,
  ) => Promise<boolean>;
  setActiveFast: (
    update: Update<LegacyState["activeFast"]>,
  ) => Promise<boolean>;
  startFastRemote: () => Promise<boolean>;
  stopFastRemote: () => Promise<boolean>;
  removeEntity: (kind: Kind, id: string, revision: number) => Promise<boolean>;
  save: Save;
  refresh: () => Promise<unknown>;
};
const TrackerContext = createContext<Context | null>(null);
export function useTracker() {
  const value = useContext(TrackerContext);
  if (!value) throw new Error("TrackerProvider is required");
  return value;
}
export function TrackerProvider({
  userId,
  children,
  onExpired,
  onLogout,
}: {
  userId: string;
  children: ReactNode;
  onExpired: () => void;
  onLogout: () => Promise<void>;
}) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false),
    [failure, setFailure] = useState<ApiError | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [saved, setSaved] = useState(false);
  const pending = useRef<{
    path: string;
    body: unknown;
    key: string;
    waiters: Array<(confirmed: boolean) => void>;
  } | null>(null);
  const inFlight = useRef(false);
  const query = useQuery({
    queryKey: ["tracker", userId],
    queryFn: () => api<Snapshot>("/state"),
    staleTime: 10000,
    refetchInterval: busy || failure ? false : 30000,
    refetchOnWindowFocus: !busy && !failure,
    refetchOnReconnect: !busy && !failure,
    retry: false,
  });
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const projection = useMemo(() => {
    try {
      return {
        state: project(query.data?.rows ?? [], timezone),
        failed: false,
      };
    } catch {
      return { state: project([], timezone), failed: true };
    }
  }, [query.data, timezone]);
  const state = projection.state;
  const stateRef = useRef(state);
  stateRef.current = state;
  const rowsRef = useRef(query.data?.rows ?? []);
  rowsRef.current = query.data?.rows ?? [];
  // Event subscriptions are installed by a small effect, never persisted to browser storage.
  useConnection(setOnline);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (pending.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      pending.current?.waiters.forEach((resolve) => resolve(false));
    };
  }, []);
  const save: Save = async (path, body) => {
    if (inFlight.current || failure?.status === 409) return false;
    if (!navigator.onLine) {
      setFailure(
        new ApiError(
          0,
          "OFFLINE",
          "You are offline. Connect before saving. Your form remains open.",
        ),
      );
      return false;
    }
    const prior = pending.current;
    if (
      prior &&
      (prior.path !== path || canonical(prior.body) !== canonical(body))
    ) {
      setFailure(
        new ApiError(
          0,
          "PENDING",
          "Retry the unconfirmed save before making another change.",
        ),
      );
      return false;
    }
    pending.current ??= { path, body, key: crypto.randomUUID(), waiters: [] };
    inFlight.current = true;
    setBusy(true);
    setSaved(false);
    await queryClient.cancelQueries({ queryKey: ["tracker", userId] });
    try {
      const result = await api<Snapshot>(path, body, pending.current.key);
      queryClient.setQueryData(["tracker", userId], result);
      rowsRef.current = result.rows;
      stateRef.current = project(result.rows, timezone);
      pending.current.waiters.forEach((resolve) => resolve(true));
      pending.current = null;
      setFailure(null);
      setSaved(true);
      return true;
    } catch (error) {
      const problem =
        error instanceof ApiError
          ? error
          : new ApiError(
              400,
              "INVALID",
              error instanceof Error ? error.message : "Invalid input",
            );
      if (problem.status > 0 && problem.status < 500) {
        pending.current?.waiters.forEach((resolve) => resolve(false));
        pending.current = null;
      }
      if (problem.status === 401) {
        queryClient.clear();
        onExpired();
      }
      setFailure(problem);
      // Resume the original form's success cleanup only after a retry confirms the write.
      if (pending.current)
        return new Promise<boolean>((resolve) =>
          pending.current!.waiters.push(resolve),
        );
      return false;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const update =
    <K extends keyof LegacyState>(key: K) =>
    async (value: Update<LegacyState[K]>) => {
      try {
        const current = stateRef.current;
        const next = {
          ...current,
          [key]:
            typeof value === "function"
              ? (value as (v: LegacyState[K]) => LegacyState[K])(
                  structuredClone(current[key]),
                )
              : value,
        };
        const operations = diffState(current, next, rowsRef.current);
        if (!operations.length) return true;
        return await save("/commit", { operations });
      } catch (error) {
        setFailure(
          new ApiError(
            400,
            "INVALID",
            error instanceof Error ? error.message : "Invalid input",
          ),
        );
        return false;
      }
    };
  const refresh = async () => {
    setFailure(null);
    return query.refetch();
  };
  if (query.error instanceof ApiError && query.error.status === 401)
    return <SessionExpired onExpired={onExpired} />;
  if (!query.data)
    return (
      <div className="account-card" role="status">
        {query.isPending ? (
          "Loading your tracker…"
        ) : (
          <>
            <p>{query.error?.message ?? "Unable to load tracker"}</p>
            <button onClick={() => void query.refetch()}>Retry</button>
          </>
        )}
      </div>
    );
  if (projection.failed)
    return (
      <div className="account-card" role="alert">
        <p>
          Your tracker contains data that cannot be displayed. Your records have
          not been changed.
        </p>
        <p>
          Download your original data and contact the operator for help
          repairing it.
        </p>
        <a href="/api/v1/export">Download original export</a>{" "}
        <button onClick={() => void onLogout()}>Sign out</button>
      </div>
    );
  const context: Context = {
    state,
    removeEntity: (kind, id, revision) =>
      save("/commit", {
        operations: [{ action: "delete", kind, id, revision }],
      }),
    setEntries: update("entries"),
    setRecurringSupps: update("recurringSupps"),
    setRecurringGym: update("recurringGym"),
    setAppSettings: update("appSettings"),
    setActiveFast: update("activeFast"),
    save,
    refresh,
    startFastRemote: () =>
      save("/fast/start", { timezone: stateRef.current.appSettings.timezone }),
    stopFastRemote: () => {
      const active = rowsRef.current.find(
        (row) => row.kind === "fast" && row.data.endTimestampMs === null,
      );
      return active
        ? save("/fast/stop", { id: active.id, revision: active.revision })
        : Promise.resolve(false);
    },
  };
  return (
    <TrackerContext.Provider value={context}>
      <div className="save-status" aria-live="polite">
        {!online
          ? "Offline — connect to save changes."
          : busy
            ? "Saving…"
            : saved
              ? "✓ Saved to your account"
              : null}
        {query.error && (
          <p>Unable to refresh. Showing the last confirmed data.</p>
        )}
        {failure && (
          <div role="alert">
            <p>{failure.message}</p>
            {pending.current ? (
              <button
                disabled={!online || busy}
                onClick={() => {
                  const p = pending.current!;
                  void save(p.path, p.body);
                }}
              >
                Retry unconfirmed save
              </button>
            ) : (
              <button onClick={() => void refresh()}>
                {failure.status === 409
                  ? "Reload latest data and review"
                  : "Dismiss"}
              </button>
            )}
          </div>
        )}
      </div>
      <fieldset
        className="tracker-fieldset"
        disabled={
          busy || !online || Boolean(pending.current) || failure?.status === 409
        }
        onClickCapture={(event) => {
          if (busy || !online || pending.current || failure?.status === 409) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        {children}
      </fieldset>
    </TrackerContext.Provider>
  );
}
import { useEffect } from "react";
function useConnection(setOnline: (value: boolean) => void) {
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, [setOnline]);
}
function SessionExpired({ onExpired }: { onExpired: () => void }) {
  useEffect(onExpired, [onExpired]);
  return <p>Your session expired. Please sign in again.</p>;
}
