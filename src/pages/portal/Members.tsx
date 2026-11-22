import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router";
import { Download, Search, ShieldCheck } from "lucide-react";
import { api, errorMessage } from "../../lib/api";
import { useMe } from "../../lib/auth";
import { usePortal } from "../../lib/portal";
import { downloadCsv, levelLabel } from "../../lib/format";
import type { MemberRow } from "../../lib/types";
import { Alert, EmptyState, PageHeader, Spinner } from "../../components/ui";

/** Members a leader can see: campus leaders → their campus; regional → association; national/admin → everyone. */
export function MembersPage() {
  const me = useMe();
  const { lookup, perms } = usePortal();
  const [rows, setRows] = useState<MemberRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [assoc, setAssoc] = useState<number | "all">("all");
  const [status, setStatus] = useState<"all" | "students" | "alumni">("all");

  const load = useCallback(() => {
    api
      .listMembers()
      .then(setRows)
      .catch((e) => setError(errorMessage(e)));
  }, []);
  useEffect(() => {
    document.title = "Members — MSAK";
    load();
  }, [load]);

  const year = new Date().getFullYear();
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (rows ?? []).filter((m) => {
      const a = lookup.associationOfInstitution(m.institution_id);
      if (assoc !== "all" && a?.id !== assoc) return false;
      if (status === "alumni" && m.expected_completion_year >= year) return false;
      if (status === "students" && m.expected_completion_year < year) return false;
      if (!term) return true;
      return `${m.full_name} ${m.phone} ${m.course} ${lookup.placeLabel(m.institution_id)}`.toLowerCase().includes(term);
    });
  }, [rows, q, assoc, status, lookup, year]);

  if (!perms.canSeeMembers) return <Navigate to="/app" replace />;

  function exportCsv() {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`MSAK_Members_${stamp}.csv`, [
      ["Name", "Phone", "Gender", "Institution", "County", "Association", "Course", "Year of study", "Completion year", "Leadership"],
      ...shown.map((m) => [
        m.full_name,
        m.phone,
        m.gender,
        lookup.institution(m.institution_id)?.name,
        lookup.countyOfInstitution(m.institution_id)?.name,
        lookup.associationOfInstitution(m.institution_id)?.code,
        m.course,
        m.year_of_study,
        m.expected_completion_year,
        m.roles.filter((r) => r.status === "approved").map((r) => `${levelLabel[r.level]} ${r.position}`).join("; "),
      ]),
    ]);
  }

  return (
    <div>
      <PageHeader
        eyebrow={perms.isAdmin ? "Administration" : "Leader tools"}
        title="Members"
        actions={
          <button type="button" className="btn btn-outline" onClick={exportCsv} disabled={!shown.length}>
            <Download className="size-[18px]" aria-hidden="true" />
            Export CSV
          </button>
        }
      >
        Contact details are for MSAK fellowship work only — see the Privacy Policy.
      </PageHeader>

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3.5 top-3.5 size-[18px] text-muted" aria-hidden="true" />
          <label htmlFor="member-search" className="sr-only">
            Search members
          </label>
          <input id="member-search" type="search" className="input pl-10" placeholder="Name, phone, campus, course" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {(perms.isAdmin || me.roles.some((r) => r.status === "approved" && r.level === "national")) && (
          <>
            <label htmlFor="member-assoc" className="sr-only">
              Association
            </label>
            <select id="member-assoc" className="input w-auto" value={assoc} onChange={(e) => setAssoc(e.target.value === "all" ? "all" : Number(e.target.value))}>
              <option value="all">All associations</option>
              {lookup.associations.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code}
                </option>
              ))}
            </select>
          </>
        )}
        <label htmlFor="member-status" className="sr-only">
          Students or alumni
        </label>
        <select id="member-status" className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="all">Students & alumni</option>
          <option value="students">Current students</option>
          <option value="alumni">Alumni</option>
        </select>
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      {rows === null ? (
        <Spinner />
      ) : shown.length === 0 ? (
        <EmptyState title="No members match" />
      ) : (
        <>
          <p className="mb-2 text-sm text-muted">{shown.length} members</p>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-line bg-paper text-[12px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Campus</th>
                  <th className="px-4 py-3 font-semibold">Phone</th>
                  <th className="px-4 py-3 font-semibold">Year</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  {perms.isAdmin && <th className="px-4 py-3 font-semibold"><span className="sr-only">Actions</span></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#efebe0]">
                {shown.map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-3 font-semibold text-navy-900">
                      {m.full_name}
                      {m.isAdmin && <ShieldCheck className="ml-1 inline size-4 text-gold-700" aria-label="Administrator" />}
                    </td>
                    <td className="px-4 py-3 text-body">{lookup.placeLabel(m.institution_id)}</td>
                    <td className="px-4 py-3">
                      <a href={`tel:${m.phone.replace(/\s/g, "")}`}>{m.phone}</a>
                    </td>
                    <td className="px-4 py-3 text-body">
                      {m.expected_completion_year < year ? "Alumni" : `Y${m.year_of_study} · ${m.expected_completion_year}`}
                    </td>
                    <td className="px-4 py-3 text-body">
                      {m.roles.length === 0
                        ? "Member"
                        : m.roles.map((r) => `${levelLabel[r.level]}${r.status === "pending" ? " (pending)" : ""}`).join(", ")}
                    </td>
                    {perms.isAdmin && (
                      <td className="px-4 py-3 text-right">
                        {m.id !== me.userId && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={async () => {
                              if (!confirm(m.isAdmin ? `Remove ${m.full_name} as administrator?` : `Make ${m.full_name} an administrator? They will be able to see and manage everything.`)) return;
                              try {
                                await api.setAdmin(m.id, !m.isAdmin);
                                load();
                              } catch (e) {
                                alert(errorMessage(e));
                              }
                            }}
                          >
                            {m.isAdmin ? "Remove admin" : "Make admin"}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
