import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router";
import { BadgeCheck, FileText, MapPin, Megaphone, Pencil, Plus, ScrollText, Star, Trash2, Users } from "lucide-react";
import { api, errorMessage } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { usePortal } from "../../lib/portal";
import { timeAgo } from "../../lib/format";
import type { FeedbackItem, HomeBanner } from "../../lib/types";
import { bannerStatus, formatEventDates, fromLocalInput, toLocalInput } from "../../lib/banners";
import { HomeBannerStrip } from "../../components/HomeBanner";
import { AdminDashboardPanel } from "../../components/AdminDashboard";
import { Alert, EmptyState, Modal, PageHeader, SelectInput, TextInput } from "../../components/ui";

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
    { to: "/app/admin/logs", icon: ScrollText, title: "Activity & error logs", text: "Who changed what, and errors on people's devices." },
  ];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow="Administration" title="Run the portal">
        Everything administrators can do. Leaders handle their own scope; you can step in anywhere.
      </PageHeader>

      <AdminDashboardPanel />

      <h2 className="-mb-4 font-serif text-xl font-semibold text-navy-900">Tools</h2>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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

      <BannerManager />

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

/* ---------------------------------------------------------------------------
   Homepage banner: an event strip with a countdown under the homepage hero.
   The soonest live banner is shown; it disappears by itself after the end time.
--------------------------------------------------------------------------- */
function BannerManager() {
  const [rows, setRows] = useState<HomeBanner[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<HomeBanner | "new" | null>(null);

  const load = () =>
    api
      .listAllBanners()
      .then(setRows)
      .catch((e) => setError(errorMessage(e)));
  useEffect(() => {
    void load();
  }, []);

  const statusCls: Record<string, string> = { Live: "badge-ok", Scheduled: "badge-region", Hidden: "badge-muted", Ended: "badge-muted" };

  return (
    <section aria-labelledby="ban-h" className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 id="ban-h" className="flex items-center gap-2 font-serif text-xl font-semibold text-navy-900">
            <Megaphone className="size-5 text-gold-700" aria-hidden="true" />
            Homepage banner
          </h2>
          <p className="text-[13px] text-muted">An event strip with a countdown under the homepage photo. It hides itself after the event ends.</p>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing("new")}>
          <Plus className="size-4" aria-hidden="true" />
          New banner
        </button>
      </div>
      {error && (
        <div className="p-5">
          <Alert tone="error">{error}</Alert>
        </div>
      )}
      {rows === null ? (
        <p className="px-5 py-6 text-sm text-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="p-5">
          <EmptyState title="No banner yet">Add your next rally or event and members will see a countdown on the homepage.</EmptyState>
        </div>
      ) : (
        <ul className="divide-y divide-[#efebe0]">
          {rows.map((b) => {
            const st = bannerStatus(b);
            return (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-navy-900">
                    {b.title} <span className={`badge ${statusCls[st]}`}>{st}</span>
                  </p>
                  <p className="text-[13px] text-muted">
                    {formatEventDates(b.starts_at, b.ends_at)}
                    {b.venue ? ` · ${b.venue}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing(b)}>
                    <Pencil className="size-4" aria-hidden="true" />
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    aria-label={`Delete ${b.title}`}
                    onClick={async () => {
                      if (!confirm(`Delete the banner “${b.title}”?`)) return;
                      try {
                        await api.deleteBanner(b.id);
                        void load();
                      } catch (e) {
                        alert(errorMessage(e));
                      }
                    }}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={editing !== null} wide title={editing === "new" ? "New homepage banner" : "Edit banner"} onClose={() => setEditing(null)}>
        {editing !== null && (
          <BannerForm
            key={editing === "new" ? "new" : editing.id}
            banner={editing === "new" ? null : editing}
            onDone={() => {
              setEditing(null);
              void load();
            }}
          />
        )}
      </Modal>
    </section>
  );
}

function BannerForm({ banner, onDone }: { banner: HomeBanner | null; onDone: () => void }) {
  const [title, setTitle] = useState(banner?.title ?? "");
  const [venue, setVenue] = useState(banner?.venue ?? "");
  const [start, setStart] = useState(toLocalInput(banner?.starts_at ?? null));
  const [end, setEnd] = useState(toLocalInput(banner?.ends_at ?? null));
  const [linkUrl, setLinkUrl] = useState(banner?.link_url ?? "");
  const [linkLabel, setLinkLabel] = useState(banner?.link_label ?? "");
  const [active, setActive] = useState(banner?.is_active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startsAt = fromLocalInput(start);
  const endsAt = fromLocalInput(end);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (title.trim().length < 3) return setError("Enter the event name (at least 3 characters).");
    if (!startsAt) return setError("Choose when the event starts.");
    if (endsAt && endsAt < startsAt) return setError("The end must be after the start.");
    if (linkUrl.trim() && !/^https:\/\//i.test(linkUrl.trim())) return setError("The link must start with https://");
    setBusy(true);
    setError(null);
    try {
      await api.saveBanner(
        {
          title: title.trim(),
          venue: venue.trim() || null,
          starts_at: startsAt,
          ends_at: endsAt,
          link_url: linkUrl.trim() || null,
          link_label: linkLabel.trim() || null,
          is_active: active,
        },
        banner?.id,
      );
      onDone();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <div>
        <p className="field-label">Preview</p>
        <div className="relative overflow-hidden rounded-lg p-3 sm:p-5">
          <img src="/photos/photo-0058-1280.webp" alt="" className="absolute inset-0 size-full object-cover" />
          <div aria-hidden="true" className="absolute inset-0 bg-navy-950/60" />
          <div className="relative">
          <HomeBannerStrip
            preview
            variant="glass"
            banner={{
              title: title.trim() || "Event title",
              venue: venue.trim() || null,
              starts_at: startsAt ?? new Date(Date.now() + 7 * 86_400_000).toISOString(),
              ends_at: endsAt,
              link_url: linkUrl.trim() || null,
              link_label: linkLabel.trim() || null,
            }}
          />
          </div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <TextInput label="Event name" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. MSAK National Rally 2027" />
        </div>
        <TextInput label="Starts (Kenya time)" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} hint="The countdown runs to this moment." />
        <TextInput label="Ends (optional)" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} hint="Without an end, the banner hides one day after the start." />
        <div className="sm:col-span-2">
          <TextInput label="Venue (optional)" value={venue} onChange={(e) => setVenue(e.target.value)} maxLength={160} placeholder="e.g. Kenyatta University" />
        </div>
        <TextInput label="Link (optional)" type="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" hint="Registration form, poster or programme." />
        <TextInput label="Link text" value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} maxLength={40} placeholder="e.g. Register now" />
      </div>
      <label className="flex items-start gap-3 rounded-md border border-line bg-paper p-3 text-sm">
        <input type="checkbox" className="mt-0.5 size-5 accent-[#0B1F4D]" checked={active} onChange={(e) => setActive(e.target.checked)} />
        <span>
          <strong className="text-navy-900">Show on the homepage</strong>
          <span className="block text-muted">Untick to keep it as a hidden draft.</span>
        </span>
      </label>
      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <button type="button" className="btn btn-outline" onClick={onDone} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Saving…" : banner ? "Save changes" : "Create banner"}
        </button>
      </div>
    </form>
  );
}
