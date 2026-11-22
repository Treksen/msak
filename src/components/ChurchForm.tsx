import { useState, type FormEvent } from "react";
import { Camera, ClipboardPaste, Crosshair, Trash2, X } from "lucide-react";
import type { Church, ChurchInput, ChurchStatus } from "../lib/types";
import type { Lookup } from "../lib/directory";
import { getCurrentPosition, type LatLng } from "../lib/geo";
import { api, errorMessage } from "../lib/api";
import { PinPicker } from "./ChurchMap";
import { parsePosition } from "../lib/coords";
import { resizeImage } from "../lib/image";
import { Alert, SelectInput, TextArea, TextInput } from "./ui";

type Props = {
  lookup: Lookup;
  /** Associations where the user can publish directly (empty → can only suggest). */
  manageable: number[];
  defaultAssociationId: number | null;
  church?: Church | null;
  onDone: () => void;
};

/**
 * Add or edit a church. Leaders standing at the church tap "Use my location" to drop
 * the pin exactly where they are, then confirm the details. Members' entries become
 * suggestions for a leader to confirm.
 */
export function ChurchForm({ lookup, manageable, defaultAssociationId, church, onDone }: Props) {
  const editing = !!church;
  const [associationId, setAssociationId] = useState<number>(
    church?.association_id ?? defaultAssociationId ?? manageable[0] ?? lookup.associations[0]?.id ?? 1,
  );
  const isManager = manageable.includes(associationId);
  const [countyId, setCountyId] = useState<number | null>(church?.county_id ?? null);
  const [pin, setPin] = useState<LatLng | null>(church ? { lat: church.lat, lng: church.lng } : null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [verified, setVerified] = useState<boolean>(church?.location_verified ?? false);
  const [status, setStatus] = useState<ChurchStatus>(church?.status === "suggested" ? "published" : church?.status ?? "published");
  const [locating, setLocating] = useState(false);
  const [pasted, setPasted] = useState("");
  const [pasteMsg, setPasteMsg] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(church?.photo_url ?? null);
  const [uploading, setUploading] = useState(false);

  function placePasted() {
    const r = parsePosition(pasted);
    if (r.ok) {
      setPin(r.point);
      setAccuracy(null);
      setPasteMsg(`Pin placed at ${r.point.lat.toFixed(5)}, ${r.point.lng.toFixed(5)}.`);
    } else {
      setPasteMsg(r.reason);
    }
  }

  async function choosePhoto(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const blob = await resizeImage(file);
      setPhotoUrl(await api.uploadChurchPhoto(blob, associationId));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setUploading(false);
    }
  }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function useMyLocation() {
    setLocating(true);
    setError(null);
    try {
      const p = await getCurrentPosition();
      setPin({ lat: p.lat, lng: p.lng });
      setAccuracy(p.accuracy);
      if (isManager) setVerified(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLocating(false);
    }
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const text = (k: string) => {
      const v = String(f.get(k) ?? "").trim();
      return v === "" ? null : v;
    };
    if (!pin) {
      setError("Place the pin: tap “Use my location” at the church, or tap the map.");
      return;
    }
    const input: ChurchInput = {
      name: text("name") ?? "",
      fellowship: text("fellowship") ?? "",
      association_id: associationId,
      county_id: countyId,
      place: text("place") ?? "",
      lat: Number(pin.lat.toFixed(6)),
      lng: Number(pin.lng.toFixed(6)),
      location_verified: isManager ? verified : false,
      phone: text("phone"),
      email: text("email"),
      contact_person: text("contact_person"),
      service_times: text("service_times"),
      maps_url: text("maps_url"),
      photo_url: isManager ? photoUrl : church?.photo_url ?? null,
      notes: text("notes"),
      status: isManager ? status : "suggested",
    };
    if (input.name.length < 2 || input.fellowship.length < 2 || input.place.length < 2) {
      setError("Fill in the church name, fellowship and area.");
      return;
    }
    if (input.maps_url && !/^https:\/\//i.test(input.maps_url)) {
      setError("The map link must start with https://");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.saveChurch(input, church?.id);
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!church || !confirm(`Remove ${church.name} from the map?`)) return;
    setBusy(true);
    try {
      await api.deleteChurch(church.id);
      onDone();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      {!isManager && (
        <Alert tone="info">
          You're suggesting a church. A leader in {lookup.association(associationId)?.code ?? "this association"} will visit, confirm the pin and
          publish it.
        </Alert>
      )}

      <section aria-labelledby="pin-h" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="pin-h" className="font-semibold text-navy-900">
            1. Pin the location
          </h3>
          <button type="button" onClick={useMyLocation} className="btn btn-primary btn-sm" disabled={locating}>
            <Crosshair className="size-4" aria-hidden="true" />
            {locating ? "Finding you…" : "Use my location"}
          </button>
        </div>
        <p className="text-sm text-muted">Standing at the church? Use your location. Otherwise tap the map, then drag the pin to the exact spot.</p>
        <PinPicker value={pin} onChange={(p) => { setPin(p); setAccuracy(null); }} />
        <div className="flex flex-col gap-2 rounded-md border border-line bg-paper p-3">
          <label htmlFor="paste-pos" className="text-sm font-semibold text-navy-900">
            Or paste coordinates / a Google Maps link
          </label>
          <div className="flex gap-2">
            <input
              id="paste-pos"
              className="input"
              value={pasted}
              onChange={(e) => {
                setPasted(e.target.value);
                setPasteMsg(null);
              }}
              placeholder="-1.1023, 37.0145  or  https://www.google.com/maps/…"
              inputMode="text"
              autoComplete="off"
            />
            <button type="button" className="btn btn-outline flex-none" onClick={placePasted} disabled={!pasted.trim()}>
              <ClipboardPaste className="size-4" aria-hidden="true" />
              Place pin
            </button>
          </div>
          {pasteMsg && (
            <p className="text-[13px] text-body" aria-live="polite">
              {pasteMsg}
            </p>
          )}
        </div>
        <p className="text-[13px] text-muted" aria-live="polite">
          {pin ? `Pin: ${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}` : "No pin yet."}
          {accuracy != null && ` · accurate to about ${Math.round(accuracy)} m`}
        </p>
        {isManager && (
          <label className="flex items-start gap-3 rounded-md border border-line bg-paper p-3 text-sm">
            <input type="checkbox" className="mt-0.5 size-5 accent-[#0B1F4D]" checked={verified} onChange={(e) => setVerified(e.target.checked)} />
            <span>
              <strong className="text-navy-900">I've confirmed this pin on site.</strong>
              <span className="block text-muted">Members see that the location was checked by a leader.</span>
            </span>
          </label>
        )}
      </section>

      {isManager && (
        <section aria-labelledby="photo-h" className="flex flex-col gap-3">
          <h3 id="photo-h" className="font-semibold text-navy-900">
            Photo (optional)
          </h3>
          {photoUrl ? (
            <div className="relative overflow-hidden rounded-md border border-line">
              <img src={photoUrl} alt="Church" className="h-48 w-full object-cover" />
              <button
                type="button"
                onClick={() => setPhotoUrl(null)}
                className="absolute right-2 top-2 flex size-9 items-center justify-center rounded-full bg-white/90 text-navy-900 shadow"
                aria-label="Remove photo"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-line-strong bg-paper px-4 py-6 text-sm font-semibold text-navy-900">
              <Camera className="size-5 text-gold-700" aria-hidden="true" />
              {uploading ? "Uploading…" : "Take or choose a photo of the church"}
              <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={uploading} onChange={(e) => void choosePhoto(e.target.files?.[0])} />
            </label>
          )}
          <p className="text-[13px] text-muted">The outside of the building helps visitors recognise it. Photos are resized on your phone before upload.</p>
        </section>
      )}

      <section aria-labelledby="det-h" className="grid gap-4 sm:grid-cols-2">
        <h3 id="det-h" className="font-semibold text-navy-900 sm:col-span-2">
          2. Church details
        </h3>
        <TextInput label="Local church name" name="name" defaultValue={church?.name} placeholder="e.g. Juja" required maxLength={120} />
        <TextInput
          label="Fellowship / denomination"
          name="fellowship"
          defaultValue={church?.fellowship}
          placeholder="e.g. Mt. Zion Seventh Day Church of God"
          required
          maxLength={160}
        />
        <SelectInput
          label="Association"
          value={associationId}
          onChange={(e) => {
            setAssociationId(Number(e.target.value));
            setCountyId(null);
          }}
        >
          {lookup.associations.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code} — {a.name}
            </option>
          ))}
        </SelectInput>
        <SelectInput label="County" value={countyId ?? ""} onChange={(e) => setCountyId(e.target.value ? Number(e.target.value) : null)}>
          <option value="">Choose county</option>
          {lookup.countiesOf(associationId).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectInput>
        <div className="sm:col-span-2">
          <TextInput
            label="Area / directions"
            name="place"
            defaultValue={church?.place}
            placeholder="e.g. Muchatha, Juja Town — behind the market"
            required
            maxLength={200}
          />
        </div>
        <TextInput label="Sabbath service times" name="service_times" defaultValue={church?.service_times ?? ""} placeholder="e.g. Sabbath 9:00 am – 4:00 pm" maxLength={300} />
        <TextInput label="Contact person" name="contact_person" defaultValue={church?.contact_person ?? ""} maxLength={120} />
        <TextInput label="Phone" name="phone" type="tel" inputMode="tel" defaultValue={church?.phone ?? ""} placeholder="07XX XXX XXX" />
        <TextInput label="Email" name="email" type="email" defaultValue={church?.email ?? ""} />
        <div className="sm:col-span-2">
          <TextInput
            label="Google Maps link (optional)"
            name="maps_url"
            type="url"
            defaultValue={church?.maps_url ?? ""}
            placeholder="https://maps.app.goo.gl/…"
            hint="If left empty, Directions uses the pin."
          />
        </div>
        <div className="sm:col-span-2">
          <TextArea label="Notes" name="notes" defaultValue={church?.notes ?? ""} rows={3} maxLength={1000} hint="Landmarks, parking, anything that helps a visitor." />
        </div>
      </section>

      {isManager && editing && (
        <SelectInput label="Status" value={status} onChange={(e) => setStatus(e.target.value as ChurchStatus)}>
          <option value="published">Published — visible on the public map</option>
          <option value="suggested">Suggestion — hidden until confirmed</option>
          <option value="rejected">Rejected — not a church we list</option>
        </SelectInput>
      )}

      {error && <Alert tone="error">{error}</Alert>}

      <div className="flex flex-wrap justify-between gap-2 border-t border-line pt-4">
        {editing && isManager ? (
          <button type="button" onClick={remove} className="btn btn-danger" disabled={busy}>
            <Trash2 className="size-4" aria-hidden="true" />
            Remove
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <button type="button" onClick={onDone} className="btn btn-outline" disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || uploading}>
            {busy ? "Saving…" : !isManager ? "Send suggestion" : editing ? "Save changes" : "Publish church"}
          </button>
        </div>
      </div>
    </form>
  );
}
