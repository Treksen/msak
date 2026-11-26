import type { Api } from "./api";
import { isBannerLive } from "./banners";
import { academicYearEnd, addDays, isAlumni, isRoleActive, kenyaToday, roleState } from "./academic";
import type {
  Announcement,
  Church,
  ChurchReport,
  PastRole,
  PublicPastLeader,
  AdminDashboard,
  AuditEntry,
  ErrorEntry,
  DemoPersona,
  Directory,
  DocumentItem,
  FeedbackItem,
  HomeBanner,
  LeaderLevel,
  LeaderRole,
  Profile,
} from "./types";
import directoryJson from "../data/directory.json";
import churchSeed from "../data/churches.seed.json";

/**
 * DEMO MODE — runs entirely in the browser and saves to localStorage.
 * It follows the same permission rules as the database (supabase/01_schema.sql)
 * so you can preview every role before connecting Supabase.
 */

const KEY = "msak-demo-v9";
const directory = directoryJson as Directory;

type DemoUser = { id: string; email: string; password: string };
type StoredDoc = DocumentItem & { dataUrl?: string };
type State = {
  users: DemoUser[];
  profiles: Profile[];
  roles: LeaderRole[];
  admins: string[];
  announcements: Announcement[];
  churches: Church[];
  documents: StoredDoc[];
  feedback: FeedbackItem[];
  banners: HomeBanner[];
  reports?: ChurchReport[];
  audit?: AuditEntry[];
  pastRoles?: PastRole[];
  settings?: { past_leaders_public?: boolean };
  errors?: ErrorEntry[];
  session: string | null;
};

