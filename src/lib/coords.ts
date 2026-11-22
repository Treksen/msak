import type { LatLng } from "./geo";

/**
 * Read a position from what a leader pastes:
 *  - coordinates: "-1.1023, 37.0145" or "-1.1023 37.0145"
 *  - a full Google Maps address: ".../@-1.1023,37.0145,17z", "...!3d-1.1023!4d37.0145", "?q=-1.10,37.01", "ll=", "query=", "destination="
 *  - an OpenStreetMap address: "#map=17/-1.1023/37.0145" or "?mlat=..&mlon=.."
 * Short links (maps.app.goo.gl) don't contain the position — open them first and copy the long address.
 */
export type ParsedPosition = { ok: true; point: LatLng } | { ok: false; reason: string };

const inKenyaArea = (p: LatLng) => p.lat >= -5.5 && p.lat <= 5.5 && p.lng >= 33.5 && p.lng <= 42.5;

export function parsePosition(text: string): ParsedPosition {
  const t = text.trim();
  if (!t) return { ok: false, reason: "Paste coordinates or a Google Maps link." };
  if (/goo\.gl\/|maps\.app\.goo\.gl/i.test(t)) {
    return {
      ok: false,
      reason: "Short Google links don't include the position. Open the link in your browser, then copy the long address from the address bar and paste that.",
    };
  }
  const num = String.raw`(-?\d{1,2}(?:\.\d+)?)`;
  const patterns: RegExp[] = [
    new RegExp(String.raw`!3d${num}!4d(-?\d{1,3}(?:\.\d+)?)`), // place pin (most precise)
    new RegExp(String.raw`@${num},\s*(-?\d{1,3}(?:\.\d+)?)`), // map centre
    new RegExp(String.raw`[?&](?:q|ll|query|destination|center)=${num},\s*(-?\d{1,3}(?:\.\d+)?)`),
    new RegExp(String.raw`map=\d+(?:\.\d+)?/${num}/(-?\d{1,3}(?:\.\d+)?)`), // OSM
    new RegExp(String.raw`mlat=${num}&mlon=(-?\d{1,3}(?:\.\d+)?)`), // OSM marker
    new RegExp(String.raw`^${num}\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)$`), // plain "lat, lng"
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m) {
      const p = { lat: Number(m[1]), lng: Number(m[2]) };
      if (Number.isFinite(p.lat) && Number.isFinite(p.lng)) {
        if (!inKenyaArea(p)) {
          const swapped = { lat: p.lng, lng: p.lat };
          if (inKenyaArea(swapped)) return { ok: true, point: swapped };
          return { ok: false, reason: "That position isn't in Kenya. Check the numbers (latitude first, e.g. -1.10, 37.01)." };
        }
        return { ok: true, point: p };
      }
    }
  }
  return { ok: false, reason: "Couldn't find a position in that text. Paste coordinates like -1.1023, 37.0145 or a full Google Maps link." };
}
