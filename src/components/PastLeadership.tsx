import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Check, Eye, EyeOff, Pencil, Plus, Trash2, X } from "lucide-react";
import { api, errorMessage } from "../lib/api";
import { useMe } from "../lib/auth";
import { usePortal } from "../lib/portal";
import type { Lookup } from "../lib/directory";
import type { LeaderLevel, PastRole } from "../lib/types";
import { Alert, SelectInput, TextInput } from "./ui";

/** "Chairperson · JKUAT (campus) · 2016–2018" */
export function pastRoleText(r: PastRole, lookup: Lookup): string {
  const where =
    r.level === "national"
      ? "National"
      : r.level === "regional"
        ? `${lookup.association(r.association_id)?.code ?? "Regional"} (regional)`
        : `${lookup.institution(r.institution_id)?.name ?? "Campus"} (campus)`;
  const years = r.from_year === r.to_year ? `${r.from_year}` : `${r.from_year}–${r.to_year}`;
  return `${r.position} · ${where} · ${years}`;
}

function StatusTag({ r }: { r: PastRole }) {
  if (r.status === "confirmed") return <span className="badge bg-[#e6f2ea] text-success">Confirmed</span>;
  if (r.status === "pending") return <span className="badge bg-gold-100 text-gold-800">Waiting for confirmation</span>;
  return <span className="badge bg-[#fbe9e7] text-danger">Not confirmed</span>;
}

/** My profile: the positions I held before, with a form to add more. */
export function PastLeadershipSection() {
  const me = useMe();
  const { lookup } = usePortal();
  const [rows, setRows] = useState<PastRole[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<PastRole | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .listPastRoles()
      .then((all) => setRows(all.filter((r) => r.user_id === me.userId)))
      .catch((e) => setError(errorMessage(e)));
  }, [me.userId]);
  useEffect(load, [load]);

  // arriving from the dashboard prompt (/app/past-leadership#past-leadership): scroll here and open the form
  useEffect(() => {
    if (rows === null || location.hash !== "#past-leadership") return;
    document.getElementById("past-leadership")?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (rows.length === 0) setAdding(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows === null]);

  if (me.profile?.verification === "declined") return null;

  async function remove(r: PastRole) {
    if (!confirm(`Remove “${pastRoleText(r, lookup)}”?`)) return;
    try {
      await api.removePastRole(r.id);
      load();
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  async function togglePublic(r: PastRole) {
    try {
      await api.setPastRolePublic(r.id, !r.show_publicly);
      load();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <section id="past-leadership" aria-labelledby="past-h" className="card flex scroll-mt-24 flex-col gap-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="past-h" className="font-serif text-xl font-semibold text-navy-900">
          Your past positions
        </h2>
        {!adding && (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => {
              setEditing(null);
              setAdding(true);
            }}
          >
            <Plus className="size-4" aria-hidden="true" />
            Add a position
          </button>
        )}
      </div>
      <p className="text-sm text-body">
        Positions you held in MSAK before — on your campus, in your region or nationally. A regional leader (or the national office for national
        positions) confirms each one. This is a record of service; it doesn't give posting rights.
      </p>
      {error && <Alert tone="error">{error}</Alert>}
      {rows && rows.length > 0 && (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.id} className="rounded-md border border-line p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-navy-900">{pastRoleText(r, lookup)}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px]">
                    <StatusTag r={r} />
                    {r.status === "declined" && r.review_note && <span className="text-muted">“{r.review_note}”</span>}
                  </div>
                </div>
                <span className="flex flex-none gap-1">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setAdding(false);
                      setEditing(r);
                    }}
                    aria-label={`Edit ${r.position}`}
                  >
                    <Pencil className="size-4" aria-hidden="true" />
                    Edit
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => void remove(r)} aria-label={`Remove ${r.position}`}>
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </span>
              </div>
              {editing?.id === r.id && (
                <div className="mt-3">
                  <AddPastRoleForm
                    lookup={lookup}
                    initial={r}
                    defaultAssociation={r.association_id}
                    defaultInstitution={r.institution_id}
                    onCancel={() => setEditing(null)}
                    onDone={() => {
                      setEditing(null);
                      load();
                    }}
                  />
                </div>
              )}
              {r.hidden_by_admin && r.level !== "institutional" && editing?.id !== r.id && (
                <p className="mt-2 text-[13px] text-muted">Hidden from the public Past leaders page by MSAK. Contact MSAK through Help & feedback if this is a mistake.</p>
              )}
              {r.level !== "institutional" && r.status !== "declined" && !r.hidden_by_admin && editing?.id !== r.id && (
                <label className="mt-2 flex items-start gap-2 text-[13px] text-body">
                  <input type="checkbox" className="mt-0.5 size-4 accent-[#0B1F4D]" checked={r.show_publicly} onChange={() => void togglePublic(r)} />
                  <span>Show my name for this position on the public Past leaders page{r.status === "pending" ? " (once confirmed)" : ""}.</span>
                </label>
              )}
            </li>
          ))}
        </ul>
      )}
      {rows && rows.length === 0 && !adding && <p className="text-sm text-muted">No past positions added.</p>}
      {adding && (
        <AddPastRoleForm
          lookup={lookup}
          defaultAssociation={lookup.associationOfInstitution(me.profile?.institution_id)?.id ?? null}
          defaultInstitution={me.profile?.institution_id ?? null}
          onCancel={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            load();
          }}
        />
      )}
    </section>
  );
}

