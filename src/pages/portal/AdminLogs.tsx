import { useCallback, useEffect, useState } from "react";
import { Navigate, useSearchParams } from "react-router";
import { Trash2 } from "lucide-react";
import { api, errorMessage } from "../../lib/api";
import { usePortal } from "../../lib/portal";
import type { AuditEntry, ErrorEntry } from "../../lib/types";
import { Alert, EmptyState, PageHeader, Spinner } from "../../components/ui";

export const ActivityLogPage = () => <AdminLogsPage tab="activity" />;
export const ErrorLogPage = () => <AdminLogsPage tab="errors" />;

/** Links from before the logs had their own addresses. */
export function OldLogsRedirect() {
  const [params] = useSearchParams();
  return <Navigate to={params.get("tab") === "errors" ? "/app/admin/errors" : "/app/admin/activity"} replace />;
}

/** Admin only: what people changed in the portal, and errors the app hit on people's devices. */
function AdminLogsPage({ tab }: { tab: "activity" | "errors" }) {
  const { perms } = usePortal();

  useEffect(() => {
    document.title = `${tab === "errors" ? "Error log" : "Activity log"} — MSAK`;
  }, [tab]);

  if (!perms.isAdmin) return <Navigate to="/app" replace />;

  return (
    <div>
      <PageHeader eyebrow="Administrators only" title={tab === "errors" ? "Error log" : "Activity log"}>
        Members and leaders never see these pages. Entries are kept until you clear them.
      </PageHeader>

      {tab === "activity" ? <ActivityLog /> : <ErrorLog />}
      <PurgeLogs />
    </div>
  );
}

const ENTITIES: [string, string][] = [
  ["", "Everything"],
  ["announcements", "Announcements"],
  ["leader_roles", "Leader roles"],
  ["churches", "Churches"],
  ["church_reports", "Church reports"],
  ["profiles", "Member accounts"],
  ["documents", "Documents"],
  ["home_banners", "Homepage banners"],
  ["institutions", "Institutions"],
  ["admins", "Administrators"],
];
const entityName = (e: string) => ENTITIES.find(([k]) => k === e)?.[1].replace(/s$/, "").toLowerCase() ?? e;
const verb = (a: AuditEntry["action"]) => (a === "insert" ? "added" : a === "delete" ? "removed" : "changed");

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-KE", { timeZone: "Africa/Nairobi", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Friendlier names for the columns most often changed. */
const FIELD: Record<string, string> = {
  status: "status",
  term_ends_on: "term ends",
  renewal_requested_at: "renewal requested",
  reviewed_at: "reviewed",
  review_note: "review note",
  lat: "latitude",
  lng: "longitude",
  location_verified: "pin confirmed",
  photo_url: "photo",
  institution_id: "institution",
  expected_completion_year: "completion year",
};

function show(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v === "object") return JSON.stringify(v);
  const s = String(v);
  return s.length > 120 ? `${s.slice(0, 120)}…` : s;
}