const now = () => new Date().toISOString();
const ago = (hours: number) => new Date(Date.now() - hours * 3600_000).toISOString();
const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2)}${Date.now()}`;

function instByName(prefix: string): number {
  const found = directory.institutions.find((i) => i.name.toLowerCase().startsWith(prefix.toLowerCase()));
  return found ? found.id : directory.institutions[0].id;
}
function assocOf(institutionId: number | null | undefined): number | null {
  const inst = directory.institutions.find((i) => i.id === institutionId);
  const county = inst && directory.counties.find((c) => c.id === inst.county_id);
  return county ? county.association_id : null;
}
function assocId(code: string): number {
  return directory.associations.find((a) => a.code === code)!.id;
}

function seed(): State {
  const jkuat = instByName("Jomo Kenyatta");
  const ku = instByName("Kenyatta University");
  const westInst = directory.institutions.find((i) => assocOf(i.id) === assocId("WEMSA"))!.id;
  const nyeriInst = directory.institutions.find((i) => assocOf(i.id) === assocId("CEMSA"))!.id;
  const namsa = assocId("NAMSA");

  const person = (id: string, full_name: string, gender: "Male" | "Female", institution_id: number, year = 3): Profile => ({
    id,
    full_name,
    gender,
    phone: "0700 000 000",
    institution_id,
    course: "Bachelor's degree",
    admission_year: 2023,
    year_of_study: year,
    expected_completion_year: 2027,
    terms_accepted_at: ago(2000),
    created_at: ago(2000),
    verification: "verified",
    verified_at: ago(1900),
    verification_note: null,
  });
  const role = (
    user_id: string,
    level: LeaderLevel,
    position: string,
    institution_id: number | null,
    status: LeaderRole["status"],
  ): LeaderRole => ({
    id: newId(),
    user_id,
    level,
    position,
    association_id: level === "national" ? null : assocOf(institution_id),
    institution_id: level === "institutional" ? institution_id : null,
    status,
    requested_at: ago(48),
    reviewed_at: status === "pending" ? null : ago(24),
    review_note: null,
    term_ends_on: status === "approved" ? academicYearEnd() : null,
    renewal_requested_at: null,
  });

  const users: DemoUser[] = [
    { id: "demo-member", email: "member@demo.msak", password: "demo1234" },
    { id: "demo-institutional", email: "campus@demo.msak", password: "demo1234" },
    { id: "demo-regional", email: "region@demo.msak", password: "demo1234" },
    { id: "demo-national", email: "national@demo.msak", password: "demo1234" },
    { id: "demo-admin", email: "admin@demo.msak", password: "demo1234" },
    { id: "demo-applicant-1", email: "a1@demo.msak", password: "demo1234" },
    { id: "demo-applicant-2", email: "a2@demo.msak", password: "demo1234" },
    { id: "demo-alumnus", email: "alumni@demo.msak", password: "demo1234" },
    { id: "demo-newcomer", email: "new@demo.msak", password: "demo1234" },
  ];
  const profiles = [
    person("demo-member", "Moses Mwangi", "Male", jkuat, 1),
    person("demo-institutional", "Ivy Wanjiku", "Female", jkuat, 2),
    person("demo-regional", "Rafael Otieno", "Male", ku, 4),
    person("demo-national", "Wanjiru Achieng", "Female", westInst, 3),
    person("demo-applicant-1", "Kevin Kiprono", "Male", ku, 2),
    person("demo-applicant-2", "Grace Muthoni", "Female", nyeriInst, 3),
    { ...person("demo-alumnus", "Peter Kamau", "Male", ku, 4), admission_year: 2018, expected_completion_year: 2022 },
    // a first-year who just joined: waiting for a JKUAT or NAMSA leader to confirm them
    { ...person("demo-newcomer", "Brian Odhiambo", "Male", jkuat, 1), admission_year: 2026, expected_completion_year: 2030, verification: "pending" as const, verified_at: null },
  ].map((p, i) => ({ ...p, created_at: ago(24 * (330 - i * 52)) })); // joined over the past year, for the dashboard chart
  const roles = [
    role("demo-institutional", "institutional", "Secretary", jkuat, "approved"),
    role("demo-regional", "regional", "Chairperson", ku, "approved"),
    role("demo-national", "national", "Organising Secretary", westInst, "approved"),
    role("demo-applicant-1", "institutional", "Chairperson", ku, "pending"),
    role("demo-applicant-2", "regional", "Treasurer", nyeriInst, "pending"),
  ];
  const announcements: Announcement[] = [
    {
      id: newId(), author_id: "demo-institutional", author_name: "Ivy Wanjiku",
      author_title: "Institutional leader · Secretary · NAMSA", audience: "institutional",
      association_id: namsa, institution_id: jkuat, title: "Friday evening fellowship — venue change",
      body: "We meet in the new hall this week. Bring a friend.", created_at: ago(2),
    },
    {
      id: newId(), author_id: "demo-regional", author_name: "Rafael Otieno",
      author_title: "Regional leader · Chairperson · NAMSA", audience: "regional",
      association_id: namsa, institution_id: null, title: "Regional rally — registration is open",
      body: "Register through the portal before the deadline. Details are in Documents.", created_at: ago(26),
    },
    {
      id: newId(), author_id: "demo-admin", author_name: "MSAK", author_title: "MSAK National Office",
      audience: "national", association_id: null, institution_id: null, title: "Welcome to the new MSAK portal",
      body: "Announcements from your campus, your association and the national office now arrive in one place. Add the portal to your home screen to open it like an app.",
      created_at: ago(72),
    },
  ];
  const churches: Church[] = (churchSeed as Omit<Church, "id" | "status" | "location_verified" | "contact_person" | "service_times" | "photo_url" | "created_by" | "created_by_name" | "verified_at" | "created_at" | "updated_at">[]).map(
    (c) => ({
      ...c,
      id: newId(),
      status: "published",
      location_verified: false,
      contact_person: null,
      service_times: null,
      photo_url: null,
      created_by: null,
      created_by_name: "Imported",
      verified_at: ago(500),
      created_at: ago(500),
      updated_at: ago(500),
    }),
  );
  churches.push({
    ...churches[0],
    id: newId(),
    name: "Githurai 45",
    fellowship: "Seventh Day Church of God",
    place: "Githurai 45, near the stage",
    lat: -1.205,
    lng: 36.912,
    phone: null,
    email: null,
    maps_url: null,
    notes: "Suggested by a member — needs a leader visit.",
    status: "suggested",
    created_by: "demo-member",
    created_by_name: "Moses Mwangi",
    verified_at: null,
  });

  return {
    users,
    profiles,
    roles,
    admins: ["demo-admin"],
    announcements,
    churches,
    documents: [],
    feedback: [],
    pastRoles: [
      { id: "past-1", user_id: "demo-alumnus", level: "regional", association_id: directory.associations.find((x) => x.code === "MKEMSA")?.id ?? 1, institution_id: null, position: "Chairperson", from_year: 2020, to_year: 2021, status: "confirmed", show_publicly: true, hidden_by_admin: false, review_note: null, reviewed_at: ago(900), created_at: ago(1000) },
      { id: "past-2", user_id: "demo-alumnus", level: "national", association_id: null, institution_id: null, position: "Treasurer", from_year: 2021, to_year: 2022, status: "pending", show_publicly: true, hidden_by_admin: false, review_note: null, reviewed_at: null, created_at: ago(20) },
    ],
    banners: [
      {
        id: newId(),
        title: "MSAK National Rally 2027",
        venue: "Kenyatta University",
        starts_at: "2027-02-26T08:00:00+03:00",
        ends_at: "2027-02-28T18:00:00+03:00",
        link_url: null,
        link_label: null,
        is_active: true,
        created_at: now(),
      },
    ],
    session: null,
  };
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as State;
  } catch {
    /* storage unavailable: fall through to fresh seed */
  }
  return seed();
}

export function createDemoApi(): Api {
  let s = load();
  const listeners = new Set<(id: string | null) => void>();
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      /* quota or private mode: keep in memory */
    }
  };
  const emit = () => listeners.forEach((cb) => cb(s.session));

  const me = () => {
    if (!s.session) throw new Error("Please log in first.");
    return s.session;
  };
  const isAdmin = (u: string) => s.admins.includes(u);
  const profileOf = (u: string) => s.profiles.find((p) => p.id === u) ?? null;
  const hasRole = (u: string, level: LeaderLevel, assoc?: number | null, inst?: number | null) =>
    s.roles.some(
      (r) =>
        r.user_id === u &&
        isRoleActive(r) &&
        r.level === level &&
        (assoc == null || r.association_id === assoc) &&
        (inst == null || r.institution_id === inst),
    );
  const canManageChurches = (u: string, assoc: number) =>
    isAdmin(u) || hasRole(u, "national") || hasRole(u, "regional", assoc) || hasRole(u, "institutional", assoc);
  const canViewMember = (u: string, inst: number) =>
    isAdmin(u) || hasRole(u, "national") || hasRole(u, "regional", assocOf(inst)) || hasRole(u, "institutional", null, inst);
  const canVerify = (u: string, inst: number) =>
    isAdmin(u) || hasRole(u, "regional", assocOf(inst)) || hasRole(u, "institutional", null, inst);
  /** Delete a login and profile; their roles and feedback go too, posts and churches stay without the name. */
  const removeAccount = (id: string) => {
    s.users = s.users.filter((x) => x.id !== id);
    s.profiles = s.profiles.filter((x) => x.id !== id);
    s.roles = s.roles.filter((x) => x.user_id !== id);
    s.feedback = (s.feedback ?? []).filter((x) => x.user_id !== id);
  };
  const isActiveLeader = (u: string) => s.roles.some((r) => r.user_id === u && isRoleActive(r));
  const canReviewPast = (u: string, r: PastRole) =>
    r.user_id !== u && (isAdmin(u) || (r.level !== "national" && hasRole(u, "regional", r.association_id)));
  const requireAdmin = () => {
    const u = me();
    if (!isAdmin(u)) throw new Error("Administrator permission required.");
    return u;
  };

  const base: Api = {
    mode: "demo",

    async getDirectory() {
      return { associations: [...directory.associations], counties: [...directory.counties], institutions: [...directory.institutions] };
    },

    async getStats() {
      return {
        associations: directory.associations.length,
        counties: directory.counties.length,
        institutions: directory.institutions.length,
        churches: s.churches.filter((c) => c.status === "published").length,
      };
    },

    onAuthChange(cb) {
      listeners.add(cb);
      cb(s.session);
      return () => listeners.delete(cb);
    },

    async signIn(email, password) {
      const user = s.users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
      if (!user || user.password !== password) throw new Error("Invalid login credentials");
      s.session = user.id;
      save();
      emit();
    },

    async demoSignInAs(persona: DemoPersona) {
      s.session = `demo-${persona}`;
      save();
      emit();
    },

    async demoReset() {
      s = seed();
      save();
      emit();
    },

    async signUp(input) {
      if (s.users.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) {
        throw new Error("User already registered");
      }
      const id = newId();
      s.users.push({ id, email: input.email.trim(), password: input.password });
      s.profiles.push({
        id,
        full_name: input.full_name,
        gender: input.gender,
        phone: input.phone,
        institution_id: input.institution_id,
        course: input.course,
        admission_year: input.admission_year,
        year_of_study: input.year_of_study,
        expected_completion_year: input.expected_completion_year,
        terms_accepted_at: now(),
        created_at: now(),
        verification: "pending",
        verified_at: null,
        verification_note: null,
      });
      if (input.leader_level && input.leader_position) {
        s.roles.push({
          id: newId(),
          user_id: id,
          level: input.leader_level,
          position: input.leader_position,
          association_id: input.leader_level === "national" ? null : assocOf(input.institution_id),
          institution_id: input.leader_level === "institutional" ? input.institution_id : null,
          status: "pending",
          requested_at: now(),
          reviewed_at: null,
          review_note: null,
          term_ends_on: null,
          renewal_requested_at: null,
        });
      }
      s.session = id;
      save();
      emit();
      return { needsConfirmation: false };
    },

    async signOut() {
      s.session = null;
      save();
      emit();
    },

    async sendPasswordReset() {
      /* demo: nothing to send */
    },

    async updatePassword(password) {
      const u = s.users.find((x) => x.id === me());
      if (u) u.password = password;
      save();
    },

    async getMe() {
      if (!s.session) return null;
      const u = s.users.find((x) => x.id === s.session);
      return {
        userId: s.session,
        email: u?.email ?? null,
        profile: profileOf(s.session),
        roles: s.roles.filter((r) => r.user_id === s.session),
        isAdmin: isAdmin(s.session),
      };
    },

    async updateProfile(patch) {
      const u = me();
      const p = profileOf(u);
      if (!p) throw new Error("Profile not found.");
      const oldInst = p.institution_id;
      Object.assign(p, patch);
      if (patch.institution_id && patch.institution_id !== oldInst) {
        // the new campus's leaders confirm them again
        p.verification = "pending";
        p.verified_at = null;
        p.verification_note = null;
        const movedAssoc = assocOf(patch.institution_id) !== assocOf(oldInst);
        s.roles.forEach((r) => {
          if (r.user_id !== u || !["pending", "approved"].includes(r.status)) return;
          if (r.level === "institutional" || (r.level === "regional" && movedAssoc)) {
            r.status = "revoked";
            r.review_note = "Closed automatically: member changed institution.";
            r.reviewed_at = now();
          }
        });
      }
      save();
    },

    async requestLeaderRole(level, position) {
      const u = me();
      const p = profileOf(u);
      if (!p) throw new Error("Complete your profile first.");
      if (p.verification === "declined") throw new Error("A leader could not confirm your membership, so you can't do this. Contact MSAK through Help & feedback.");
      const held = s.roles.find((r) => r.user_id === u && r.level === level && ["pending", "approved"].includes(r.status));
      if (held?.status === "pending") throw new Error(`You already have a ${level} request waiting for approval.`);
      if (held) {
        held.renewal_requested_at = now();
        held.position = position.trim();
        held.review_note = null;
        save();
        return;
      }
      s.roles.push({
        id: newId(),
        user_id: u,
        level,
        position: position.trim(),
        association_id: level === "national" ? null : assocOf(p.institution_id),
        institution_id: level === "institutional" ? p.institution_id : null,
        status: "pending",
        requested_at: now(),
        reviewed_at: null,
        review_note: null,
        term_ends_on: null,
        renewal_requested_at: null,
      });
      save();
    },

    async renewLeaderRole(id) {
      const u = me();
      const r = s.roles.find((x) => x.id === id && x.user_id === u && x.status === "approved");
      if (!r) throw new Error("Only an approved role of yours can be renewed.");
      r.renewal_requested_at = now();
      r.review_note = null;
      save();
    },

    async listLeaderRoles() {
      const u = me();
      return s.roles
        .filter((r) => r.user_id !== u && (isAdmin(u) || (r.level === "institutional" && hasRole(u, "regional", r.association_id))))
        .map((r) => {
          const p = profileOf(r.user_id);
          return { ...r, person: p ? { full_name: p.full_name, phone: p.phone, institution_id: p.institution_id } : null };
        })
        .sort((a, b) => b.requested_at.localeCompare(a.requested_at));
    },

    async reviewLeaderRole(id, approve, note) {
      const u = me();
      const r = s.roles.find((x) => x.id === id);
      if (!r || !(r.status === "pending" || (r.status === "approved" && r.renewal_requested_at))) {
        throw new Error("That request is no longer waiting.");
      }
      if (r.user_id === u) throw new Error("You cannot review your own request.");
      if (!(isAdmin(u) || (r.level === "institutional" && hasRole(u, "regional", r.association_id)))) {
        throw new Error("You are not allowed to review this request.");
      }
      const today = kenyaToday();
      if (r.status === "pending") {
        r.status = approve ? "approved" : "rejected";
        r.term_ends_on = approve ? academicYearEnd(addDays(today, 30)) : null;
        // approving a leader also confirms them as a member
        const person = profileOf(r.user_id);
        if (approve && person && person.verification !== "verified") {
          person.verification = "verified";
          person.verified_at = now();
          person.verification_note = null;
        }
      } else {
        // renewal: approving extends to the next 31 August; declining lets the term run out
        if (approve) {
          const from = r.term_ends_on && addDays(r.term_ends_on, 1) > today ? addDays(r.term_ends_on, 1) : today;
          r.term_ends_on = academicYearEnd(from);
        }
        r.renewal_requested_at = null;
      }
      r.reviewed_at = now();
      r.review_note = note?.trim() || null;
      save();
    },

    async revokeLeaderRole(id, note) {
      const u = me();
      const r = s.roles.find((x) => x.id === id);
      if (!r || r.status !== "approved") throw new Error("That role is not active.");
      if (!(isAdmin(u) || r.user_id === u || (r.level === "institutional" && hasRole(u, "regional", r.association_id)))) {
        throw new Error("You are not allowed to revoke this role.");
      }
      r.status = "revoked";
      r.reviewed_at = now();
      r.review_note = note?.trim() || null;
      save();
    },

    async listAnnouncements() {
      const u = me();
      const p = profileOf(u);
      if (!p && !isAdmin(u)) return [];
      const myInst = p?.institution_id ?? null;
      const myAssoc = assocOf(myInst);
      const alumni = isAlumni(p);
      const confirmed = p?.verification === "verified";
      return s.announcements
        .filter(
          (a) =>
            a.audience === "national" ||
            a.author_id === u ||
            isAdmin(u) ||
            (confirmed &&
              ((a.audience === "alumni" && alumni) ||
            (a.audience === "regional" && a.association_id === myAssoc) ||
            (a.audience === "institutional" && a.institution_id === myInst && !alumni) ||
            ((a.audience === "regional" || a.audience === "institutional") && hasRole(u, "regional", a.association_id)) ||
            hasRole(u, "national"))),
        )
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    },

    async postAnnouncement(input) {
      const u = me();
      if (input.title.trim().length < 3) throw new Error("Title must be 3–160 characters.");
      if (!input.body.trim()) throw new Error("Write a message.");
      const level = input.audience === "alumni" ? "national" : input.audience;
      const role = s.roles.find((r) => r.user_id === u && r.level === level && isRoleActive(r));
      let assoc: number | null;
      let inst: number | null;
      if (role) {
        assoc = input.audience === "alumni" ? null : role.association_id;
        inst = input.audience === "alumni" ? null : role.institution_id;
      } else if (isAdmin(u)) {
        inst = input.audience === "institutional" ? input.institution_id ?? null : null;
        assoc =
          input.audience === "national" || input.audience === "alumni"
            ? null
            : input.audience === "institutional"
              ? assocOf(inst)
              : input.association_id ?? null;
        if (input.audience === "institutional" && !inst) throw new Error("Choose the institution.");
        if (input.audience === "regional" && !assoc) throw new Error("Choose the association.");
      } else {
        throw new Error(`You need an active ${level} leader role to post this.`);
      }
      const code = directory.associations.find((a) => a.id === assoc)?.code;
      s.announcements.push({
        id: newId(),
        author_id: u,
        // Leaders sign with their name; administrators are never named to members.
        author_name: role ? profileOf(u)?.full_name ?? "MSAK" : "MSAK",
        author_title: role
          ? `${role.level[0].toUpperCase()}${role.level.slice(1)} leader · ${role.position}${code ? ` · ${code}` : ""}`
          : "MSAK National Office",
        audience: input.audience,
        association_id: assoc,
        institution_id: inst,
        title: input.title.trim(),
        body: input.body.trim(),
        created_at: now(),
      });
      save();
    },

    async deleteAnnouncement(id) {
      const u = me();
      const a = s.announcements.find((x) => x.id === id);
      if (!a) return;
      if (a.author_id !== u && !isAdmin(u)) throw new Error("You don't have permission to do that.");
      s.announcements = s.announcements.filter((x) => x.id !== id);
      save();
    },

    async listChurches() {
      const u = s.session;
      return s.churches
        .filter(
          (c) =>
            c.status === "published" ||
            (u && c.status === "suggested" && (c.created_by === u || canManageChurches(u, c.association_id))),
        )
        .sort((a, b) => a.name.localeCompare(b.name));
    },

    async saveChurch(input, id) {
      const u = me();
      const manager = canManageChurches(u, input.association_id);
      if (!id && profileOf(u)?.verification === "declined") throw new Error("A leader could not confirm your membership, so you can't do this. Contact MSAK through Help & feedback.");
      if (id) {
        const c = s.churches.find((x) => x.id === id);
        if (!c) throw new Error("Church not found.");
        if (!canManageChurches(u, c.association_id) || !manager) throw new Error("You don't have permission to do that.");
        const publishing = input.status === "published" && c.status !== "published";
        Object.assign(c, input, { updated_at: now() }, publishing ? { verified_at: now() } : {});
      } else {
        s.churches.push({
          ...input,
          id: newId(),
          status: manager ? input.status : "suggested",
          location_verified: manager ? input.location_verified : false,
          created_by: u,
          created_by_name: profileOf(u)?.full_name ?? "MSAK",
          verified_at: manager && input.status === "published" ? now() : null,
          created_at: now(),
          updated_at: now(),
        });
      }
      save();
    },

    async deleteChurch(id) {
      const u = me();
      const c = s.churches.find((x) => x.id === id);
      if (!c) return;
      if (!canManageChurches(u, c.association_id)) throw new Error("You don't have permission to do that.");
      s.churches = s.churches.filter((x) => x.id !== id);
      save();
    },

    profilePhotoUrl(path) {
      return path ?? null;
    },

    async uploadProfilePhoto(file) {
      const p = profileOf(me());
      if (!p) throw new Error("Profile not found.");
      p.photo_path = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      save();
    },

    async removeProfilePhoto() {
      const p = profileOf(me());
      if (!p) throw new Error("Profile not found.");
      p.photo_path = null;
      save();
    },

    async uploadChurchPhoto(file) {
      me();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
    },

    async reportChurch(churchId, message) {
      const u = me();
      if (profileOf(u)?.verification === "declined") throw new Error("A leader could not confirm your membership, so you can't do this. Contact MSAK through Help & feedback.");
      if (!profileOf(u) && !isAdmin(u)) throw new Error("You don't have permission to do that.");
      if (message.trim().length < 5) throw new Error("Tell us what's wrong (at least 5 characters).");
      s.reports = s.reports ?? [];
      s.reports.unshift({ id: newId(), church_id: churchId, reporter_id: u, message: message.trim(), status: "open", created_at: now(), resolved_at: null });
      save();
    },

    async listChurchReports() {
      const u = me();
      return (s.reports ?? []).filter((r) => {
        const c = s.churches.find((x) => x.id === r.church_id);
        return r.reporter_id === u || (c && canManageChurches(u, c.association_id));
      });
    },

    async resolveChurchReport(id) {
      const u = me();
      const r = (s.reports ?? []).find((x) => x.id === id);
      const c = r && s.churches.find((x) => x.id === r.church_id);
      if (!r || !c || !canManageChurches(u, c.association_id)) throw new Error("You don't have permission to do that.");
      r.status = "resolved";
      r.resolved_at = now();
      save();
    },

    async listDocuments() {
      const u = me();
      if (!isAdmin(u) && profileOf(u)?.verification !== "verified") return [];
      return [...s.documents].sort((a, b) => b.created_at.localeCompare(a.created_at));
    },

    async uploadDocument(file, title, description) {
      const u = me();
      if (!isAdmin(u)) throw new Error("You don't have permission to do that.");
      const dataUrl =
        file.size <= 1_500_000
          ? await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result));
              reader.onerror = () => reject(reader.error);
              reader.readAsDataURL(file);
            })
          : undefined;
      s.documents.push({
        id: newId(),
        title: title.trim(),
        description: description.trim() || null,
        storage_path: `${Date.now()}-${file.name}`,
        file_name: file.name,
        content_type: file.type,
        size_bytes: file.size,
        created_at: now(),
        dataUrl,
      });
      save();
    },

    async getDocumentUrl(doc) {
      const stored = s.documents.find((d) => d.id === doc.id);
      if (!stored?.dataUrl) throw new Error("In demo mode only files under 1.5 MB are kept for download.");
      return stored.dataUrl;
    },

    async deleteDocument(doc) {
      if (!isAdmin(me())) throw new Error("You don't have permission to do that.");
      s.documents = s.documents.filter((d) => d.id !== doc.id);
      save();
    },

    async sendFeedback(rating, message) {
      s.feedback.push({ id: newId(), user_id: me(), rating, message: message.trim(), created_at: now() });
      save();
    },

    async listFeedback() {
      const u = me();
      return s.feedback.filter((f) => isAdmin(u) || f.user_id === u).sort((a, b) => b.created_at.localeCompare(a.created_at));
    },

    async listMembers(opts = {}) {
      const u = me();
      const withEmails = !!opts.emails && isAdmin(u);
      return s.profiles
        .filter((p) => p.id === u || canViewMember(u, p.institution_id))
        .map((p) => ({
          ...p,
          roles: s.roles.filter(
            (r) =>
              r.user_id === p.id &&
              ["pending", "approved"].includes(r.status) &&
              (r.user_id === u || isAdmin(u) || (r.level === "institutional" && hasRole(u, "regional", r.association_id))),
          ),
          isAdmin: s.admins.includes(p.id) && (isAdmin(u) || p.id === u),
          email: withEmails ? (s.users.find((x) => x.id === p.id)?.email ?? null) : undefined,
          pastRoles: isAdmin(u) || isActiveLeader(u) ? (s.pastRoles ?? []).filter((r) => r.user_id === p.id && r.status === "confirmed") : [],
        }))
        .sort((a, b) => a.full_name.localeCompare(b.full_name));
    },

    async setAdmin(userId, makeAdmin) {
      const u = me();
      if (!isAdmin(u)) throw new Error("Administrator permission required.");
      if (userId === u && !makeAdmin) throw new Error("You cannot remove yourself as administrator.");
      s.admins = makeAdmin ? Array.from(new Set([...s.admins, userId])) : s.admins.filter((x) => x !== userId);
      save();
    },

    async listLiveBanners() {
      return (s.banners ?? []).filter((b) => isBannerLive(b)).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    },

    async listAllBanners() {
      if (!isAdmin(me())) throw new Error("Administrator permission required.");
      return [...(s.banners ?? [])].sort((a, b) => b.starts_at.localeCompare(a.starts_at));
    },

    async saveBanner(input, id) {
      if (!isAdmin(me())) throw new Error("Administrator permission required.");
      if (input.title.trim().length < 3) throw new Error("Title must be 3–120 characters.");
      if (input.ends_at && input.ends_at < input.starts_at) throw new Error("The end must be after the start.");
      s.banners = s.banners ?? [];
      if (id) {
        const b = s.banners.find((x) => x.id === id);
        if (b) Object.assign(b, input);
      } else {
        s.banners.push({ ...input, id: newId(), created_at: now() });
      }
      save();
    },

    async deleteBanner(id) {
      if (!isAdmin(me())) throw new Error("Administrator permission required.");
      s.banners = (s.banners ?? []).filter((b) => b.id !== id);
      save();
    },

    async addInstitution(countyId, name) {
      if (!isAdmin(me())) throw new Error("Administrator permission required.");
      const nextId = Math.max(...directory.institutions.map((i) => i.id)) + 1;
      directory.institutions.push({ id: nextId, county_id: countyId, name: name.trim() });
    },

    async reviewMember(memberId, approve, note) {
      const u = me();
      const p = profileOf(memberId);
      if (!p) throw new Error("Profile not found.");
      if (memberId === u) throw new Error("You cannot confirm your own membership.");
      if (!canVerify(u, p.institution_id)) throw new Error("You are not allowed to confirm this member.");
      const why = note?.trim() ?? "";
      if (!approve && why.length < 3) throw new Error("Say briefly why you are declining (at least 3 characters).");
      if (!approve && (isAdmin(memberId) || s.roles.some((r) => r.user_id === memberId && isRoleActive(r)))) {
        throw new Error("This member holds an active leader role. Revoke the role first.");
      }
      p.verification = approve ? "verified" : "declined";
      p.verified_at = now();
      p.verification_note = why.slice(0, 300) || null;
      save();
    },

    async removeDeclinedAccount(memberId) {
      const u = requireAdmin();
      if (memberId === u || isAdmin(memberId)) throw new Error("Administrator accounts cannot be removed here.");
      if (profileOf(memberId)?.verification !== "declined") throw new Error("Only members a leader has declined can be removed.");
      removeAccount(memberId);
      save();
    },

    async purgeDeclinedAccounts() {
      requireAdmin();
      const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const ids = s.profiles.filter((p) => p.verification === "declined" && (p.verified_at ?? "") < cutoff && !isAdmin(p.id)).map((p) => p.id);
      ids.forEach(removeAccount);
      if (ids.length) save();
      return ids.length;
    },

    async listPastRoles() {
      const u = me();
      return (s.pastRoles ?? []).filter(
        (r) => r.user_id === u || isAdmin(u) || canReviewPast(u, r) || (r.status === "confirmed" && isActiveLeader(u)),
      );
    },

    async addPastRole(i) {
      const u = me();
      const p = profileOf(u);
      if (!p) throw new Error("Complete your profile first.");
      if (p.verification === "declined") throw new Error("A leader could not confirm your membership, so you can't do this. Contact MSAK through Help & feedback.");
      if (i.to_year < i.from_year) throw new Error("The end year must be the same as or after the start year.");
      if (i.to_year - i.from_year > 10) throw new Error("A single position can cover at most 10 years; add separate entries.");
      if (i.position.trim().length < 2) throw new Error("Enter the position (2–100 characters).");
      if (i.to_year > Number(kenyaToday().slice(0, 4))) throw new Error("Past positions must have ended by this year.");
      const assoc = i.level === "institutional" ? (i.institution_id ? assocOf(i.institution_id) : null) : i.level === "regional" ? i.association_id : null;
      if (i.level === "institutional" && !i.institution_id) throw new Error("Choose the institution.");
      if (i.level === "regional" && !assoc) throw new Error("Choose the association.");
      s.pastRoles = s.pastRoles ?? [];
      s.pastRoles.unshift({
        id: newId(), user_id: u, level: i.level, association_id: assoc ?? null,
        institution_id: i.level === "institutional" ? i.institution_id : null,
        position: i.position.trim(), from_year: i.from_year, to_year: i.to_year,
        status: "pending", show_publicly: i.show_publicly, hidden_by_admin: false, review_note: null, reviewed_at: null, created_at: now(),
      });
      save();
    },

    async updatePastRole(id, i) {
      const u = me();
      const r = (s.pastRoles ?? []).find((x) => x.id === id && x.user_id === u);
      if (!r) throw new Error("That entry was not found.");
      if (i.to_year < i.from_year) throw new Error("The end year must be the same as or after the start year.");
      if (i.to_year - i.from_year > 10) throw new Error("A single position can cover at most 10 years; add separate entries.");
      if (i.position.trim().length < 2) throw new Error("Enter the position (2–100 characters).");
      if (i.to_year > Number(kenyaToday().slice(0, 4))) throw new Error("Past positions must have ended by this year.");
      const assoc = i.level === "institutional" ? (i.institution_id ? assocOf(i.institution_id) : null) : i.level === "regional" ? i.association_id : null;
      if (i.level === "institutional" && !i.institution_id) throw new Error("Choose the institution.");
      if (i.level === "regional" && !assoc) throw new Error("Choose the association.");
      Object.assign(r, {
        level: i.level,
        association_id: assoc ?? null,
        institution_id: i.level === "institutional" ? i.institution_id : null,
        position: i.position.trim(),
        from_year: i.from_year,
        to_year: i.to_year,
        show_publicly: i.level === "institutional" ? false : i.show_publicly,
        status: "pending",
        review_note: null,
        reviewed_at: null,
      });
      save();
    },

    async updateLeaderRequest(id, position) {
      const u = me();
      const r = s.roles.find((x) => x.id === id && x.user_id === u && x.status === "pending");
      if (!r) throw new Error("Only your own requests that are still waiting can be changed.");
      if (position.trim().length < 2 || position.trim().length > 100) throw new Error("Enter your position (2–100 characters).");
      r.position = position.trim();
      r.requested_at = now();
      save();
    },

    async withdrawLeaderRequest(id) {
      const u = me();
      const before = s.roles.length;
      s.roles = s.roles.filter((x) => !(x.id === id && x.user_id === u && x.status === "pending"));
      if (s.roles.length === before) throw new Error("Only your own requests that are still waiting can be withdrawn.");
      save();
      emit();
    },

    async removePastRole(id) {
      const u = me();
      const before = (s.pastRoles ?? []).length;
      s.pastRoles = (s.pastRoles ?? []).filter((r) => !(r.id === id && (r.user_id === u || isAdmin(u))));
      if (s.pastRoles.length === before) throw new Error("That entry was not found.");
      save();
    },

    async setPastRolePublic(id, show) {
      const u = me();
      const r = (s.pastRoles ?? []).find((x) => x.id === id && x.user_id === u);
      if (!r) throw new Error("That entry was not found.");
      r.show_publicly = show;
      save();
    },

    async reviewPastRole(id, confirm, note) {
      const u = me();
      const r = (s.pastRoles ?? []).find((x) => x.id === id);
      if (!r) throw new Error("That entry was not found.");
      if (!canReviewPast(u, r)) throw new Error("You are not allowed to confirm this.");
      const why = note?.trim() ?? "";
      if (!confirm && why.length < 3) throw new Error("Say briefly why you are declining (at least 3 characters).");
      r.status = confirm ? "confirmed" : "declined";
      r.review_note = why.slice(0, 300) || null;
      r.reviewed_at = now();
      save();
    },

    async adminHidePastRole(id, hidden) {
      requireAdmin();
      const r = (s.pastRoles ?? []).find((x) => x.id === id);
      if (!r) throw new Error("That entry was not found.");
      r.hidden_by_admin = hidden;
      save();
    },

    async getPastLeadersPublic() {
      return s.settings?.past_leaders_public !== false;
    },

    async setPastLeadersPublic(on) {
      requireAdmin();
      s.settings = { ...(s.settings ?? {}), past_leaders_public: on };
      save();
    },

    async publicPastLeaders(): Promise<PublicPastLeader[]> {
      return (s.pastRoles ?? [])
        .filter((r) => s.settings?.past_leaders_public !== false && r.status === "confirmed" && r.show_publicly && !r.hidden_by_admin && r.level !== "institutional")
        .map((r) => {
          const a = r.association_id ? directory.associations.find((x) => x.id === r.association_id) : undefined;
          return {
            full_name: profileOf(r.user_id)?.full_name ?? "",
            level: r.level as "regional" | "national",
            association_code: a?.code ?? null,
            association_name: a?.name ?? null,
            title: r.position,
            from_year: r.from_year,
            to_year: r.to_year,
          };
        })
        .sort((x, y) => y.to_year - x.to_year || y.from_year - x.from_year || (x.level === "national" ? -1 : 1));
    },

    async adminUpdateProfile(id, patch) {
      requireAdmin();
      const p = profileOf(id);
      if (!p) throw new Error("Member not found.");
      if (patch.verification === "declined" && s.roles.some((r) => r.user_id === id && isRoleActive(r))) {
        throw new Error("This member holds an active leader role. Revoke the role first.");
      }
      const changedStatus = patch.verification !== p.verification;
      Object.assign(p, { ...patch, full_name: patch.full_name.trim(), phone: patch.phone.trim(), course: patch.course.trim() });
      if (changedStatus) {
        p.verified_at = now();
        p.verification_note = patch.verification === "declined" ? "Set by an administrator" : null;
      }
      save();
      emit();
    },
    async adminDeleteMember(id) {
      const u = requireAdmin();
      if (id === u || isAdmin(id)) throw new Error("Administrator accounts cannot be removed here.");
      if (!profileOf(id)) throw new Error("Member not found.");
      removeAccount(id);
      save();
    },
    async adminAssignRole(memberId, r) {
      requireAdmin();
      const p = profileOf(memberId);
      if (!p) throw new Error("Member not found.");
      if (r.position.trim().length < 2) throw new Error("Enter the position (2–100 characters).");
      const assoc = r.level === "institutional" ? (r.institution_id ? assocOf(r.institution_id) : null) : r.level === "regional" ? r.association_id : null;
      if (r.level === "institutional" && !r.institution_id) throw new Error("Choose the institution.");
      if (r.level === "regional" && !assoc) throw new Error("Choose the association.");
      s.roles.push({
        id: newId(), user_id: memberId, level: r.level, position: r.position.trim(),
        association_id: r.level === "national" ? null : assoc, institution_id: r.level === "institutional" ? r.institution_id : null,
        status: "approved", requested_at: now(), reviewed_at: now(), review_note: "Assigned by an administrator",
        term_ends_on: r.term_ends_on ?? academicYearEnd(addDays(kenyaToday(), 30)), renewal_requested_at: null,
      });
      p.verification = "verified";
      save();
      emit();
    },
    async adminUpdateRole(roleId, r) {
      requireAdmin();
      const role = s.roles.find((x) => x.id === roleId);
      if (!role) throw new Error("That role was not found.");
      if (r.position.trim().length < 2) throw new Error("Enter the position (2–100 characters).");
      const assoc = r.level === "institutional" ? (r.institution_id ? assocOf(r.institution_id) : null) : r.level === "regional" ? r.association_id : null;
      if (r.level === "institutional" && !r.institution_id) throw new Error("Choose the institution.");
      if (r.level === "regional" && !assoc) throw new Error("Choose the association.");
      Object.assign(role, {
        level: r.level, position: r.position.trim(), association_id: r.level === "national" ? null : assoc,
        institution_id: r.level === "institutional" ? r.institution_id : null, status: r.status,
        term_ends_on: r.status === "approved" ? (r.term_ends_on ?? role.term_ends_on ?? academicYearEnd(addDays(kenyaToday(), 30))) : r.term_ends_on,
        renewal_requested_at: r.status === "approved" ? role.renewal_requested_at : null, reviewed_at: now(),
      });
      save();
      emit();
    },
    async adminDeleteRole(roleId) {
      requireAdmin();
      const before = s.roles.length;
      s.roles = s.roles.filter((x) => x.id !== roleId);
      if (s.roles.length === before) throw new Error("That role was not found.");
      save();
      emit();
    },
    async adminUpdatePastRole(id, i) {
      requireAdmin();
      const r = (s.pastRoles ?? []).find((x) => x.id === id);
      if (!r) throw new Error("That entry was not found.");
      if (i.to_year < i.from_year || i.to_year - i.from_year > 10) throw new Error("Check the years (end on or after start, at most 10 years).");
      const assoc = i.level === "institutional" ? (i.institution_id ? assocOf(i.institution_id) : null) : i.level === "regional" ? i.association_id : null;
      Object.assign(r, {
        level: i.level, association_id: i.level === "national" ? null : assoc, institution_id: i.level === "institutional" ? i.institution_id : null,
        position: i.position.trim(), from_year: i.from_year, to_year: i.to_year, status: i.status,
        show_publicly: i.level !== "institutional" && i.show_publicly, reviewed_at: now(),
      });
      save();
    },
    async updateAnnouncement(id, title, body) {
      requireAdmin();
      const a = s.announcements.find((x) => x.id === id);
      if (!a) throw new Error("Announcement not found.");
      if (title.trim().length < 3 || title.trim().length > 160) throw new Error("Title must be 3–160 characters.");
      if (!body.trim()) throw new Error("Message must be 1–5000 characters.");
      a.title = title.trim();
      a.body = body.trim();
      save();
    },
    async updateDocument(id, title, description) {
      requireAdmin();
      const d = s.documents.find((x) => x.id === id);
      if (!d) throw new Error("Document not found.");
      if (title.trim().length < 3) throw new Error("Title must be 3–160 characters.");
      d.title = title.trim();
      d.description = description.trim() || null;
      save();
    },
    async deleteFeedback(id) {
      requireAdmin();
      s.feedback = s.feedback.filter((x) => x.id !== id);
      save();
    },
    async deleteChurchReport(id) {
      requireAdmin();
      s.reports = (s.reports ?? []).filter((x) => x.id !== id);
      save();
    },
    async addAssociation(code, name) {
      requireAdmin();
      if (directory.associations.some((a) => a.code === code.trim().toUpperCase())) throw new Error("That already exists.");
      directory.associations.push({ id: Math.max(...directory.associations.map((a) => a.id)) + 1, code: code.trim().toUpperCase(), name: name.trim() });
    },
    async updateAssociation(id, code, name) {
      requireAdmin();
      const a = directory.associations.find((x) => x.id === id);
      if (!a) throw new Error("Not found.");
      a.code = code.trim().toUpperCase();
      a.name = name.trim();
    },
    async deleteAssociation(id) {
      requireAdmin();
      if (directory.counties.some((c) => c.association_id === id) || s.churches.some((c) => c.association_id === id)) {
        throw new Error("This is still in use (members, churches, posts or roles are linked to it), so it can't be deleted. Move those first.");
      }
      directory.associations = directory.associations.filter((a) => a.id !== id);
    },
    async addCounty(associationId, name) {
      requireAdmin();
      directory.counties.push({ id: Math.max(...directory.counties.map((c) => c.id)) + 1, association_id: associationId, name: name.trim() });
    },
    async updateCounty(id, associationId, name) {
      requireAdmin();
      const c = directory.counties.find((x) => x.id === id);
      if (!c) throw new Error("Not found.");
      c.association_id = associationId;
      c.name = name.trim();
    },
    async deleteCounty(id) {
      requireAdmin();
      if (directory.institutions.some((i) => i.county_id === id) || s.churches.some((c) => c.county_id === id)) {
        throw new Error("This is still in use (members, churches, posts or roles are linked to it), so it can't be deleted. Move those first.");
      }
      directory.counties = directory.counties.filter((c) => c.id !== id);
    },
    async updateInstitution(id, countyId, name) {
      requireAdmin();
      const i = directory.institutions.find((x) => x.id === id);
      if (!i) throw new Error("Not found.");
      i.county_id = countyId;
      i.name = name.trim();
    },
    async deleteInstitution(id) {
      requireAdmin();
      if (s.profiles.some((p) => p.institution_id === id) || s.roles.some((r) => r.institution_id === id)) {
        throw new Error("This is still in use (members, churches, posts or roles are linked to it), so it can't be deleted. Move those first.");
      }
      directory.institutions = directory.institutions.filter((i) => i.id !== id);
    },

    async adminChangeEmail(memberId, email) {
      requireAdmin();
      const p = profileOf(memberId);
      const user = s.users.find((x) => x.id === memberId);
      if (!p || !user) throw new Error("Member not found.");
      const next = email.trim().toLowerCase();
      if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(next)) throw new Error("That email address doesn't look right.");
      if (s.users.some((x) => x.id !== memberId && x.email.toLowerCase() === next)) throw new Error("Another account already uses that email.");
      user.email = next;
      save();
    },

    async countPendingMembers() {
      const u = me();
      return s.profiles.filter((p) => p.id !== u && p.verification === "pending" && canViewMember(u, p.institution_id)).length;
    },

    async adminDashboard(): Promise<AdminDashboard> {
      requireAdmin();
      const today = kenyaToday();
      const active = s.roles.filter((r) => isRoleActive(r));
      const months: string[] = [];
      const d = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
      for (let i = 11; i >= 0; i--) {
        const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1));
        months.push(m.toISOString().slice(0, 7));
      }
      const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
      const counted = s.profiles.filter((p) => p.verification !== "declined");
      return {
        members: counted.length,
        students: counted.filter((p) => !isAlumni(p)).length,
        alumni: counted.filter(isAlumni).length,
        by_association: [...directory.associations]
          .sort((a, b) => a.code.localeCompare(b.code))
          .map((a) => {
            const ps = counted.filter((p) => assocOf(p.institution_id) === a.id);
            const cs = s.churches.filter((c) => c.association_id === a.id && c.status === "published");
            return {
              association_id: a.id,
              code: a.code,
              name: a.name,
              students: ps.filter((p) => !isAlumni(p)).length,
              alumni: ps.filter(isAlumni).length,
              churches: cs.length,
              churches_confirmed: cs.filter((c) => c.location_verified).length,
            };
          }),
        signups: months.map((month) => ({ month, count: counted.filter((p) => p.created_at.slice(0, 7) === month).length })),
        leaders: {
          national: active.filter((r) => r.level === "national").length,
          regional: active.filter((r) => r.level === "regional").length,
          institutional: active.filter((r) => r.level === "institutional").length,
          waiting: s.roles.filter((r) => ["pending", "renewal"].includes(roleState(r))).length,
          expired: s.roles.filter((r) => roleState(r) === "expired").length,
        },
        churches_suggested: s.churches.filter((c) => c.status === "suggested").length,
        open_reports: (s.reports ?? []).filter((r) => r.status === "open").length,
        errors_7d: (s.errors ?? []).filter((e) => e.at > weekAgo).length,
        activity_7d: (s.audit ?? []).filter((e) => e.at > weekAgo).length,
      };
    },

    async listAuditLog(opts = {}) {
      requireAdmin();
      return (s.audit ?? []).filter((e) => (!opts.before || e.id < opts.before) && (!opts.entity || e.entity === opts.entity)).slice(0, 50);
    },

    async listErrorLog(opts = {}) {
      requireAdmin();
      return (s.errors ?? []).filter((e) => !opts.before || e.id < opts.before).slice(0, 50);
    },

    async deleteErrorEntry(id) {
      requireAdmin();
      s.errors = (s.errors ?? []).filter((e) => e.id !== id);
      save();
    },

    async purgeLogs(days) {
      requireAdmin();
      if (!Number.isFinite(days) || days < 7) throw new Error("Keep at least the last 7 days.");
      const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
      const before = (s.audit ?? []).length + (s.errors ?? []).length;
      s.audit = (s.audit ?? []).filter((e) => e.at >= cutoff);
      s.errors = (s.errors ?? []).filter((e) => e.at >= cutoff);
      save();
      return before - s.audit.length - s.errors.length;
    },

    async logClientError(r) {
      s.errors = s.errors ?? [];
      const id = (s.errors[0]?.id ?? 0) + 1;
      s.errors.unshift({ id, at: now(), user_id: s.session, message: r.message.slice(0, 1000), stack: r.stack?.slice(0, 4000) ?? null, url: r.url.slice(0, 500), user_agent: r.userAgent.slice(0, 300) });
      s.errors = s.errors.slice(0, 200);
      save();
    },
  };

  // Demo activity log: record what people do, like the database's audit triggers.
  const logged: Partial<Record<keyof Api, [entity: string, action: AuditEntry["action"]]>> = {
    postAnnouncement: ["announcements", "insert"],
    deleteAnnouncement: ["announcements", "delete"],
    requestLeaderRole: ["leader_roles", "insert"],
    renewLeaderRole: ["leader_roles", "update"],
    reviewLeaderRole: ["leader_roles", "update"],
    revokeLeaderRole: ["leader_roles", "update"],
    saveChurch: ["churches", "update"],
    deleteChurch: ["churches", "delete"],
    reportChurch: ["church_reports", "insert"],
    resolveChurchReport: ["church_reports", "update"],
    uploadDocument: ["documents", "insert"],
    deleteDocument: ["documents", "delete"],
    setAdmin: ["admins", "update"],
    saveBanner: ["home_banners", "update"],
    deleteBanner: ["home_banners", "delete"],
    addInstitution: ["institutions", "insert"],
    reviewMember: ["profiles", "update"],
    removeDeclinedAccount: ["profiles", "delete"],
    adminChangeEmail: ["profiles", "update"],
    adminUpdateProfile: ["profiles", "update"],
    adminDeleteMember: ["profiles", "delete"],
    adminAssignRole: ["leader_roles", "insert"],
    adminUpdateRole: ["leader_roles", "update"],
    adminDeleteRole: ["leader_roles", "delete"],
    adminUpdatePastRole: ["past_roles", "update"],
    updateAnnouncement: ["announcements", "update"],
    updateDocument: ["documents", "update"],
    deleteFeedback: ["feedback", "delete"],
    deleteChurchReport: ["church_reports", "delete"],
    addAssociation: ["associations", "insert"],
    updateAssociation: ["associations", "update"],
    deleteAssociation: ["associations", "delete"],
    addCounty: ["counties", "insert"],
    updateCounty: ["counties", "update"],
    deleteCounty: ["counties", "delete"],
    updateInstitution: ["institutions", "update"],
    deleteInstitution: ["institutions", "delete"],
    addPastRole: ["past_roles", "insert"],
    reviewPastRole: ["past_roles", "update"],
    removePastRole: ["past_roles", "delete"],
    adminHidePastRole: ["past_roles", "update"],
    setPastLeadersPublic: ["site_settings", "update"],
    updatePastRole: ["past_roles", "update"],
    updateLeaderRequest: ["leader_roles", "update"],
    withdrawLeaderRequest: ["leader_roles", "delete"],
  };
  const summarise = (args: unknown[]): string | null => {
    for (const a of args) {
      if (a && typeof a === "object") {
        const o = a as Record<string, unknown>;
        const t = o.title ?? o.name ?? o.full_name ?? o.message;
        if (typeof t === "string") return t.slice(0, 200);
      }
    }
    const str = args.find((a): a is string => typeof a === "string" && a.length > 2 && !/^[0-9a-f-]{8,}$/i.test(a));
    return str ? str.slice(0, 200) : null;
  };
  const wrapped = { ...base } as Record<string, unknown>;
  for (const [name, [entity, action]] of Object.entries(logged) as [string, [string, AuditEntry["action"]]][]) {
    const fn = (base as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>)[name];
    wrapped[name] = async (...args: unknown[]) => {
      const out = await fn(...args);
      const u = s.session;
      if (u) {
        s.audit = s.audit ?? [];
        const isNew = (name === "saveChurch" || name === "saveBanner") && args[1] == null;
        s.audit.unshift({
          id: (s.audit[0]?.id ?? 0) + 1,
          at: now(),
          actor_id: u,
          actor_label: isAdmin(u) ? "Admin · Demo administrator" : (profileOf(u)?.full_name ?? "Member"),
          action: isNew ? "insert" : action,
          entity,
          entity_id: typeof args[0] === "string" && /^[0-9a-z-]{6,}$/i.test(args[0]) ? args[0] : null,
          summary: summarise(args),
          changes: null,
        });
        s.audit = s.audit.slice(0, 500);
        save();
      }
      return out;
    };
  }
  return wrapped as unknown as Api;
}
