import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { Camera, Trash2 } from "lucide-react";
import { api, errorMessage } from "../../lib/api";
import { useAuth, useMe } from "../../lib/auth";
import { usePortal } from "../../lib/portal";
import { formatDate } from "../../lib/format";
import { isAlumni } from "../../lib/academic";
import { squarePhoto } from "../../lib/image";
import type { Gender } from "../../lib/types";
import { Alert, PageHeader, SelectInput, TextInput } from "../../components/ui";
import { Avatar } from "../../components/Avatar";

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

  if (!p) return me.isAdmin ? <AdminAccount /> : <Alert tone="warn">Your profile wasn't found. Please contact an administrator.</Alert>;
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

      {isAlumni(p) && (
        <Alert tone="info">
          <strong>You're now alumni</strong> (completion year {p.expected_completion_year}). You receive national, regional and alumni
          announcements. Still studying — repeating a year or deferred? Update your <strong>expected completion year</strong> below and
          you'll be a student again.
        </Alert>
      )}

      <PhotoCard name={p.full_name} path={p.photo_path} />

      <form onSubmit={save} className="card grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
        <h2 className="font-serif text-xl font-semibold text-navy-900 sm:col-span-2">Personal details</h2>
        <TextInput label="Full name" name="full_name" defaultValue={p.full_name} required minLength={2} maxLength={120} />
        <TextInput label="Email" value={me.email ?? ""} disabled hint="Email wrong? Tell MSAK in Help & feedback (or ask your campus leader) and an administrator will correct it; your password stays the same." />
        <TextInput label="Phone" name="phone" type="tel" defaultValue={p.phone} required />
        <SelectInput label="Gender" name="gender" defaultValue={p.gender}>
          <option>Male</option>
          <option>Female</option>
        </SelectInput>

        <h2 className="mt-4 font-serif text-xl font-semibold text-navy-900 sm:col-span-2">Campus</h2>
        <p className="-mt-2 text-sm sm:col-span-2">
          {p.verification === "verified" ? (
            <span className="font-semibold text-success">✓ Confirmed as a student here{p.verified_at ? ` · ${formatDate(p.verified_at)}` : ""}</span>
          ) : p.verification === "pending" ? (
            <span className="font-semibold text-gold-800">Waiting for a leader to confirm you study here.</span>
          ) : (
            <span className="font-semibold text-danger">Not confirmed{p.verification_note ? ` — ${p.verification_note}` : ""}. Correct your institution below if it's wrong.</span>
          )}{" "}
          <span className="text-muted">Changing institution means the new campus's leaders confirm you again.</span>
        </p>
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

      <p className="text-sm text-muted">
        Leader roles and past positions are under <Link to="/app/leadership">My leadership</Link> and{" "}
        <Link to="/app/past-leadership">Past leadership</Link>. Password and dark mode are in <Link to="/app/settings">Settings</Link>.
      </p>
    </div>
  );
}

/** Profile photo: pick one from the phone/computer; it's cropped square and shrunk before upload. */
function PhotoCard({ name, path }: { name: string; path?: string | null }) {
  const { refresh } = useAuth();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"up" | "rm" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy("up");
    try {
      await api.uploadProfilePhoto(await squarePhoto(file));
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  }
  async function remove() {
    if (!confirm("Remove your profile photo?")) return;
    setError(null);
    setBusy("rm");
    try {
      await api.removeProfilePhoto();
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-labelledby="photo-h" className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
      <Avatar name={name} path={path} size={96} className="text-2xl" />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div>
          <h2 id="photo-h" className="font-serif text-xl font-semibold text-navy-900">
            Profile photo
          </h2>
          <p className="mt-1 text-sm text-muted">A clear photo of your face helps leaders recognise and confirm you. It's cropped to a square.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => void choose(e.target.files?.[0])} />
          <button type="button" className="btn btn-outline btn-sm" disabled={!!busy} onClick={() => input.current?.click()}>
            <Camera className="size-4" aria-hidden="true" />
            {busy === "up" ? "Uploading…" : path ? "Change photo" : "Upload photo"}
          </button>
          {path && (
            <button type="button" className="btn btn-ghost btn-sm text-danger" disabled={!!busy} onClick={() => void remove()}>
              <Trash2 className="size-4" aria-hidden="true" />
              {busy === "rm" ? "Removing…" : "Remove"}
            </button>
          )}
        </div>
        {error && <Alert tone="error">{error}</Alert>}
      </div>
    </section>
  );
}

/** Account page for an administrator who has no member profile (not a student). */
function AdminAccount() {
  const me = useMe();
  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow="Administrator" title="My account">
        Your account is separate from the member register.
      </PageHeader>
      <section className="card flex flex-col gap-3 p-5 sm:p-6">
        <h2 className="font-serif text-xl font-semibold text-navy-900">Sign-in</h2>
        <TextInput label="Email" value={me.email ?? ""} disabled hint="Change it in Supabase → Authentication → Users." />
        <p className="text-sm text-muted">
          Change your password or switch to dark mode in <Link to="/app/settings">Settings</Link>.
        </p>
      </section>
      <section className="card flex flex-col gap-2 p-5 sm:p-6">
        <h2 className="font-serif text-xl font-semibold text-navy-900">You're invisible to members</h2>
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-body">
          <li>You don't appear in any member or leader list, and no one can see who the administrators are.</li>
          <li>Announcements you post are signed “MSAK National Office”.</li>
          <li>Churches you add or edit are credited to “MSAK”.</li>
          <li>You can see and manage everything: members, leaders, announcements, churches and documents.</li>
        </ul>
      </section>
    </div>
  );
}
