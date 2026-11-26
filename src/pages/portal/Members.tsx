import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Avatar } from "../../components/Avatar";
import { Navigate } from "react-router";
import { Check, Download, Mail, Pencil, Search, ShieldCheck, Trash2, UserCheck, X } from "lucide-react";
import { api, errorMessage } from "../../lib/api";
import { useMe } from "../../lib/auth";
import { usePortal } from "../../lib/portal";
import { downloadCsv, formatDate, levelLabel, timeAgo } from "../../lib/format";
import type { MemberRow } from "../../lib/types";
import { Alert, EmptyState, Modal, PageHeader, Spinner, TextInput } from "../../components/ui";
import { checkEmail } from "../../lib/emailCheck";
import { pastRoleText } from "../../components/PastLeadership";
import { ManageMember } from "../../components/ManageMember";
import { isAlumni, isRoleActive, roleState } from "../../lib/academic";

/** Members a leader can see: campus leaders → their campus; regional → association; national/admin → everyone. */
export function MembersPage() {
  const me = useMe();
  const { lookup, perms } = usePortal();
  const [rows, setRows] = useState<MemberRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [assoc, setAssoc] = useState<number | "all">("all");
  const [status, setStatus] = useState<"all" | "students" | "alumni" | "waiting" | "declined">("all");

  const load = useCallback(() => {
    api
      .listMembers({ emails: perms.isAdmin })
      .then(setRows)
      .catch((e) => setError(errorMessage(e)));
  }, [perms.isAdmin]);
  useEffect(() => {
    document.title = "Members — MSAK";
    load();
  }, [load]);

  const year = new Date().getFullYear();
  const matches = (m: MemberRow, term: string) =>
    !term || `${m.full_name} ${m.email ?? ""} ${m.phone} ${m.course} ${lookup.placeLabel(m.institution_id)}`.toLowerCase().includes(term);
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (rows ?? []).filter((m) => {
      const a = lookup.associationOfInstitution(m.institution_id);
      if (assoc !== "all" && a?.id !== assoc) return false;
      // people a leader found not to be students only show under "Declined"
      if (status === "declined") return m.verification === "declined" && matches(m, term);
      if (m.verification === "declined") return false;
      if (status === "waiting" && m.verification !== "pending") return false;
      if (status === "alumni" && !isAlumni(m)) return false;
      if (status === "students" && isAlumni(m)) return false;
      return matches(m, term);
    });
  }, [rows, q, assoc, status, lookup, year]);

  /** Campus leaders of that institution, regional leaders of its association, and admins. */
  const canVerify = (institutionId: number) => {
    if (perms.isAdmin) return true;
    const assocId = lookup.associationOfInstitution(institutionId)?.id;
    return me.roles.some(
      (r) => isRoleActive(r) && ((r.level === "regional" && r.association_id === assocId) || (r.level === "institutional" && r.institution_id === institutionId)),
    );
  };
  const waiting = (rows ?? []).filter((m) => m.verification === "pending" && m.id !== me.userId && canVerify(m.institution_id));
  const anyVerifier = status === "declined" && (rows ?? []).some((m) => m.verification === "declined" && canVerify(m.institution_id));

  const [emailFor, setEmailFor] = useState<MemberRow | null>(null);
  const [managing, setManaging] = useState<MemberRow | null>(null);

  async function removeAccount(m: MemberRow) {
    if (!confirm(`Remove ${m.full_name}'s account completely? Their login and profile are deleted. This can't be undone.`)) return;
    setError(null);
    try {
      await api.removeDeclinedAccount(m.id);
      load();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function review(m: MemberRow, approve: boolean, note?: string) {
    setError(null);
    try {
      await api.reviewMember(m.id, approve, note);
      load();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  if (!perms.canSeeMembers) return <Navigate to="/app" replace />;

  function exportCsv() {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`MSAK_Members_${stamp}.csv`, [
      ["Name", ...(perms.isAdmin ? ["Email"] : []), "Phone", "Gender", "Institution", "County", "Association", "Course", "Year of study", "Completion year", "Leadership"],
      ...shown.filter((m) => m.verification !== "declined").map((m) => [
        m.full_name,
        ...(perms.isAdmin ? [m.email ?? ""] : []),
        m.phone,
        m.gender,
        lookup.institution(m.institution_id)?.name,
        lookup.countyOfInstitution(m.institution_id)?.name,
        lookup.associationOfInstitution(m.institution_id)?.code,
        m.course,
        m.year_of_study,
        m.expected_completion_year,
        m.roles.filter(isRoleActive).map((r) => `${levelLabel[r.level]} ${r.position}`).join("; "),
      ]),
    ]);
  }

  return (
    <div>
      <PageHeader
        eyebrow={perms.isAdmin ? "Administration" : "Leader tools"}
        title="Members"
        actions={
          <button type="button" className="btn btn-outline" onClick={exportCsv} disabled={!shown.some((m) => m.verification !== "declined")}>
            <Download className="size-[18px]" aria-hidden="true" />
            Export CSV
          </button>
        }
      >
        Contact details are for MSAK fellowship work only — see the Privacy Policy.
      </PageHeader>

      {perms.isAdmin && rows && rows.length > 0 && rows.every((m) => m.email === undefined) && (
        <div className="mb-4">
          <Alert tone="warn">
            Members' emails couldn't be loaded. Run <code>11_admin_member_emails.sql</code> in the Supabase SQL Editor, then{" "}
            <code>notify pgrst, 'reload schema';</code> and reload this page.
          </Alert>
        </div>
      )}

      {waiting.length > 0 && (
        <section aria-labelledby="waiting-h" className="mb-6 rounded-lg border border-gold-500 bg-gold-50 p-4 sm:p-5">
          <h2 id="waiting-h" className="flex items-center gap-2 font-semibold text-navy-900">
            <UserCheck className="size-5 text-gold-700" aria-hidden="true" />
            Waiting for confirmation ({waiting.length})
          </h2>
          <p className="mt-1 text-sm text-body">
            New members see national announcements only until you confirm they really study at their campus. Not sure? Call them first.
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {waiting.map((m) => (
              <PendingMember key={m.id} m={m} place={lookup.placeLabel(m.institution_id)} onReview={(ok, note) => review(m, ok, note)} />
            ))}
          </ul>
        </section>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3.5 top-3.5 size-[18px] text-muted" aria-hidden="true" />
          <label htmlFor="member-search" className="sr-only">
            Search members
          </label>
          <input id="member-search" type="search" className="input pl-10" placeholder="Name, phone, campus, course" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {(perms.isAdmin || me.roles.some((r) => isRoleActive(r) && r.level === "national")) && (
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
          <option value="waiting">Waiting for confirmation</option>
          <option value="declined">Declined</option>
        </select>
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      {rows === null ? (
        <Spinner />
      ) : shown.length === 0 ? (
        <EmptyState title={status === "declined" ? "No declined members" : "No members match"} />
      ) : (
        <>
          <p className="mb-2 text-sm text-muted">
            {status === "declined"
              ? `${shown.length} declined — not counted as members, not in exports, and removed automatically 30 days after the decision.`
              : `${shown.length} members`}
          </p>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-line bg-paper text-[12px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Campus</th>
                  <th className="px-4 py-3 font-semibold">Phone</th>
                  <th className="px-4 py-3 font-semibold">Year</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  {(perms.isAdmin || anyVerifier) && <th className="px-4 py-3 font-semibold"><span className="sr-only">Actions</span></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#efebe0]">
                {shown.map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-3 font-semibold text-navy-900">
                      <span className="flex items-start gap-3">
                        <Avatar name={m.full_name} path={m.photo_path} size={36} />
                        <span className="min-w-0">
                          {m.full_name}
                          {m.isAdmin && <ShieldCheck className="ml-1 inline size-4 text-gold-700" aria-label="Administrator" />}
                          {m.email && <span className="block break-all text-[12px] font-normal text-muted">{m.email}</span>}
                          {m.pastRoles && m.pastRoles.length > 0 && (
                            <span className="mt-0.5 block text-[12px] font-normal text-body">
                              Served: {m.pastRoles.map((r) => pastRoleText(r, lookup)).join("; ")}
                            </span>
                          )}
                        </span>
                      </span>
                      {m.verification === "pending" && <span className="badge ml-2 bg-gold-100 text-gold-800">Waiting</span>}
                      {m.verification === "declined" && (
                        <span className="mt-0.5 block text-[12px] font-normal text-muted">
                          Declined{m.verification_note ? ` — “${m.verification_note}”` : ""}
                          {m.verified_at && ` · removed ${formatDate(new Date(Date.parse(m.verified_at) + 30 * 86_400_000).toISOString())}`}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-body">{lookup.placeLabel(m.institution_id)}</td>
                    <td className="px-4 py-3">
                      <a href={`tel:${m.phone.replace(/\s/g, "")}`}>{m.phone}</a>
                    </td>
                    <td className="px-4 py-3 text-body">
                      {isAlumni(m) ? `Alumni · ${m.expected_completion_year}` : `Y${m.year_of_study} · ${m.expected_completion_year}`}
                    </td>
                    <td className="px-4 py-3 text-body">
                      {m.roles.length === 0
                        ? "Member"
                        : m.roles
                            .map((r) => {
                              const st = roleState(r);
                              return `${levelLabel[r.level]}${st === "active" ? "" : ` (${st})`}`;
                            })
                            .join(", ")}
                    </td>
                    {(perms.isAdmin || anyVerifier) && (
                      <td className="px-4 py-3 text-right">
                        {m.verification === "declined" && m.id !== me.userId && canVerify(m.institution_id) && (
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void review(m, true)}>
                            Confirm
                          </button>
                        )}
                        {perms.isAdmin && m.verification === "declined" && !m.isAdmin && (
                          <button type="button" className="btn btn-ghost btn-sm text-danger" onClick={() => void removeAccount(m)}>
                            <Trash2 className="size-4" aria-hidden="true" />
                            Remove account
                          </button>
                        )}
                        {perms.isAdmin && m.id !== me.userId && (
                          <button type="button" className="btn btn-outline btn-sm" onClick={() => setManaging(m)}>
                            <Pencil className="size-4" aria-hidden="true" />
                            Manage
                          </button>
                        )}
                        {perms.isAdmin && m.email !== undefined && (
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEmailFor(m)}>
                            <Mail className="size-4" aria-hidden="true" />
                            Change email
                          </button>
                        )}
                        {perms.isAdmin && m.id !== me.userId && m.verification !== "declined" && (
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
      <Modal open={!!managing} wide title={managing ? `Manage — ${managing.full_name}` : "Manage member"} onClose={() => setManaging(null)}>
        {managing && (
          <ManageMember
            member={managing}
            lookup={lookup}
            onChanged={load}
            onDeleted={() => {
              setManaging(null);
              load();
            }}
          />
        )}
      </Modal>
      <Modal open={!!emailFor} title={emailFor ? `Login email — ${emailFor.full_name}` : "Login email"} onClose={() => setEmailFor(null)}>
        {emailFor && (
          <ChangeEmailForm
            member={emailFor}
            onDone={() => {
              setEmailFor(null);
              load();
            }}
          />
        )}
      </Modal>
    </div>
  );
}

/** One new member waiting: Confirm, or decline with a short reason. */
function PendingMember({ m, place, onReview }: { m: MemberRow; place: string; onReview: (ok: boolean, note?: string) => Promise<void> }) {
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (ok: boolean) => {
    setBusy(true);
    await onReview(ok, ok ? undefined : note);
    setBusy(false);
  };
  return (
    <li className="rounded-md border border-line bg-white p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-semibold text-navy-900">
            <Avatar name={m.full_name} path={m.photo_path} size={32} />
            {m.full_name}
          </p>
          <p className="text-[13px] text-body">
            {place} · {m.course} · Year {m.year_of_study}
          </p>
          <p className="text-[13px] text-muted">
            <a href={`tel:${m.phone.replace(/\s/g, "")}`}>{m.phone}</a> · joined {timeAgo(m.created_at)}
          </p>
        </div>
        {!declining && (
          <div className="flex flex-none gap-2">
            <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void run(true)}>
              <Check className="size-4" aria-hidden="true" />
              Confirm
            </button>
            <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => setDeclining(true)}>
              <X className="size-4" aria-hidden="true" />
              Not a student
            </button>
          </div>
        )}
      </div>
      {declining && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <label htmlFor={`why-${m.id}`} className="sr-only">
            Reason
          </label>
          <input
            id={`why-${m.id}`}
            className="input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            placeholder="Why? e.g. Not a student at this campus"
            autoFocus
          />
          <div className="flex flex-none gap-2">
            <button type="button" className="btn btn-danger btn-sm" disabled={busy || note.trim().length < 3} onClick={() => void run(false)}>
              Decline
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDeclining(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

/** Admin corrects a member's login email; they keep their password. */
function ChangeEmailForm({ member, onDone }: { member: MemberRow; onDone: () => void }) {
  const [email, setEmail] = useState(member.email ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const check = checkEmail(email);
  const unchanged = email.trim().toLowerCase() === (member.email ?? "").toLowerCase();
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!check.ok) return setError(check.error);
    setBusy(true);
    setError(null);
    try {
      await api.adminChangeEmail(member.id, email);
      onDone();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <p className="text-sm text-body">
        Use this when a member typed their email wrong. They'll log in with the new address and their usual password, and
        password-reset emails will go there. Check the new address with them first (e.g. by phone: {member.phone}).
      </p>
      <TextInput
        label="Login email"
        type="email"
        inputMode="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoCapitalize="none"
        spellCheck={false}
        error={!check.ok && email.includes("@") ? check.error : undefined}
        hint={member.email ? `Currently: ${member.email}` : undefined}
      />
      {check.ok && check.suggestion && (
        <p className="rounded-md bg-gold-50 px-3 py-2 text-sm text-navy-900">
          Did you mean <strong className="break-all">{check.suggestion}</strong>?{" "}
          <button type="button" className="font-semibold underline" onClick={() => setEmail(check.suggestion!)}>
            Use it
          </button>
        </p>
      )}
      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex justify-end gap-2">
        <button type="submit" className="btn btn-primary" disabled={busy || unchanged || !check.ok}>
          {busy ? "Saving…" : "Save email"}
        </button>
      </div>
    </form>
  );
}
