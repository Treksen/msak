import { useEffect, useState, type FormEvent } from "react";
import { api, errorMessage } from "../../lib/api";
import { useAuth, useMe } from "../../lib/auth";
import { usePortal } from "../../lib/portal";
import { formatDate, levelLabel } from "../../lib/format";
import type { Gender, LeaderLevel } from "../../lib/types";
import { Alert, PageHeader, SelectInput, StatusBadge, TextInput } from "../../components/ui";

export function ProfilePage() {
  const me = useMe();
  const { refresh } = useAuth();
  const { lookup } = usePortal();
  const p = me.profile;
  const [assocId, setAssocId] = useState<number | null>(lookup.associationOfInstitution(p?.institution_id)?.id ?? null);
  const [countyId, setCountyId] = useState<number | null>(lookup.countyOfInstitution(p?.institution_id)?.id ?? null);
  const [instId, setInstId] = useState<number | null>(p?.institution_id ?? null);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = "My profile — MSAK";
  }, []);

  if (!p) return <Alert tone="warn">Your profile wasn't found. Please contact an administrator.</Alert>;
  const movingCampus = instId !== p.institution_id;
  const hasCampusRole = me.roles.some((r) => r.level === "institutional" && ["pending", "approved"].includes(r.status));

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (!instId) return setMsg({ tone: "error", text: "Choose your institution." });
    if (movingCampus && hasCampusRole && !confirm("Changing institution will close your campus leader role. Continue?")) return;
    setBusy(true);
    setMsg(null);
    try {
      await api.updateProfile({
        full_name: String(f.get("full_name")).trim(),
        phone: String(f.get("phone")).trim(),
        gender: String(f.get("gender")) as Gender,
        institution_id: instId,
        course: String(f.get("course")).trim(),
        admission_year: Number(f.get("admission_year")),
        year_of_study: Number(f.get("year_of_study")),
        expected_completion_year: Number(f.get("expected_completion_year")),
      });
      await refresh();
      setMsg({ tone: "success", text: "Profile saved." });
    } catch (err) {
      setMsg({ tone: "error", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="My profile">Keep your details current so you receive the right announcements.</PageHeader>

      <form onSubmit={save} className="card grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
        <h2 className="font-serif text-xl font-semibold text-navy-900 sm:col-span-2">Personal details</h2>
        <TextInput label="Full name" name="full_name" defaultValue={p.full_name} required minLength={2} maxLength={120} />
        <TextInput label="Email" value={me.email ?? ""} disabled hint="Contact an administrator to change your login email." />
        <TextInput label="Phone" name="phone" type="tel" defaultValue={p.phone} required />
        <SelectInput label="Gender" name="gender" defaultValue={p.gender}>
          <option>Male</option>
          <option>Female</option>
        </SelectInput>

        <h2 className="mt-4 font-serif text-xl font-semibold text-navy-900 sm:col-span-2">Campus</h2>
        <SelectInput
          label="Association"
          value={assocId ?? ""}
          onChange={(e) => {
            setAssocId(Number(e.target.value) || null);
            setCountyId(null);
            setInstId(null);
          }}
        >
          <option value="">Choose</option>
          {lookup.associations.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code} — {a.name}
            </option>
          ))}
        </SelectInput>
        <SelectInput
          label="County"
          value={countyId ?? ""}
          onChange={(e) => {
            setCountyId(Number(e.target.value) || null);
            setInstId(null);
          }}
        >
          <option value="">Choose</option>
          {lookup.countiesOf(assocId).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectInput>
        <div className="sm:col-span-2">
          <SelectInput label="Institution" value={instId ?? ""} onChange={(e) => setInstId(Number(e.target.value) || null)}>
            <option value="">Choose</option>
            {lookup.institutionsOf(countyId).map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </SelectInput>
        </div>
        <div className="sm:col-span-2">
          <TextInput label="Course" name="course" defaultValue={p.course} required />
        </div>
        <TextInput label="Year of admission" name="admission_year" type="number" defaultValue={p.admission_year} required />
        <TextInput label="Current year of study" name="year_of_study" type="number" min={1} max={10} defaultValue={p.year_of_study} required />
        <TextInput label="Expected completion year" name="expected_completion_year" type="number" defaultValue={p.expected_completion_year} required />

        {movingCampus && hasCampusRole && (
          <div className="sm:col-span-2">
            <Alert tone="warn">Moving to another institution closes your campus leader role. You can request it again at the new campus.</Alert>
          </div>
        )}
        {msg && (
          <div className="sm:col-span-2">
            <Alert tone={msg.tone}>{msg.text}</Alert>
          </div>
        )}
        <div className="flex justify-end sm:col-span-2">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save profile"}
          </button>
        </div>
      </form>

      <LeadershipSection />
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
        Leadership
      </h2>
      {me.roles.length === 0 ? (
        <p className="text-sm text-body">You don't hold a leadership role in the portal.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {me.roles.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line p-3">
              <span>
                <span className="block font-semibold text-navy-900">
                  {levelLabel[r.level]} leader · {r.position}
                </span>
                <span className="block text-[13px] text-muted">
                  {r.level === "institutional"
                    ? lookup.institution(r.institution_id)?.name
                    : r.level === "regional"
                      ? lookup.association(r.association_id)?.name
                      : "All of MSAK"}{" "}
                  · requested {formatDate(r.requested_at)}
                  {r.review_note ? ` · “${r.review_note}”` : ""}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <StatusBadge status={r.status} />
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

      {available.length > 0 && chosen && (
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
