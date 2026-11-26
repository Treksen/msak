import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api, errorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { Lookup } from "../lib/directory";
import { formatDay, roleState } from "../lib/academic";
import { levelLabel } from "../lib/format";
import type { AdminRoleInput, Gender, LeaderLevel, LeaderRole, MemberRow, PastRole, Verification } from "../lib/types";
import { pastRoleText } from "./PastLeadership";
import { Alert, SelectInput, StatusBadge, TextInput } from "./ui";

/**
 * Administrators: everything about one member in one place — profile, confirmation status,
 * current leader roles, past leadership, and deleting the account.
 */
export function ManageMember({ member, lookup, onChanged, onDeleted }: { member: MemberRow; lookup: Lookup; onChanged: () => void; onDeleted: () => void }) {
  const [tab, setTab] = useState<"profile" | "roles" | "past" | "account">("profile");
  const tabs: [typeof tab, string][] = [
    ["profile", "Profile"],
    ["roles", "Leader roles"],
    ["past", "Past leadership"],
    ["account", "Account"],
  ];
  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Manage" className="flex flex-wrap gap-1 rounded-md bg-[#f1eee5] p-1">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`rounded px-3 py-2 text-sm font-semibold ${tab === id ? "bg-white text-navy-900 shadow-sm" : "text-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "profile" && <ProfileForm member={member} lookup={lookup} onSaved={onChanged} />}
      {tab === "roles" && <RolesPanel member={member} lookup={lookup} onChanged={onChanged} />}
      {tab === "past" && <PastPanel member={member} lookup={lookup} onChanged={onChanged} />}
      {tab === "account" && <AccountPanel member={member} onDeleted={onDeleted} />}
    </div>
  );
}

// ---------------------------------------------------------------- Profile
function ProfileForm({ member, lookup, onSaved }: { member: MemberRow; lookup: Lookup; onSaved: () => void }) {
  const [f, setF] = useState({
    full_name: member.full_name,
    gender: member.gender as Gender,
    phone: member.phone,
    association_id: lookup.associationOfInstitution(member.institution_id)?.id ?? null,
    institution_id: member.institution_id,
    course: member.course,
    admission_year: String(member.admission_year),
    year_of_study: String(member.year_of_study),
    expected_completion_year: String(member.expected_completion_year),
    verification: member.verification as Verification,
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const institutions = useMemo(() => lookup.institutionsInAssociation(f.association_id), [lookup, f.association_id]);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api.adminUpdateProfile(member.id, {
        full_name: f.full_name,
        gender: f.gender,
        phone: f.phone,
        institution_id: f.institution_id,
        course: f.course,
        admission_year: Number(f.admission_year),
        year_of_study: Number(f.year_of_study),
        expected_completion_year: Number(f.expected_completion_year),
        verification: f.verification,
      });
      setMsg({ tone: "success", text: "Saved." });
      onSaved();
    } catch (err) {
      setMsg({ tone: "error", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <TextInput label="Full name" value={f.full_name} onChange={(e) => set("full_name", e.target.value)} />
      </div>
      <TextInput label="Phone" value={f.phone} onChange={(e) => set("phone", e.target.value)} />
      <SelectInput label="Gender" value={f.gender} onChange={(e) => set("gender", e.target.value as Gender)}>
        <option value="Female">Female</option>
        <option value="Male">Male</option>
      </SelectInput>
      <SelectInput
        label="Association"
        value={f.association_id ?? ""}
        onChange={(e) => {
          set("association_id", Number(e.target.value) || null);
          set("institution_id", 0);
        }}
      >
        <option value="">Choose</option>
        {lookup.associations.map((a) => (
          <option key={a.id} value={a.id}>
            {a.code}
          </option>
        ))}
      </SelectInput>
      <SelectInput label="Institution" value={f.institution_id || ""} onChange={(e) => set("institution_id", Number(e.target.value))}>
        <option value="">Choose</option>
        {institutions.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name}
          </option>
        ))}
      </SelectInput>
      <div className="sm:col-span-2">
        <TextInput label="Course" value={f.course} onChange={(e) => set("course", e.target.value)} />
      </div>
      <TextInput label="Year of admission" type="number" value={f.admission_year} onChange={(e) => set("admission_year", e.target.value)} />
      <TextInput label="Year of study" type="number" value={f.year_of_study} onChange={(e) => set("year_of_study", e.target.value)} />
      <TextInput
        label="Completion year"
        type="number"
        value={f.expected_completion_year}
        onChange={(e) => set("expected_completion_year", e.target.value)}
        hint="A past year makes them alumni."
      />
      <SelectInput label="Membership" value={f.verification} onChange={(e) => set("verification", e.target.value as Verification)}>
        <option value="verified">Confirmed student</option>
        <option value="pending">Waiting for confirmation</option>
        <option value="declined">Declined (not a student)</option>
      </SelectInput>
      {msg && (
        <div className="sm:col-span-2">
          <Alert tone={msg.tone}>{msg.text}</Alert>
        </div>
      )}
      <div className="flex justify-end sm:col-span-2">
        <button type="submit" className="btn btn-primary" disabled={busy || !f.institution_id}>
          {busy ? "Saving…" : "Save profile"}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- Shared: level + place pickers
function ScopeFields({
  lookup,
  level,
  assoc,
  inst,
  onLevel,
  onAssoc,
  onInst,
}: {
  lookup: Lookup;
  level: LeaderLevel;
  assoc: number | null;
  inst: number | null;
  onLevel: (l: LeaderLevel) => void;
  onAssoc: (a: number | null) => void;
  onInst: (i: number | null) => void;
}) {
  const institutions = useMemo(() => lookup.institutionsInAssociation(assoc), [lookup, assoc]);
  return (
    <>
      <SelectInput label="Level" value={level} onChange={(e) => onLevel(e.target.value as LeaderLevel)}>
        <option value="institutional">Campus</option>
        <option value="regional">Regional</option>
        <option value="national">National</option>
      </SelectInput>
      {level !== "national" && (
        <SelectInput
          label="Association"
          value={assoc ?? ""}
          onChange={(e) => {
            onAssoc(Number(e.target.value) || null);
            onInst(null);
          }}
        >
          <option value="">Choose</option>
          {lookup.associations.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code}
            </option>
          ))}
        </SelectInput>
      )}
      {level === "institutional" && (
        <SelectInput label="Campus" value={inst ?? ""} onChange={(e) => onInst(Number(e.target.value) || null)} disabled={!assoc}>
          <option value="">Choose</option>
          {institutions.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </SelectInput>
      )}
    </>
  );
}

