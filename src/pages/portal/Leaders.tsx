import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router";
import { Phone } from "lucide-react";
import { api, errorMessage } from "../../lib/api";
import { usePortal } from "../../lib/portal";
import { formatDate, levelLabel, timeAgo } from "../../lib/format";
import type { LeaderRoleWithPerson, RoleStatus } from "../../lib/types";
import { Alert, EmptyState, PageHeader, Spinner, StatusBadge } from "../../components/ui";

const tabs: { id: RoleStatus; label: string }[] = [
  { id: "pending", label: "Waiting" },
  { id: "approved", label: "Active leaders" },
  { id: "rejected", label: "Declined" },
  { id: "revoked", label: "Revoked" },
];

/**
 * Leader verification.
 * Admins: national + regional (and any campus). Regional leaders: campus leaders in their association.
 */
export function LeadersPage() {
  const { lookup, perms } = usePortal();
  const [rows, setRows] = useState<LeaderRoleWithPerson[] | null>(null);
  const [tab, setTab] = useState<RoleStatus>("pending");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .listLeaderRoles()
      .then(setRows)
      .catch((e) => setError(errorMessage(e)));
  }, []);
  useEffect(() => {
    document.title = "Leader approvals — MSAK";
    load();
  }, [load]);

  if (!perms.canReviewLeaders) return <Navigate to="/app" replace />;

  async function act(id: string, fn: () => Promise<void>) {
    setBusyId(id);
    setError(null);
    try {
      await fn();
      load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  const shown = (rows ?? []).filter((r) => r.status === tab);
  const count = (s: RoleStatus) => (rows ?? []).filter((r) => r.status === s).length;

  return (
    <div>
      <PageHeader eyebrow={perms.isAdmin ? "Administration" : "Leader tools"} title="Leader approvals">
        {perms.isAdmin
          ? "You verify national and regional leaders. Regional leaders verify campus leaders in their association — you can step in for any of them."
          : `You verify campus (institutional) leaders in ${lookup.association(perms.myAssociationId)?.code ?? "your association"}. Confirm the person really holds the position before approving — approved leaders can post to their whole campus immediately.`}
      </PageHeader>

      <div role="tablist" aria-label="Status" className="mb-4 flex flex-wrap gap-1 rounded-md bg-[#f1eee5] p-1 sm:inline-flex">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`rounded px-3.5 py-2 text-sm font-semibold ${tab === t.id ? "bg-white text-navy-900 shadow-sm" : "text-muted"}`}
          >
            {t.label} <span className="ml-1 opacity-70">{count(t.id)}</span>
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4">
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      {rows === null ? (
        <Spinner />
      ) : shown.length === 0 ? (
        <EmptyState title={tab === "pending" ? "No requests waiting" : "Nothing here"} />
      ) : (
        <ul className="card divide-y divide-[#efebe0]">
          {shown.map((r) => (
            <li key={r.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-bold text-navy-900">{r.person?.full_name ?? "Member"}</p>
                <p className="text-sm text-body">
                  <strong>{levelLabel[r.level]}</strong> · {r.position} ·{" "}
                  {r.level === "institutional"
                    ? lookup.institution(r.institution_id)?.name
                    : r.level === "regional"
                      ? lookup.association(r.association_id)?.code
                      : "National"}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[13px] text-muted">
                  <span>Studies at {lookup.placeLabel(r.person?.institution_id)}</span>
                  {r.person?.phone && (
                    <a href={`tel:${r.person.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1">
                      <Phone className="size-3.5" aria-hidden="true" />
                      {r.person.phone}
                    </a>
                  )}
                  <span>
                    {r.status === "pending" ? `requested ${timeAgo(r.requested_at)}` : `${r.status} ${r.reviewed_at ? formatDate(r.reviewed_at) : ""}`}
                  </span>
                </p>
                {r.review_note && <p className="mt-1 text-[13px] italic text-muted">“{r.review_note}”</p>}
              </div>
              <div className="flex flex-none flex-wrap gap-2">
                {r.status === "pending" ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={busyId === r.id}
                      onClick={() => act(r.id, () => api.reviewLeaderRole(r.id, true, prompt("Optional note (how you verified):") ?? undefined))}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      disabled={busyId === r.id}
                      onClick={() => {
                        const note = prompt("Reason for declining (shown to the member):");
                        if (note === null) return;
                        void act(r.id, () => api.reviewLeaderRole(r.id, false, note));
                      }}
                    >
                      Decline
                    </button>
                  </>
                ) : r.status === "approved" ? (
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    disabled={busyId === r.id}
                    onClick={() => {
                      const note = prompt("Reason for revoking this role:");
                      if (note === null) return;
                      void act(r.id, () => api.revokeLeaderRole(r.id, note));
                    }}
                  >
                    Revoke
                  </button>
                ) : (
                  <StatusBadge status={r.status} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
