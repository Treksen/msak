import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router";
import { BadgeCheck, FileText, MapPin, Star, Users } from "lucide-react";
import { api, errorMessage } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { usePortal } from "../../lib/portal";
import { timeAgo } from "../../lib/format";
import type { FeedbackItem } from "../../lib/types";
import { Alert, EmptyState, PageHeader, SelectInput, TextInput } from "../../components/ui";

export function AdminPage() {
  const { lookup, perms } = usePortal();
  const { reloadDirectory } = useAuth();
  const [feedback, setFeedback] = useState<FeedbackItem[] | null>(null);

  useEffect(() => {
    document.title = "Administration — MSAK";
    if (perms.isAdmin) api.listFeedback().then(setFeedback).catch(() => setFeedback([]));
  }, [perms.isAdmin]);

  if (!perms.isAdmin) return <Navigate to="/app" replace />;

  const shortcuts = [
    { to: "/app/leaders", icon: BadgeCheck, title: "Leader approvals", text: "Verify national and regional leaders; revoke roles." },
    { to: "/app/members", icon: Users, title: "Members", text: "Search, export to CSV, add administrators." },
    { to: "/app/churches", icon: MapPin, title: "Churches", text: "Edit any church, confirm suggestions anywhere." },
    { to: "/app/documents", icon: FileText, title: "Documents", text: "Upload the constitution, guidelines and forms." },
  ];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow="Administration" title="Run the portal">
        Everything administrators can do. Leaders handle their own scope; you can step in anywhere.
      </PageHeader>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {shortcuts.map((s) => (
          <li key={s.to}>
            <Link to={s.to} className="card flex h-full flex-col gap-2 p-5 no-underline hover:border-line-strong">
              <s.icon className="size-6 text-gold-700" aria-hidden="true" />
              <span className="font-serif text-lg font-semibold text-navy-900">{s.title}</span>
              <span className="text-sm leading-relaxed text-body">{s.text}</span>
            </Link>
          </li>
        ))}
      </ul>

      <section aria-labelledby="dir-h" className="card p-5 sm:p-6">
        <h2 id="dir-h" className="font-serif text-xl font-semibold text-navy-900">
          Add an institution
        </h2>
        <p className="mb-4 mt-1 text-sm text-body">When a member reports a missing campus, add it here so it appears in registration and profiles.</p>
        <AddInstitution lookup={lookup} onAdded={reloadDirectory} />
      </section>

      <section aria-labelledby="fb-h" className="card overflow-hidden">
        <h2 id="fb-h" className="border-b border-line px-5 py-4 font-serif text-xl font-semibold text-navy-900">
          Member feedback
        </h2>
        {feedback === null ? (
          <p className="px-5 py-6 text-sm text-muted">Loading…</p>
        ) : feedback.length === 0 ? (
          <div className="p-5">
            <EmptyState title="No feedback yet" />
          </div>
        ) : (
          <ul className="divide-y divide-[#efebe0]">
            {feedback.map((f) => (
              <li key={f.id} className="px-5 py-4">
                <p className="flex items-center gap-2 text-[13px] text-muted">
                  <span className="flex" aria-label={`${f.rating} out of 5`}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} className={`size-4 ${n <= f.rating ? "fill-gold-500 text-gold-500" : "text-line-strong"}`} aria-hidden="true" />
                    ))}
                  </span>
                  {timeAgo(f.created_at)}
                </p>
                <p className="mt-1 whitespace-pre-line text-sm text-body">{f.message}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function AddInstitution({ lookup, onAdded }: { lookup: ReturnType<typeof usePortal>["lookup"]; onAdded: () => Promise<void> }) {
  const [assocId, setAssocId] = useState<number>(lookup.associations[0]?.id ?? 1);
  const [countyId, setCountyId] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const name = String(new FormData(form).get("name") ?? "").trim();
    if (!countyId) return setMsg({ tone: "error", text: "Choose the county." });
    if (name.length < 2) return setMsg({ tone: "error", text: "Enter the institution's full name." });
    setBusy(true);
    setMsg(null);
    try {
      await api.addInstitution(countyId, name);
      await onAdded();
      form.reset();
      setMsg({ tone: "success", text: `${name} added.` });
    } catch (err) {
      setMsg({ tone: "error", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-[160px_200px_1fr_auto] sm:items-end">
      <SelectInput
        label="Association"
        value={assocId}
        onChange={(e) => {
          setAssocId(Number(e.target.value));
          setCountyId(null);
        }}
      >
        {lookup.associations.map((a) => (
          <option key={a.id} value={a.id}>
            {a.code}
          </option>
        ))}
      </SelectInput>
      <SelectInput label="County" value={countyId ?? ""} onChange={(e) => setCountyId(Number(e.target.value) || null)}>
        <option value="">Choose</option>
        {lookup.countiesOf(assocId).map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </SelectInput>
      <TextInput label="Institution name" name="name" maxLength={200} placeholder="e.g. Thika Technical Training Institute" />
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? "Adding…" : "Add"}
      </button>
      {msg && (
        <div className="sm:col-span-4">
          <Alert tone={msg.tone}>{msg.text}</Alert>
        </div>
      )}
    </form>
  );
}
