import type { LeaderRole, Profile } from "./types";

/**
 * The academic year ends on 31 August (Kenya time).
 * - Leader roles expire then and must be renewed (and re-approved).
 * - Members become alumni after 31 August of their expected completion year.
 */

/** Today's date in Kenya as "YYYY-MM-DD". */
export function kenyaToday(): string {
  return new Date(Date.now() + 3 * 3_600_000).toISOString().slice(0, 10);
}

/** 31 August on or after the given date ("YYYY-MM-DD"). */
export function academicYearEnd(day: string = kenyaToday()): string {
  const y = Number(day.slice(0, 4));
  return day <= `${y}-08-31` ? `${y}-08-31` : `${y + 1}-08-31`;
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function isAlumni(p: Pick<Profile, "expected_completion_year"> | null | undefined): boolean {
  return !!p && kenyaToday() > `${p.expected_completion_year}-08-31`;
}

/** Approved and within its term. */
export function isRoleActive(r: LeaderRole): boolean {
  return r.status === "approved" && (!r.term_ends_on || r.term_ends_on >= kenyaToday());
}

export type RoleState = "pending" | "active" | "renewal" | "expired" | "rejected" | "revoked";

export function roleState(r: LeaderRole): RoleState {
  if (r.status === "pending") return "pending";
  if (r.status === "rejected") return "rejected";
  if (r.status === "revoked") return "revoked";
  if (r.renewal_requested_at) return "renewal";
  return isRoleActive(r) ? "active" : "expired";
}

/** Renewal opens from 1 July, and stays open after a role expires. */
export function canRenew(r: LeaderRole): boolean {
  if (r.status !== "approved" || r.renewal_requested_at) return false;
  if (!isRoleActive(r)) return true;
  return !!r.term_ends_on && kenyaToday() >= addDays(r.term_ends_on, -61);
}

export function formatDay(day: string | null): string {
  if (!day) return "";
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}
