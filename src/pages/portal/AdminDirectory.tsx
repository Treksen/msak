import { useMemo, useState, type ReactNode } from "react";
import { Navigate } from "react-router";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { api, errorMessage } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { usePortal } from "../../lib/portal";
import { Alert, PageHeader, SelectInput, TextInput } from "../../components/ui";

/** Administrators: the lists behind registration — associations, counties and institutions. */
export function AdminDirectoryPage() {
  const { perms } = usePortal();
  const { reloadDirectory } = useAuth();
  const [tab, setTab] = useState<"institutions" | "counties" | "associations">("institutions");
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  if (!perms.isAdmin) return <Navigate to="/app" replace />;

  /** Run a change, refresh the lists everywhere, and report the result. */
  const run = async (fn: () => Promise<void>, ok: string) => {
    setMsg(null);
    try {
      await fn();
      await reloadDirectory();
      setMsg({ tone: "success", text: ok });
      return true;
    } catch (e) {
      setMsg({ tone: "error", text: errorMessage(e) });
      return false;
    }
  };

  return (
    <div>
      <PageHeader eyebrow="Administration" title="Directory">
        The associations, counties and institutions people choose when they register. Renaming updates everyone linked to it. Something still in
        use (members, churches, roles) can't be deleted — move those first.
      </PageHeader>
      <div role="tablist" aria-label="Lists" className="mb-5 flex flex-wrap gap-1 rounded-md bg-[#f1eee5] p-1 sm:inline-flex">
        {(
          [
            ["institutions", "Institutions"],
            ["counties", "Counties"],
            ["associations", "Associations"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => {
              setTab(id);
              setMsg(null);
            }}
            className={`rounded px-3.5 py-2 text-sm font-semibold ${tab === id ? "bg-white text-navy-900 shadow-sm" : "text-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {msg && (
        <div className="mb-4">
          <Alert tone={msg.tone}>{msg.text}</Alert>
        </div>
      )}
      {tab === "institutions" && <Institutions run={run} />}
      {tab === "counties" && <Counties run={run} />}
      {tab === "associations" && <Associations run={run} />}
    </div>
  );
}

type Run = (fn: () => Promise<void>, ok: string) => Promise<boolean>;

function Row({ children, actions }: { children: ReactNode; actions: ReactNode }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
      <div className="min-w-0 flex-1">{children}</div>
      <div className="flex flex-none gap-1">{actions}</div>
    </li>
  );
}

function IconButton({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: ReactNode }) {
  return (
    <button type="button" className={`btn btn-ghost btn-sm ${danger ? "text-danger" : ""}`} aria-label={label} title={label} onClick={onClick}>
      {children}
    </button>
  );
}

// ---------------------------------------------------------------- Institutions
function Institutions({ run }: { run: Run }) {
  const { lookup } = usePortal();
  const [q, setQ] = useState("");
  const [assoc, setAssoc] = useState<number | "all">("all");
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const all = useMemo(() => lookup.associations.flatMap((a) => lookup.institutionsInAssociation(a.id)), [lookup]);
  const shown = all.filter((i) => {
    const a = lookup.associationOfInstitution(i.id);
    if (assoc !== "all" && a?.id !== assoc) return false;
    return !q.trim() || lookup.placeLabel(i.id).toLowerCase().includes(q.trim().toLowerCase());
  });
  return (
    <section>
      <div className="mb-3 flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input className="input pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search institutions" aria-label="Search institutions" />
        </div>
        <select className="input w-auto" value={assoc} onChange={(e) => setAssoc(e.target.value === "all" ? "all" : Number(e.target.value))} aria-label="Association">
          <option value="all">All associations</option>
          {lookup.associations.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code}
            </option>
          ))}
        </select>
        <button type="button" className="btn btn-primary" onClick={() => setEditing("new")}>
          <Plus className="size-4" aria-hidden="true" />
          Add institution
        </button>
      </div>
      {editing === "new" && (
        <InstitutionForm
          onCancel={() => setEditing(null)}
          onSave={async (countyId, name) => (await run(() => api.addInstitution(countyId, name), `Added ${name}.`)) && setEditing(null)}
        />
      )}
      <p className="mb-2 text-sm text-muted">{shown.length} institutions</p>
      <ul className="card divide-y divide-line">
        {shown.map((i) =>
          editing === i.id ? (
            <li key={i.id} className="p-3">
              <InstitutionForm
                initial={i}
                onCancel={() => setEditing(null)}
                onSave={async (countyId, name) => (await run(() => api.updateInstitution(i.id, countyId, name), "Saved.")) && setEditing(null)}
              />
            </li>
          ) : (
            <Row
              key={i.id}
              actions={
                <>
                  <IconButton label={`Edit ${i.name}`} onClick={() => setEditing(i.id)}>
                    <Pencil className="size-4" aria-hidden="true" />
                  </IconButton>
                  <IconButton
                    label={`Delete ${i.name}`}
                    danger
                    onClick={() => {
                      if (confirm(`Delete “${i.name}”?`)) void run(() => api.deleteInstitution(i.id), `Deleted ${i.name}.`);
                    }}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </IconButton>
                </>
              }
            >
              <p className="font-semibold text-navy-900">{i.name}</p>
              <p className="text-[13px] text-muted">
                {lookup.county(i.county_id)?.name} · {lookup.associationOfInstitution(i.id)?.code}
              </p>
            </Row>
          ),
        )}
      </ul>
    </section>
  );
}

function InstitutionForm({ initial, onCancel, onSave }: { initial?: { name: string; county_id: number }; onCancel: () => void; onSave: (countyId: number, name: string) => void }) {
  const { lookup } = usePortal();
  const [name, setName] = useState(initial?.name ?? "");
  const [countyId, setCountyId] = useState<number | "">(initial?.county_id ?? "");
  return (
    <form
      className="mb-3 grid gap-3 rounded-md border border-line bg-paper p-3 sm:grid-cols-[1fr_220px_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        if (countyId && name.trim().length >= 3) onSave(Number(countyId), name);
      }}
    >
      <TextInput label="Institution name" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} autoFocus />
      <SelectInput label="County" value={countyId} onChange={(e) => setCountyId(Number(e.target.value) || "")}>
        <option value="">Choose</option>
        {lookup.associations.map((a) => (
          <optgroup key={a.id} label={a.code}>
            {lookup.countiesOf(a.id).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </optgroup>
        ))}
      </SelectInput>
      <div className="flex gap-2">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={!countyId || name.trim().length < 3}>
          Save
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- Counties
function Counties({ run }: { run: Run }) {
  const { lookup } = usePortal();
  const [editing, setEditing] = useState<number | "new" | null>(null);
  return (
    <section className="flex flex-col gap-4">
      <div>
        <button type="button" className="btn btn-primary" onClick={() => setEditing("new")}>
          <Plus className="size-4" aria-hidden="true" />
          Add county
        </button>
      </div>
      {editing === "new" && (
        <CountyForm
          onCancel={() => setEditing(null)}
          onSave={async (assocId, name) => (await run(() => api.addCounty(assocId, name), `Added ${name}.`)) && setEditing(null)}
        />
      )}
      {lookup.associations.map((a) => (
        <div key={a.id}>
          <h2 className="mb-2 font-semibold text-navy-900">
            {a.code} <span className="font-normal text-muted">· {a.name}</span>
          </h2>
          <ul className="card divide-y divide-line">
            {lookup.countiesOf(a.id).map((c) =>
              editing === c.id ? (
                <li key={c.id} className="p-3">
                  <CountyForm
                    initial={c}
                    onCancel={() => setEditing(null)}
                    onSave={async (assocId, name) => (await run(() => api.updateCounty(c.id, assocId, name), "Saved.")) && setEditing(null)}
                  />
                </li>
              ) : (
                <Row
                  key={c.id}
                  actions={
                    <>
                      <IconButton label={`Edit ${c.name}`} onClick={() => setEditing(c.id)}>
                        <Pencil className="size-4" aria-hidden="true" />
                      </IconButton>
                      <IconButton
                        label={`Delete ${c.name}`}
                        danger
                        onClick={() => {
                          if (confirm(`Delete ${c.name} county?`)) void run(() => api.deleteCounty(c.id), `Deleted ${c.name}.`);
                        }}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </IconButton>
                    </>
                  }
                >
                  <p className="font-semibold text-navy-900">{c.name}</p>
                  <p className="text-[13px] text-muted">{lookup.institutionsOf(c.id).length} institutions</p>
                </Row>
              ),
            )}
          </ul>
        </div>
      ))}
    </section>
  );
}

function CountyForm({ initial, onCancel, onSave }: { initial?: { name: string; association_id: number }; onCancel: () => void; onSave: (assocId: number, name: string) => void }) {
  const { lookup } = usePortal();
  const [name, setName] = useState(initial?.name ?? "");
  const [assocId, setAssocId] = useState<number | "">(initial?.association_id ?? "");
  return (
    <form
      className="grid gap-3 rounded-md border border-line bg-paper p-3 sm:grid-cols-[1fr_200px_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        if (assocId && name.trim().length >= 2) onSave(Number(assocId), name);
      }}
    >
      <TextInput label="County name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus />
      <SelectInput label="Association" value={assocId} onChange={(e) => setAssocId(Number(e.target.value) || "")}>
        <option value="">Choose</option>
        {lookup.associations.map((a) => (
          <option key={a.id} value={a.id}>
            {a.code}
          </option>
        ))}
      </SelectInput>
      <div className="flex gap-2">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={!assocId || name.trim().length < 2}>
          Save
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- Associations
function Associations({ run }: { run: Run }) {
  const { lookup } = usePortal();
  const [editing, setEditing] = useState<number | "new" | null>(null);
  return (
    <section className="flex flex-col gap-3">
      <div>
        <button type="button" className="btn btn-primary" onClick={() => setEditing("new")}>
          <Plus className="size-4" aria-hidden="true" />
          Add association
        </button>
      </div>
      {editing === "new" && (
        <AssociationForm
          onCancel={() => setEditing(null)}
          onSave={async (code, name) => (await run(() => api.addAssociation(code, name), `Added ${code}.`)) && setEditing(null)}
        />
      )}
      <ul className="card divide-y divide-line">
        {lookup.associations.map((a) =>
          editing === a.id ? (
            <li key={a.id} className="p-3">
              <AssociationForm
                initial={a}
                onCancel={() => setEditing(null)}
                onSave={async (code, name) => (await run(() => api.updateAssociation(a.id, code, name), "Saved.")) && setEditing(null)}
              />
            </li>
          ) : (
            <Row
              key={a.id}
              actions={
                <>
                  <IconButton label={`Edit ${a.code}`} onClick={() => setEditing(a.id)}>
                    <Pencil className="size-4" aria-hidden="true" />
                  </IconButton>
                  <IconButton
                    label={`Delete ${a.code}`}
                    danger
                    onClick={() => {
                      if (confirm(`Delete ${a.code}?`)) void run(() => api.deleteAssociation(a.id), `Deleted ${a.code}.`);
                    }}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </IconButton>
                </>
              }
            >
              <p className="font-semibold text-navy-900">
                {a.code} <span className="font-normal text-body">· {a.name}</span>
              </p>
              <p className="text-[13px] text-muted">{lookup.countiesOf(a.id).map((c) => c.name).join(", ") || "No counties"}</p>
            </Row>
          ),
        )}
      </ul>
    </section>
  );
}

function AssociationForm({ initial, onCancel, onSave }: { initial?: { code: string; name: string }; onCancel: () => void; onSave: (code: string, name: string) => void }) {
  const [code, setCode] = useState(initial?.code ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const codeOk = /^[A-Z]{2,12}$/.test(code.trim().toUpperCase());
  return (
    <form
      className="grid gap-3 rounded-md border border-line bg-paper p-3 sm:grid-cols-[160px_1fr_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        if (codeOk && name.trim().length >= 3) onSave(code, name);
      }}
    >
      <TextInput label="Short code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={12} hint="Letters only, e.g. NAMSA" />
      <TextInput label="Full name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
      <div className="flex gap-2">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={!codeOk || name.trim().length < 3}>
          Save
        </button>
      </div>
    </form>
  );
}