function ActivityLog() {
  const [entity, setEntity] = useState("");
  const [rows, setRows] = useState<AuditEntry[] | null>(null);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    (before?: number) => {
      api
        .listAuditLog({ before, entity: entity || undefined })
        .then((r) => {
          setRows((prev) => (before && prev ? [...prev, ...r] : r));
          setMore(r.length === 50);
        })
        .catch((e) => setError(errorMessage(e)));
    },
    [entity],
  );

  useEffect(() => {
    setRows(null);
    load();
  }, [load]);

  return (
    <section aria-label="Activity log">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label htmlFor="ent" className="text-sm font-semibold text-navy-900">
          Show
        </label>
        <select id="ent" className="input w-auto" value={entity} onChange={(e) => setEntity(e.target.value)}>
          {ENTITIES.map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      {rows === null ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState title="Nothing logged yet">Changes people make in the portal (posts, approvals, church edits…) will appear here.</EmptyState>
      ) : (
        <ol className="card divide-y divide-line">
          {rows.map((r) => {
            const changes = r.changes ? Object.entries(r.changes) : [];
            return (
              <li key={r.id} className="flex flex-col gap-1 px-4 py-3 sm:px-5">
                <p className="text-sm text-ink">
                  <strong className="text-navy-900">{r.actor_label}</strong> {verb(r.action)} {entityName(r.entity)}
                  {r.summary && (
                    <>
                      {" "}
                      <span className="font-semibold">“{r.summary}”</span>
                    </>
                  )}
                </p>
                <p className="text-[12px] text-muted">{when(r.at)}</p>
                {changes.length > 0 && (
                  <details className="text-[13px] text-body">
                    <summary className="cursor-pointer font-semibold text-navy-700">
                      {changes.length} field{changes.length > 1 ? "s" : ""} changed
                    </summary>
                    <ul className="mt-1 space-y-0.5 pl-4">
                      {changes.map(([k, v]) => (
                        <li key={k} className="break-words">
                          <span className="text-muted">{FIELD[k] ?? k.replace(/_/g, " ")}:</span> {show(v)}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {more && rows && (
        <div className="mt-4 flex justify-center">
          <button type="button" className="btn btn-outline" onClick={() => load(rows[rows.length - 1].id)}>
            Load older entries
          </button>
        </div>
      )}
    </section>
  );
}

/** Short device description from the browser's user-agent string. */
function device(ua: string | null): string {
  if (!ua) return "Unknown device";
  const os = /Android/i.test(ua) ? "Android" : /iPhone|iPad/i.test(ua) ? "iPhone/iPad" : /Windows/i.test(ua) ? "Windows" : /Mac OS/i.test(ua) ? "Mac" : /Linux/i.test(ua) ? "Linux" : "Other";
  const br = /Edg\//.test(ua) ? "Edge" : /OPR\/|Opera/.test(ua) ? "Opera" : /SamsungBrowser/.test(ua) ? "Samsung Internet" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return `${br} on ${os}`;
}

function ErrorLog() {
  const [rows, setRows] = useState<ErrorEntry[] | null>(null);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((before?: number) => {
    api
      .listErrorLog({ before })
      .then((r) => {
        setRows((prev) => (before && prev ? [...prev, ...r] : r));
        setMore(r.length === 50);
      })
      .catch((e) => setError(errorMessage(e)));
  }, []);

  useEffect(() => load(), [load]);

  async function remove(id: number) {
    try {
      await api.deleteErrorEntry(id);
      setRows((r) => r?.filter((x) => x.id !== id) ?? null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <section aria-label="App errors">
      <p className="mb-4 max-w-2xl text-sm text-body">
        Errors the app hit on people's phones and computers, reported automatically. The same error is sent once per visit. Fix the cause, then
        delete the entry.
      </p>
      {error && <Alert tone="error">{error}</Alert>}
      {rows === null ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState title="No errors reported">Good news — nothing has gone wrong for anyone, or it hasn't been reported yet.</EmptyState>
      ) : (
        <ol className="card divide-y divide-line">
          {rows.map((r) => (
            <li key={r.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
              <div className="min-w-0 flex-1">
                <p className="break-words font-mono text-[13px] font-semibold text-danger">{r.message}</p>
                <p className="mt-1 text-[12px] text-muted">
                  {when(r.at)} · {device(r.user_agent)}
                  {r.url && <> · {r.url.replace(/^https?:\/\/[^/]+/, "") || "/"}</>}
                  {r.user_id ? " · signed in" : " · signed out"}
                </p>
                {r.stack && (
                  <details className="mt-1 text-[12px]">
                    <summary className="cursor-pointer font-semibold text-navy-700">Technical details</summary>
                    <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap break-words rounded bg-paper p-2 font-mono text-[11px] text-body">{r.stack}</pre>
                  </details>
                )}
              </div>
              <button type="button" className="btn btn-ghost btn-sm flex-none" onClick={() => void remove(r.id)} aria-label="Delete this error entry">
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ol>
      )}
      {more && rows && (
        <div className="mt-4 flex justify-center">
          <button type="button" className="btn btn-outline" onClick={() => load(rows[rows.length - 1].id)}>
            Load older errors
          </button>
        </div>
      )}
    </section>
  );
}

function PurgeLogs() {
  const [days, setDays] = useState(180);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  async function purge() {
    if (!confirm(`Delete activity and error entries older than ${days} days? This can't be undone.`)) return;
    setBusy(true);
    setMsg(null);
    try {
      const n = await api.purgeLogs(days);
      setMsg({ tone: "success", text: n ? `Removed ${n} old entr${n === 1 ? "y" : "ies"}. Reload to refresh the list.` : "Nothing that old to remove." });
    } catch (e) {
      setMsg({ tone: "error", text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-labelledby="purge-h" className="mt-10 rounded-lg border border-line bg-white p-5">
      <h2 id="purge-h" className="font-semibold text-navy-900">
        Clear old entries
      </h2>
      <p className="mt-1 text-sm text-body">Keeps the logs small. Applies to both the activity and error logs.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label htmlFor="purge-days" className="text-sm">
          Older than
        </label>
        <select id="purge-days" className="input w-auto" value={days} onChange={(e) => setDays(Number(e.target.value))}>
          {[30, 90, 180, 365].map((d) => (
            <option key={d} value={d}>
              {d} days
            </option>
          ))}
        </select>
        <button type="button" className="btn btn-danger" onClick={() => void purge()} disabled={busy}>
          {busy ? "Clearing…" : "Clear"}
        </button>
      </div>
      {msg && (
        <div className="mt-3">
          <Alert tone={msg.tone}>{msg.text}</Alert>
        </div>
      )}
    </section>
  );
}