function AddPastRoleForm({
  lookup,
  initial,
  defaultAssociation,
  defaultInstitution,
  onCancel,
  onDone,
}: {
  lookup: Lookup;
  /** Editing an existing entry. */
  initial?: PastRole;
  defaultAssociation: number | null;
  defaultInstitution: number | null;
  onCancel: () => void;
  onDone: () => void;
}) {
  const thisYear = new Date().getFullYear();
  const [level, setLevel] = useState<LeaderLevel>(initial?.level ?? "institutional");
  const [assoc, setAssoc] = useState<number | null>(defaultAssociation);
  const [inst, setInst] = useState<number | null>(defaultInstitution);
  const [position, setPosition] = useState(initial?.position ?? "");
  const [from, setFrom] = useState(String(initial?.from_year ?? thisYear - 2));
  const [to, setTo] = useState(String(initial?.to_year ?? thisYear - 1));
  const [show, setShow] = useState(initial?.show_publicly ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const institutions = useMemo(() => lookup.institutionsInAssociation(assoc), [lookup, assoc]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const input = {
        level,
        association_id: level === "national" ? null : assoc,
        institution_id: level === "institutional" ? inst : null,
        position,
        from_year: Number(from),
        to_year: Number(to),
        show_publicly: level !== "institutional" && show,
      };
      if (initial) await api.updatePastRole(initial.id, input);
      else await api.addPastRole(input);
      onDone();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="grid gap-4 rounded-md border border-line bg-paper p-4 sm:grid-cols-2">
      <SelectInput label="Level" value={level} onChange={(e) => setLevel(e.target.value as LeaderLevel)}>
        <option value="institutional">Campus</option>
        <option value="regional">Regional (association)</option>
        <option value="national">National</option>
      </SelectInput>
      <TextInput label="Position" value={position} onChange={(e) => setPosition(e.target.value)} placeholder="e.g. Chairperson, Secretary" maxLength={100} required />
      {level !== "national" && (
        <SelectInput
          label="Association"
          value={assoc ?? ""}
          onChange={(e) => {
            setAssoc(Number(e.target.value) || null);
            setInst(null);
          }}
        >
          <option value="">Choose</option>
          {lookup.associations.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code} — {a.name}
            </option>
          ))}
        </SelectInput>
      )}
      {level === "institutional" && (
        <SelectInput label="Campus" value={inst ?? ""} onChange={(e) => setInst(Number(e.target.value) || null)} disabled={!assoc}>
          <option value="">Choose</option>
          {institutions.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </SelectInput>
      )}
      <div className="grid grid-cols-2 gap-3 sm:col-span-2 sm:max-w-sm">
        <TextInput label="From (year)" type="number" inputMode="numeric" min={1990} max={thisYear} value={from} onChange={(e) => setFrom(e.target.value)} />
        <TextInput label="To (year)" type="number" inputMode="numeric" min={1990} max={thisYear} value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      {level !== "institutional" && (
        <label className="flex items-start gap-2 text-sm text-body sm:col-span-2">
          <input type="checkbox" className="mt-0.5 size-4 accent-[#0B1F4D]" checked={show} onChange={(e) => setShow(e.target.checked)} />
          <span>Once confirmed, show my name and this position on the public Past leaders page.</span>
        </label>
      )}
      {initial && initial.status !== "pending" && (
        <p className="text-[13px] text-muted sm:col-span-2">Saving sends this back for confirmation.</p>
      )}
      {error && (
        <div className="sm:col-span-2">
          <Alert tone="error">{error}</Alert>
        </div>
      )}
      <div className="flex justify-end gap-2 sm:col-span-2">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Sending…" : initial ? "Save changes" : "Send for confirmation"}
        </button>
      </div>
    </form>
  );
}