// ---------------------------------------------------------------- Current leader roles
function RolesPanel({ member, lookup, onChanged }: { member: MemberRow; lookup: Lookup; onChanged: () => void }) {
  const { refresh } = useAuth();
  const [roles, setRoles] = useState<LeaderRole[] | null>(null);
  const [editing, setEditing] = useState<LeaderRole | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    api
      .listLeaderRoles()
      .then((all) => setRoles(all.filter((r) => r.user_id === member.id)))
      .catch((e) => setError(errorMessage(e)));
  }, [member.id]);
  useEffect(load, [load]);

  const done = () => {
    setEditing(null);
    load();
    onChanged();
    void refresh();
  };
  async function remove(r: LeaderRole) {
    if (!confirm(`Delete the record “${levelLabel[r.level]} · ${r.position}” completely? (To end a role but keep the record, set its status to Revoked instead.)`)) return;
    try {
      await api.adminDeleteRole(r.id);
      done();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const place = (r: LeaderRole) =>
    r.level === "national" ? "All of MSAK" : r.level === "regional" ? lookup.association(r.association_id)?.code : lookup.institution(r.institution_id)?.name;

  return (
    <div className="flex flex-col gap-3">
      {error && <Alert tone="error">{error}</Alert>}
      {roles?.length === 0 && editing !== "new" && <p className="text-sm text-muted">No leader roles.</p>}
      {roles?.map((r) =>
        editing !== "new" && editing?.id === r.id ? (
          <RoleForm key={r.id} lookup={lookup} initial={r} onCancel={() => setEditing(null)} onSave={(input) => api.adminUpdateRole(r.id, input).then(done)} />
        ) : (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line p-3">
            <span className="min-w-0">
              <span className="block font-semibold text-navy-900">
                {levelLabel[r.level]} · {r.position}
              </span>
              <span className="block text-[13px] text-muted">
                {place(r)}
                {r.term_ends_on ? ` · term ends ${formatDay(r.term_ends_on)}` : ""}
              </span>
            </span>
            <span className="flex items-center gap-1">
              <StatusBadge status={roleState(r)} />
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(r)} aria-label={`Edit ${r.position}`}>
                <Pencil className="size-4" aria-hidden="true" />
              </button>
              <button type="button" className="btn btn-ghost btn-sm text-danger" onClick={() => void remove(r)} aria-label={`Delete ${r.position}`}>
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </span>
          </div>
        ),
      )}
      {editing === "new" ? (
        <RoleForm lookup={lookup} onCancel={() => setEditing(null)} onSave={(input) => api.adminAssignRole(member.id, input).then(done)} />
      ) : (
        <button type="button" className="btn btn-outline self-start" onClick={() => setEditing("new")}>
          <Plus className="size-4" aria-hidden="true" />
          Assign a role
        </button>
      )}
    </div>
  );
}

