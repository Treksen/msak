import { useMemo, useState, type ReactNode } from "react";
import { Crosshair, Flag, Mail, MapPin, Navigation, Pencil, Phone, Plus, Search, Share2, X, Clock, ShieldCheck } from "lucide-react";
import { formatDate } from "../lib/format";
import type { Church } from "../lib/types";
import type { Lookup } from "../lib/directory";
import { directionsUrl, distanceKm, formatKm, getCurrentPosition, type LatLng } from "../lib/geo";
import { ChurchMap } from "./ChurchMap";
import { Alert, EmptyState, StatusBadge } from "./ui";

type Props = {
  churches: Church[];
  lookup: Lookup;
  /** Shown above the filters (page title etc.). */
  header?: ReactNode;
  onAdd?: () => void;
  addLabel?: string;
  canEdit?: (c: Church) => boolean;
  onEdit?: (c: Church) => void;
  /** Signed-in members can tell leaders a church's details are wrong. */
  onReport?: (c: Church) => void;
};

/** List + map + filters + "Near me". Used on the public page and inside the portal. */
export function ChurchFinder({ churches, lookup, header, onAdd, addLabel = "Add a church", canEdit, onEdit, onReport }: Props) {
  const [assoc, setAssoc] = useState<number | "all">("all");
  const [query, setQuery] = useState("");
  const [me, setMe] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const m = new Map<number, number>();
    churches.filter((c) => c.status === "published").forEach((c) => m.set(c.association_id, (m.get(c.association_id) ?? 0) + 1));
    return m;
  }, [churches]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = churches.filter(
      (c) =>
        (assoc === "all" || c.association_id === assoc) &&
        (!q || `${c.name} ${c.fellowship} ${c.place} ${lookup.county(c.county_id)?.name ?? ""}`.toLowerCase().includes(q)),
    );
    const withDist = rows.map((c) => ({ c, d: me ? distanceKm(me, c) : null }));
    if (me) withDist.sort((a, b) => (a.d ?? 0) - (b.d ?? 0));
    else withDist.sort((a, b) => Number(a.c.status !== "published") - Number(b.c.status !== "published") || a.c.name.localeCompare(b.c.name));
    return withDist;
  }, [churches, assoc, query, me, lookup]);

  const selected = list.find((x) => x.c.id === selectedId) ?? null;
  const assocName = assoc === "all" ? "Kenya" : lookup.association(assoc)?.code ?? "";
  const fitKey = `${assoc}|${query}|${me ? "me" : ""}|${list.length}`;

  async function nearMe() {
    if (me) {
      setMe(null);
      return;
    }
    setLocating(true);
    setLocError(null);
    try {
      const p = await getCurrentPosition();
      setMe({ lat: p.lat, lng: p.lng });
      setAssoc("all");
    } catch (e) {
      setLocError(e instanceof Error ? e.message : "Couldn't get your location.");
    } finally {
      setLocating(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {header}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3.5 top-3.5 size-[18px] text-muted" aria-hidden="true" />
          <label htmlFor="church-search" className="sr-only">
            Search churches
          </label>
          <input
            id="church-search"
            type="search"
            className="input pl-10"
            placeholder="Search church, town or area"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button type="button" onClick={nearMe} className={`btn ${me ? "btn-primary" : "btn-outline"}`} aria-pressed={!!me} disabled={locating}>
          <Crosshair className="size-[18px]" aria-hidden="true" />
          {locating ? "Finding you…" : me ? "Near me · on" : "Near me"}
        </button>
        {onAdd && (
          <button type="button" onClick={onAdd} className="btn btn-gold">
            <Plus className="size-[18px]" aria-hidden="true" />
            {addLabel}
          </button>
        )}
      </div>

      <div role="group" aria-label="Filter by association" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        <Chip active={assoc === "all"} onClick={() => setAssoc("all")}>
          All
        </Chip>
        {lookup.associations.map((a) => (
          <Chip key={a.id} active={assoc === a.id} onClick={() => setAssoc(a.id)}>
            {a.code}
            <span className="ml-1 opacity-70">{counts.get(a.id) ?? 0}</span>
          </Chip>
        ))}
      </div>

      {locError && <Alert tone="warn">{locError}</Alert>}

      <div className="grid gap-4 lg:grid-cols-[minmax(320px,420px)_1fr]">
        <div role="region" aria-label="Church map" className="relative order-1 h-[46vh] min-h-[300px] overflow-hidden rounded-lg border border-line bg-navy-900 lg:order-2 lg:h-[680px]">
          <ChurchMap churches={list.map((x) => x.c)} selectedId={selectedId} onSelect={setSelectedId} me={me} fitKey={fitKey} />
          {selected && (
            <div className="absolute inset-x-3 bottom-3 z-[500] hidden lg:block">
              <ChurchDetail
                church={selected.c}
                distance={selected.d}
                lookup={lookup}
                onClose={() => setSelectedId(null)}
                onEdit={canEdit?.(selected.c) ? () => onEdit?.(selected.c) : undefined}
                onReport={onReport && selected.c.status === "published" ? () => onReport(selected.c) : undefined}
              />
            </div>
          )}
        </div>

        <section aria-label="Church list" className="order-2 flex flex-col gap-2 lg:order-1 lg:max-h-[680px] lg:overflow-y-auto lg:pr-1">
          <p className="text-sm text-muted" aria-live="polite">
            {list.length} {list.length === 1 ? "church" : "churches"}
            {me ? " · nearest first" : ` in ${assocName}`}
          </p>
          {selected && (
            <div className="lg:hidden">
              <ChurchDetail
                church={selected.c}
                distance={selected.d}
                lookup={lookup}
                onClose={() => setSelectedId(null)}
                onEdit={canEdit?.(selected.c) ? () => onEdit?.(selected.c) : undefined}
                onReport={onReport && selected.c.status === "published" ? () => onReport(selected.c) : undefined}
              />
            </div>
          )}
          {list.map(({ c, d }) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedId(c.id)}
              aria-pressed={c.id === selectedId}
              className={`flex w-full items-start gap-3 rounded-lg bg-white px-4 py-3.5 text-left ${
                c.id === selectedId ? "border-2 border-gold-500" : "border border-line hover:border-line-strong"
              }`}
            >
              <span aria-hidden="true" className="flex size-9 flex-none items-center justify-center rounded-full bg-navy-900 font-serif text-[15px] font-bold text-gold-300">
                {c.name.replace(/^Mt\.? Zion /, "Z").charAt(0)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="font-bold text-navy-900">{c.name}</span>
                  {d != null && <span className="whitespace-nowrap text-[13px] font-semibold text-gold-700">{formatKm(d)}</span>}
                </span>
                <span className="block text-sm text-body">{c.fellowship}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-2 text-[13px] text-muted">
                  {c.place} · {lookup.association(c.association_id)?.code}
                  {c.status !== "published" && <StatusBadge status={c.status} />}
                </span>
              </span>
            </button>
          ))}
          {list.length === 0 && (
            <EmptyState title={`No churches mapped in ${assocName} yet`}>
              Leaders in this association can visit a church, drop its pin on site and add it here. Members can suggest one for a leader to
              confirm.
            </EmptyState>
          )}
        </section>
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex-none rounded-full border px-3.5 py-2 text-[13px] font-semibold tracking-wide ${
        active ? "border-navy-900 bg-navy-900 text-white" : "border-line-strong bg-white text-ink hover:border-navy-900"
      }`}
    >
      {children}
    </button>
  );
}

export function ChurchDetail({
  church,
  distance,
  lookup,
  onClose,
  onEdit,
  onReport,
}: {
  church: Church;
  distance: number | null;
  lookup: Lookup;
  onClose: () => void;
  onEdit?: () => void;
  onReport?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  async function share() {
    const text = `${church.name} — ${church.fellowship}, ${church.place}`;
    const url = directionsUrl(church);
    try {
      if (navigator.share) await navigator.share({ title: church.name, text, url });
      else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      /* user cancelled */
    }
  }
  return (
    <article className="rounded-lg border-t-[3px] border-gold-500 bg-white p-5 shadow-[0_12px_32px_rgba(7,21,54,0.25)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-serif text-2xl font-semibold text-navy-900">{church.name}</h3>
          <p className="text-sm text-body">{church.fellowship}</p>
        </div>
        <button type="button" onClick={onClose} className="btn btn-ghost btn-sm" aria-label="Close details">
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>
      {church.photo_url && (
        <img src={church.photo_url} alt={`${church.name} building`} loading="lazy" className="mt-3 h-40 w-full rounded-md object-cover" />
      )}
      <ul className="mt-3 space-y-2 text-sm text-body">
        <li className="flex gap-2">
          <MapPin className="mt-0.5 size-4 flex-none text-gold-700" aria-hidden="true" />
          <span>
            {church.place}
            {lookup.county(church.county_id) ? `, ${lookup.county(church.county_id)!.name}` : ""} · {lookup.association(church.association_id)?.code}
            {distance != null && <strong className="ml-1 text-gold-700">· {formatKm(distance)} away</strong>}
          </span>
        </li>
        <li className="flex gap-2">
          <Clock className="mt-0.5 size-4 flex-none text-gold-700" aria-hidden="true" />
          <span>{church.service_times || "Sabbath service times not added yet"}</span>
        </li>
        <li className="flex gap-2">
          <Phone className="mt-0.5 size-4 flex-none text-gold-700" aria-hidden="true" />
          <span>
            {church.phone ? (
              <a href={`tel:${church.phone.replace(/\s/g, "")}`}>{church.phone}</a>
            ) : (
              "Contact to be confirmed by a leader"
            )}
            {church.contact_person ? ` · ${church.contact_person}` : ""}
          </span>
        </li>
        {church.email && (
          <li className="flex gap-2">
            <Mail className="mt-0.5 size-4 flex-none text-gold-700" aria-hidden="true" />
            <a href={`mailto:${church.email}`} className="break-all">
              {church.email}
            </a>
          </li>
        )}
        <li className="flex gap-2 text-[13px] text-muted">
          <ShieldCheck className="mt-0.5 size-4 flex-none" aria-hidden="true" />
          {church.location_verified
            ? `Pin confirmed on site by a leader${church.verified_at ? ` · ${formatDate(church.verified_at)}` : ""}`
            : "Pin position not yet confirmed on site"}
        </li>
      </ul>
      {church.notes && church.status !== "published" && <p className="mt-3 rounded-md bg-gold-50 p-3 text-[13px] text-gold-800">{church.notes}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <a className="btn btn-primary btn-sm" href={church.maps_url || directionsUrl(church)} target="_blank" rel="noreferrer">
          <Navigation className="size-4" aria-hidden="true" />
          Directions
        </a>
        {church.phone && (
          <a className="btn btn-outline btn-sm" href={`tel:${church.phone.replace(/\s/g, "")}`}>
            <Phone className="size-4" aria-hidden="true" />
            Call
          </a>
        )}
        <button type="button" className="btn btn-outline btn-sm" onClick={share}>
          <Share2 className="size-4" aria-hidden="true" />
          {copied ? "Copied" : "Share"}
        </button>
        {onEdit && (
          <button type="button" className="btn btn-gold btn-sm" onClick={onEdit}>
            <Pencil className="size-4" aria-hidden="true" />
            {church.status === "suggested" ? "Review" : "Edit"}
          </button>
        )}
        {onReport && !onEdit && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onReport}>
            <Flag className="size-4" aria-hidden="true" />
            Report wrong info
          </button>
        )}
      </div>
    </article>
  );
}