/** Leader approvals → "Past leaders (alumni)": every past position this reviewer can see, by status. */
export function PastLeadersBoard({
  rows,
  names,
  onChanged,
  adminEditor,
}: {
  rows: PastRole[];
  names: Map<string, string>;
  onChanged: () => void;
  /** Administrators: the edit form for an entry (any status). */
  adminEditor?: (r: PastRole, done: () => void, cancel: () => void) => ReactNode;
}) {
  const { lookup } = usePortal();
  const [editingId, setEditingId] = useState<string | null>(null);
  async function remove(r: PastRole) {
    if (!confirm(`Delete “${pastRoleText(r, lookup)}” for ${names.get(r.user_id) ?? "this member"}?`)) return;
    try {
      await api.removePastRole(r.id);
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  async function toggleHidden(r: PastRole) {
    try {
      await api.adminHidePastRole(r.id, !r.hidden_by_admin);
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  const adminActions = (r: PastRole) =>
    adminEditor && (
      <span className="flex flex-none flex-wrap gap-1">
        {r.status === "confirmed" && r.level !== "institutional" && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void toggleHidden(r)}>
            {r.hidden_by_admin ? <Eye className="size-4" aria-hidden="true" /> : <EyeOff className="size-4" aria-hidden="true" />}
            {r.hidden_by_admin ? "Show on public page" : "Hide from public"}
          </button>
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingId(r.id)} aria-label={`Edit ${r.position}`}>
          <Pencil className="size-4" aria-hidden="true" />
          Edit
        </button>
        <button type="button" className="btn btn-ghost btn-sm text-danger" onClick={() => void remove(r)} aria-label={`Delete ${r.position}`}>
          <Trash2 className="size-4" aria-hidden="true" />
        </button>
      </span>
    );
  const [tab, setTab] = useState<PastRole["status"]>("pending");
  const [error, setError] = useState<string | null>(null);
  const tabs: [PastRole["status"], string][] = [
    ["pending", "Waiting"],
    ["confirmed", "Confirmed"],
    ["declined", "Not confirmed"],
  ];
  const shown = rows.filter((r) => r.status === tab);
  return (
    <section aria-label="Past leaders">
      <p className="mb-3 max-w-3xl text-sm text-body">
        Positions members held before, mostly alumni. Confirm only what you know (or have checked with past officials) to be true. Confirmed
        national and regional positions appear on the public Past leaders page if the member agreed.
      </p>
      <div role="tablist" aria-label="Status" className="mb-4 flex flex-wrap gap-1 rounded-md bg-[#f1eee5] p-1 sm:inline-flex">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`rounded px-3.5 py-2 text-sm font-semibold ${tab === id ? "bg-white text-navy-900 shadow-sm" : "text-muted"}`}
          >
            {label} <span className="ml-1 opacity-70">{rows.filter((r) => r.status === id).length}</span>
          </button>
        ))}
      </div>
      {error && (
        <div className="mb-4">
          <Alert tone="error">{error}</Alert>
        </div>
      )}
      {shown.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line-strong bg-white px-5 py-10 text-center text-body">
          {tab === "pending" ? "No past leadership waiting." : "Nothing here."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((r) =>
            adminEditor && editingId === r.id ? (
              <li key={r.id} className="rounded-md border border-line bg-white p-3">
                <p className="mb-2 font-semibold text-navy-900">{names.get(r.user_id) ?? "A member"}</p>
                {adminEditor(
                  r,
                  () => {
                    setEditingId(null);
                    onChanged();
                  },
                  () => setEditingId(null),
                )}
              </li>
            ) : r.status === "pending" ? (
              <PastReviewItem
                key={r.id}
                r={r}
                name={names.get(r.user_id) ?? "A member"}
                text={pastRoleText(r, lookup)}
                onDone={onChanged}
                onError={setError}
                extra={adminActions(r)}
              />
            ) : (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-line bg-white p-3">
                <div className="min-w-0">
                  <p className="font-semibold text-navy-900">{names.get(r.user_id) ?? "A member"}</p>
                  <p className="text-[13px] text-body">{pastRoleText(r, lookup)}</p>
                  <p className="text-[12px] text-muted">
                    {r.status === "confirmed"
                      ? r.level === "institutional"
                        ? "Campus positions aren't shown publicly"
                        : r.hidden_by_admin
                          ? "Hidden from the public page by an administrator"
                          : r.show_publicly
                            ? "On the public Past leaders page"
                            : "Not shown publicly (member's choice)"
                      : r.review_note
                        ? `“${r.review_note}”`
                        : ""}
                  </p>
                </div>
                {adminActions(r)}
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  );
}

function PastReviewItem({
  r,
  name,
  text,
  onDone,
  onError,
  extra,
}: {
  r: PastRole;
  name: string;
  text: string;
  onDone: () => void;
  onError: (m: string) => void;
  extra?: ReactNode;
}) {
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  async function run(ok: boolean) {
    setBusy(true);
    try {
      await api.reviewPastRole(r.id, ok, ok ? undefined : note);
      onDone();
    } catch (e) {
      onError(errorMessage(e));
      setBusy(false);
    }
  }
  return (
    <li className="rounded-md border border-line bg-white p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-semibold text-navy-900">{name}</p>
          <p className="text-[13px] text-body">{text}</p>
        </div>
        {!declining && (
          <div className="flex flex-none gap-2">
            <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void run(true)}>
              <Check className="size-4" aria-hidden="true" />
              Confirm
            </button>
            <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => setDeclining(true)}>
              <X className="size-4" aria-hidden="true" />
              Not correct
            </button>
            {extra}
          </div>
        )}
      </div>
      {declining && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <label htmlFor={`pr-${r.id}`} className="sr-only">
            Reason
          </label>
          <input
            id={`pr-${r.id}`}
            className="input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            placeholder="Why? e.g. The chair in 2018 was someone else"
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