function RoleForm({ lookup, initial, onCancel, onSave }: { lookup: Lookup; initial?: LeaderRole; onCancel: () => void; onSave: (r: AdminRoleInput) => Promise<void> }) {
  const [level, setLevel] = useState<LeaderLevel>(initial?.level ?? "institutional");
  const [assoc, setAssoc] = useState<number | null>(initial?.association_id ?? null);
  const [inst, setInst] = useState<number | null>(initial?.institution_id ?? null);
  const [position, setPosition] = useState(initial?.position ?? "");
  const [status, setStatus] = useState<LeaderRole["status"]>(initial?.status ?? "approved");
  const [term, setTerm] = useState(initial?.term_ends_on ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSave({ level, position, association_id: level === "national" ? null : assoc, institution_id: level === "institutional" ? inst : null, status, term_ends_on: term || null });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="grid gap-3 rounded-md border border-line bg-paper p-3 sm:grid-cols-2">
      <ScopeFields lookup={lookup} level={level} assoc={assoc} inst={inst} onLevel={setLevel} onAssoc={setAssoc} onInst={setInst} />
      <TextInput label="Position" value={position} onChange={(e) => setPosition(e.target.value)} placeholder="e.g. Chairperson" />
      {initial && (
        <SelectInput label="Status" value={status} onChange={(e) => setStatus(e.target.value as LeaderRole["status"])}>
          <option value="approved">Approved (active)</option>
          <option value="pending">Waiting for approval</option>
          <option value="rejected">Declined</option>
          <option value="revoked">Revoked (ended)</option>
        </SelectInput>
      )}
      <TextInput label="Term ends on" type="date" value={term} onChange={(e) => setTerm(e.target.value)} hint="Leave empty for the next 31 August." />
      {error && (
        <div className="sm:col-span-2">
          <Alert tone="error">{error}</Alert>
        </div>
      )}
      <div className="flex justify-end gap-2 sm:col-span-2">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
          {busy ? "Saving…" : initial ? "Save role" : "Assign role"}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- Past leadership
function PastPanel({ member, lookup, onChanged }: { member: MemberRow; lookup: Lookup; onChanged: () => void }) {
  const [rows, setRows] = useState<PastRole[] | null>(null);
  const [editing, setEditing] = useState<PastRole | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    api
      .listPastRoles()
      .then((all) => setRows(all.filter((r) => r.user_id === member.id)))
      .catch((e) => setError(errorMessage(e)));
  }, [member.id]);
  useEffect(load, [load]);
  const done = () => {
    setEditing(null);
    load();
    onChanged();
  };
  async function remove(r: PastRole) {
    if (!confirm(`Delete “${pastRoleText(r, lookup)}”?`)) return;
    try {
      await api.removePastRole(r.id);
      done();
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  return (
    <div className="flex flex-col gap-3">
      {error && <Alert tone="error">{error}</Alert>}
      {rows?.length === 0 && <p className="text-sm text-muted">No past leadership recorded. Members add their own from My profile.</p>}
      {rows?.map((r) =>
        editing?.id === r.id ? (
          <PastForm key={r.id} lookup={lookup} initial={r} onCancel={() => setEditing(null)} onSaved={done} />
        ) : (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line p-3">
            <span className="min-w-0">
              <span className="block font-semibold text-navy-900">{pastRoleText(r, lookup)}</span>
              <span className="block text-[13px] text-muted">
                {r.status === "confirmed" ? "Confirmed" : r.status === "pending" ? "Waiting for confirmation" : "Not confirmed"}
                {r.show_publicly ? " · on public page" : ""}
              </span>
            </span>
            <span className="flex items-center gap-1">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(r)} aria-label={`Edit ${r.position}`}>
                <Pencil className="size-4" aria-hidden="true" />
              </button>
              <button type="button" className="btn btn-ghost btn-sm text-danger" onClick={() => void remove(r)} aria-label={`Delete ${r.position}`}>
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </span>
          </div>
        ),
      )}
    </div>
  );
}

/** Administrators: edit any past leadership entry, including its status. */
export function PastForm({ lookup, initial, onCancel, onSaved }: { lookup: Lookup; initial: PastRole; onCancel: () => void; onSaved: () => void }) {
  const [level, setLevel] = useState<LeaderLevel>(initial.level);
  const [assoc, setAssoc] = useState<number | null>(initial.association_id);
  const [inst, setInst] = useState<number | null>(initial.institution_id);
  const [position, setPosition] = useState(initial.position);
  const [from, setFrom] = useState(String(initial.from_year));
  const [to, setTo] = useState(String(initial.to_year));
  const [status, setStatus] = useState(initial.status);
  const [show, setShow] = useState(initial.show_publicly);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.adminUpdatePastRole(initial.id, {
        level,
        association_id: level === "national" ? null : assoc,
        institution_id: level === "institutional" ? inst : null,
        position,
        from_year: Number(from),
        to_year: Number(to),
        show_publicly: show,
        status,
      });
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="grid gap-3 rounded-md border border-line bg-paper p-3 sm:grid-cols-2">
      <ScopeFields lookup={lookup} level={level} assoc={assoc} inst={inst} onLevel={setLevel} onAssoc={setAssoc} onInst={setInst} />
      <TextInput label="Position" value={position} onChange={(e) => setPosition(e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <TextInput label="From" type="number" value={from} onChange={(e) => setFrom(e.target.value)} />
        <TextInput label="To" type="number" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      <SelectInput label="Status" value={status} onChange={(e) => setStatus(e.target.value as PastRole["status"])}>
        <option value="confirmed">Confirmed</option>
        <option value="pending">Waiting for confirmation</option>
        <option value="declined">Not confirmed</option>
      </SelectInput>
      {level !== "institutional" && (
        <label className="flex items-center gap-2 text-sm text-body sm:col-span-2">
          <input type="checkbox" className="size-4 accent-[#0B1F4D]" checked={show} onChange={(e) => setShow(e.target.checked)} />
          Show on the public Past leaders page (only with the member's agreement)
        </label>
      )}
      {error && (
        <div className="sm:col-span-2">
          <Alert tone="error">{error}</Alert>
        </div>
      )}
      <div className="flex justify-end gap-2 sm:col-span-2">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- Account
function AccountPanel({ member, onDeleted }: { member: MemberRow; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (member.isAdmin) {
    return <p className="text-sm text-body">This person is an administrator. Remove their administrator access first if their account must be deleted.</p>;
  }
  async function remove() {
    if (!confirm(`Delete ${member.full_name}'s account completely? Their login, profile, roles and feedback are deleted; posts and churches they added stay without their name. This can't be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      await api.adminDeleteMember(member.id);
      onDeleted();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-body">
        To change their login email, use <strong>Change email</strong> in the members list. To keep the account but stop it counting as a member, set
        Membership to “Declined” on the Profile tab.
      </p>
      {error && <Alert tone="error">{error}</Alert>}
      <div className="rounded-md border border-[#f3c2bd] bg-[#fdf3f2] p-4">
        <p className="font-semibold text-danger">Delete account</p>
        <p className="mt-1 text-sm text-body">Removes the login and profile permanently.</p>
        <button type="button" className="btn btn-danger mt-3" onClick={() => void remove()} disabled={busy}>
          <Trash2 className="size-4" aria-hidden="true" />
          {busy ? "Deleting…" : `Delete ${member.full_name}'s account`}
        </button>
      </div>
    </div>
  );
}
