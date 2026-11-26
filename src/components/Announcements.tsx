import { useState, type FormEvent } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { api, errorMessage } from "../lib/api";
import { audienceLabel, timeAgo } from "../lib/format";
import { shortInstitution, type Lookup } from "../lib/directory";
import type { Announcement, Audience, Me } from "../lib/types";
import { Alert, AudienceBadge, SelectInput, TextArea, TextInput } from "./ui";
import { isRoleActive } from "../lib/academic";

export function AnnouncementItem({
  a,
  lookup,
  canDelete,
  canEdit,
  onDeleted,
  compact,
}: {
  a: Announcement;
  lookup: Lookup;
  canDelete: boolean;
  /** Administrators can correct the title and message. */
  canEdit?: boolean;
  onDeleted?: () => void;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(a.title);
  const [body, setBody] = useState(a.body);
  const [editError, setEditError] = useState<string | null>(null);
  const scope =
    a.audience === "institutional"
      ? shortInstitution(lookup.institution(a.institution_id)?.name)
      : a.audience === "regional"
        ? lookup.association(a.association_id)?.code
        : "MSAK";
  return (
    <article className="flex flex-col gap-1.5 border-b border-[#efebe0] px-5 py-4 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <AudienceBadge audience={a.audience} />
        <span>
          {scope} · {timeAgo(a.created_at)}
        </span>
      </div>
      {editing ? (
        <form
          className="mt-1 flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setEditError(null);
            try {
              await api.updateAnnouncement(a.id, title, body);
              setEditing(false);
              onDeleted?.();
            } catch (err) {
              setEditError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <TextInput label="Title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} />
          <TextArea label="Message" value={body} onChange={(e) => setBody(e.target.value)} rows={6} maxLength={5000} />
          {editError && <Alert tone="error">{editError}</Alert>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
              Save changes
            </button>
          </div>
        </form>
      ) : (
        <>
          <h3 className="text-base font-bold leading-snug text-ink">{a.title}</h3>
          {!compact && <p className="whitespace-pre-line text-sm leading-relaxed text-body">{a.body}</p>}
        </>
      )}
      <div className="flex items-center justify-between gap-2 pt-1">
        <p className="text-xs text-muted">
          {a.author_name} · {a.author_title}
        </p>
        <span className="flex gap-1">
        {canEdit && !editing && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>
            <Pencil className="size-4" aria-hidden="true" />
            Edit
          </button>
        )}
        {canDelete && (
          <button
            type="button"
            className="btn btn-ghost btn-sm text-danger"
            disabled={busy}
            onClick={async () => {
              if (!confirm("Delete this announcement for everyone?")) return;
              setBusy(true);
              try {
                await api.deleteAnnouncement(a.id);
                onDeleted?.();
              } catch (e) {
                alert(errorMessage(e));
                setBusy(false);
              }
            }}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Delete
          </button>
        )}
        </span>
      </div>
    </article>
  );
}

/** Post form. Leaders only see the audiences their approved roles allow. */
export function Composer({
  me,
  lookup,
  audiences,
  onPosted,
}: {
  me: Me;
  lookup: Lookup;
  audiences: Audience[];
  onPosted: () => void;
}) {
  // Alumni posts are made under a national role.
  const roleFor = (aud: Audience) => me.roles.find((r) => isRoleActive(r) && r.level === (aud === "alumni" ? "national" : aud));
  const [audience, setAudience] = useState<Audience>(audiences[0]);
  const [assocId, setAssocId] = useState<number>(lookup.associationOfInstitution(me.profile?.institution_id)?.id ?? lookup.associations[0]?.id ?? 1);
  const [instId, setInstId] = useState<number>(
    me.profile?.institution_id ?? lookup.institutionsInAssociation(lookup.associations[0]?.id)[0]?.id ?? 0,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const role = roleFor(audience);
  const adminPicksTarget = !role && me.isAdmin;
  const target =
    audience === "national"
      ? "all MSAK members"
      : audience === "alumni"
        ? "all alumni members"
      : audience === "regional"
        ? `members of ${lookup.association(role ? role.association_id : assocId)?.code ?? "the association"}`
        : `members at ${lookup.institution(role ? role.institution_id : instId)?.name ?? "the institution"}`;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      await api.postAnnouncement({
        audience,
        title: String(f.get("title") ?? ""),
        body: String(f.get("body") ?? ""),
        association_id: adminPicksTarget && audience === "regional" ? assocId : null,
        institution_id: adminPicksTarget && audience === "institutional" ? instId : null,
      });
      form.reset();
      setDone(true);
      onPosted();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <fieldset>
        <legend className="field-label">Post to</legend>
        <div className="flex flex-wrap gap-2">
          {audiences.map((a) => (
            <label key={a} className={`btn btn-sm ${audience === a ? "btn-primary" : "btn-outline"}`}>
              <input type="radio" name="audience" className="sr-only" checked={audience === a} onChange={() => setAudience(a)} />
              {audienceLabel[a]}
            </label>
          ))}
        </div>
      </fieldset>
      {adminPicksTarget && audience === "regional" && (
        <SelectInput label="Association" value={assocId} onChange={(e) => setAssocId(Number(e.target.value))}>
          {lookup.associations.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code} — {a.name}
            </option>
          ))}
        </SelectInput>
      )}
      {adminPicksTarget && audience === "institutional" && (
        <SelectInput label="Institution" value={instId} onChange={(e) => setInstId(Number(e.target.value))}>
          {lookup.associations.map((a) => (
            <optgroup key={a.id} label={a.code}>
              {lookup.institutionsInAssociation(a.id).map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </optgroup>
          ))}
        </SelectInput>
      )}
      <p className="rounded-md bg-gold-50 px-3 py-2 text-[13px] text-gold-800">
        Goes live immediately to <strong>{target}</strong>.
      </p>
      <TextInput label="Title" name="title" required minLength={3} maxLength={160} placeholder="e.g. Friday fellowship — venue change" />
      <TextArea label="Message" name="body" required maxLength={5000} rows={5} placeholder="Dates, venue, contacts…" />
      {error && <Alert tone="error">{error}</Alert>}
      {done && <Alert tone="success">Posted.</Alert>}
      <div className="flex justify-end">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Posting…" : "Post announcement"}
        </button>
      </div>
    </form>
  );
}
