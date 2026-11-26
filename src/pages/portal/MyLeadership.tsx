import { useEffect, useState, type FormEvent } from "react";
import { Navigate } from "react-router";
import { api, errorMessage } from "../../lib/api";
import { useAuth, useMe } from "../../lib/auth";
import { usePortal } from "../../lib/portal";
import { formatDate, levelLabel } from "../../lib/format";
import { canRenew, formatDay, roleState } from "../../lib/academic";
import type { LeaderLevel } from "../../lib/types";
import { Alert, PageHeader, SelectInput, StatusBadge, TextInput } from "../../components/ui";
import { PastLeadershipSection } from "../../components/PastLeadership";

/** Current leader roles: request, edit or withdraw a request, renew, step down. */
export function MyLeadershipPage() {
  const me = useMe();
  useEffect(() => {
    document.title = "My leadership — MSAK";
  }, []);
  if (!me.profile) return <Navigate to="/app" replace />;
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="My leadership">Leader roles you hold or have asked for. Each role is confirmed by the level above it.</PageHeader>
      <LeadershipSection />
    </div>
  );
}

/** Positions held in past years (mainly alumni); a leader confirms them. */
export function MyPastLeadershipPage() {
  const me = useMe();
  useEffect(() => {
    document.title = "Past leadership — MSAK";
  }, []);
  if (!me.profile) return <Navigate to="/app" replace />;
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Past leadership">
        Positions you held on your campus, in your region or nationally in past years. A leader confirms each one, and you choose whether it
        appears on the public Past leaders page.
      </PageHeader>
      {me.profile.verification === "declined" ? (
        <Alert tone="warn">Past positions can be added once a leader confirms your membership.</Alert>
      ) : (
        <PastLeadershipSection />
      )}
    </div>
  );
}

function LeadershipSection() {
  const me = useMe();
  const { refresh } = useAuth();
  const { lookup } = usePortal();
  const [level, setLevel] = useState<LeaderLevel>("institutional");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const open = me.roles.filter((r) => r.status === "pending" || r.status === "approved");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftPosition, setDraftPosition] = useState("");
  const [rowError, setRowError] = useState<string | null>(null);

  async function saveRequest(id: string) {
    setRowError(null);
    try {
      await api.updateLeaderRequest(id, draftPosition);
      setEditingId(null);
      await refresh();
    } catch (e) {
      setRowError(errorMessage(e));
    }
  }
  async function withdraw(id: string) {
    if (!confirm("Withdraw this leadership request?")) return;
    setRowError(null);
    try {
      await api.withdrawLeaderRequest(id);
      await refresh();
    } catch (e) {
      setRowError(errorMessage(e));
    }
  }
  const available = (["institutional", "regional", "national"] as const).filter((l) => !open.some((r) => r.level === l));
  const chosen = available.includes(level) ? level : available[0];

  async function request(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true);
    setMsg(null);
    try {
      await api.requestLeaderRole(chosen, String(f.get("position") ?? ""));
      await refresh();
      setMsg({ tone: "success", text: "Request sent. You'll be able to post once it's verified." });
      form.reset();
    } catch (err) {
      setMsg({ tone: "error", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="lead-h" className="card flex flex-col gap-4 p-5 sm:p-6">
      <h2 id="lead-h" className="font-serif text-xl font-semibold text-navy-900">
        Your roles
      </h2>
      {me.roles.length === 0 ? (
        <p className="text-sm text-body">You don't hold a leadership role in the portal.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {me.roles.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line p-3">
              <span>
                {editingId === r.id ? (
                  <span className="flex flex-wrap items-end gap-2">
                    <span className="min-w-[200px] flex-1">
                      <TextInput
                        label={`${levelLabel[r.level]} leader — position`}
                        value={draftPosition}
                        onChange={(e) => setDraftPosition(e.target.value)}
                        maxLength={100}
                        autoFocus
                      />
                    </span>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => void saveRequest(r.id)} disabled={draftPosition.trim().length < 2}>
                      Save
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>
                      Cancel
                    </button>
                  </span>
                ) : (
                  <span className="block font-semibold text-navy-900">
                    {levelLabel[r.level]} leader · {r.position}
                  </span>
                )}
                <span className="block text-[13px] text-muted">
                  {r.level === "institutional"
                    ? lookup.institution(r.institution_id)?.name
                    : r.level === "regional"
                      ? lookup.association(r.association_id)?.name
                      : "All of MSAK"}{" "}
                  {r.status === "approved" && r.term_ends_on
                    ? ` · ${roleState(r) === "expired" ? "term ended" : "term ends"} ${formatDay(r.term_ends_on)}`
                    : ` · requested ${formatDate(r.requested_at)}`}
                  {r.review_note ? ` · “${r.review_note}”` : ""}
                </span>
                {roleState(r) === "expired" && (
                  <span className="mt-1 block text-[13px] font-semibold text-gold-800">
                    Expired at the end of the academic year — renew to post again.
                  </span>
                )}
                {roleState(r) === "renewal" && (
                  <span className="mt-1 block text-[13px] text-muted">Renewal for next year is waiting for approval.</span>
                )}
              </span>
              <span className="flex flex-wrap items-center gap-2">
                <StatusBadge status={roleState(r)} />
                {canRenew(r) && (
                  <button
                    type="button"
                    className="btn btn-gold btn-sm"
                    onClick={async () => {
                      try {
                        await api.renewLeaderRole(r.id);
                        await refresh();
                      } catch (e) {
                        alert(errorMessage(e));
                      }
                    }}
                  >
                    Renew for next year
                  </button>
                )}
                {r.status === "pending" && editingId !== r.id && (
                  <>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        setEditingId(r.id);
                        setDraftPosition(r.position);
                        setRowError(null);
                      }}
                    >
                      Edit
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm text-danger" onClick={() => void withdraw(r.id)}>
                      Withdraw
                    </button>
                  </>
                )}
                {r.status === "approved" && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={async () => {
                      if (!confirm("Step down from this role? You'll lose its posting rights.")) return;
                      try {
                        await api.revokeLeaderRole(r.id, "Stepped down");
                        await refresh();
                      } catch (e) {
                        alert(errorMessage(e));
                      }
                    }}
                  >
                    Step down
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {rowError && <Alert tone="error">{rowError}</Alert>}
      {open.some((r) => r.status === "pending") && (
        <p className="text-[13px] text-muted">Wrong level (campus, regional or national)? Withdraw the request and send a new one — a different person approves each level.</p>
      )}

      {me.profile?.verification === "declined" && (
        <p className="border-t border-line pt-4 text-sm text-muted">Leader roles can be requested once a leader confirms your membership.</p>
      )}
      {available.length > 0 && chosen && me.profile?.verification !== "declined" && (
        <form onSubmit={request} className="grid gap-4 border-t border-line pt-4 sm:grid-cols-[200px_1fr_auto] sm:items-end">
          <SelectInput label="Request a role" value={chosen} onChange={(e) => setLevel(e.target.value as LeaderLevel)}>
            {available.map((l) => (
              <option key={l} value={l}>
                {levelLabel[l]} leader
              </option>
            ))}
          </SelectInput>
          <TextInput label="Position" name="position" required minLength={2} maxLength={100} placeholder="e.g. Chairperson" />
          <button type="submit" className="btn btn-outline" disabled={busy}>
            {busy ? "Sending…" : "Send request"}
          </button>
          <p className="text-[13px] text-muted sm:col-span-3">
            {chosen === "institutional"
              ? "Verified by your regional leaders."
              : "Verified by an MSAK administrator."}
          </p>
        </form>
      )}
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
    </section>
  );
}
