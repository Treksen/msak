import type { HomeBanner } from "./types";

const TZ = "Africa/Nairobi";
const DAY = 86_400_000;

/** When a banner stops showing: its end time, or one day after the start if no end is set. */
export function bannerEnd(b: Pick<HomeBanner, "starts_at" | "ends_at">): number {
  return b.ends_at ? new Date(b.ends_at).getTime() : new Date(b.starts_at).getTime() + DAY;
}

/** Is this banner showing right now? Same rule as the database policy. */
export function isBannerLive(b: HomeBanner, now = Date.now()): boolean {
  return b.is_active && bannerEnd(b) > now;
}

/** "26–28 February 2027", "28 Feb – 2 Mar 2027" or "26 February 2027" (Kenya time). */
export function formatEventDates(startIso: string, endIso: string | null): string {
  const start = new Date(startIso);
  const part = (d: Date, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone: TZ, ...o }).format(d);
  const sd = part(start, { day: "numeric" });
  const sm = part(start, { month: "long" });
  const sy = part(start, { year: "numeric" });
  if (!endIso) return `${sd} ${sm} ${sy}`;
  const end = new Date(endIso);
  const ed = part(end, { day: "numeric" });
  const em = part(end, { month: "long" });
  const ey = part(end, { year: "numeric" });
  if (sd === ed && sm === em && sy === ey) return `${sd} ${sm} ${sy}`;
  if (sm === em && sy === ey) return `${sd}–${ed} ${sm} ${sy}`;
  if (sy === ey) return `${sd} ${sm.slice(0, 3)} – ${ed} ${em.slice(0, 3)} ${sy}`;
  return `${sd} ${sm.slice(0, 3)} ${sy} – ${ed} ${em.slice(0, 3)} ${ey}`;
}

/** Banner status for the admin list. */
export function bannerStatus(b: HomeBanner, now = Date.now()): "Live" | "Scheduled" | "Hidden" | "Ended" {
  if (bannerEnd(b) <= now) return "Ended";
  if (!b.is_active) return "Hidden";
  return new Date(b.starts_at).getTime() > now ? "Scheduled" : "Live";
}

/** ISO string → value for <input type="datetime-local"> in Kenya time (UTC+3, no daylight saving). */
export function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : new Date(d.getTime() + 3 * 3_600_000).toISOString().slice(0, 16);
}

/** <input type="datetime-local"> value, read as Kenya time (UTC+3, no daylight saving) → ISO string. */
export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(`${value}:00+03:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
