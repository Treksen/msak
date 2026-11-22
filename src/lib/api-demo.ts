import type { Api } from "./api";
import type {
  Announcement,
  Church,
  DemoPersona,
  Directory,
  DocumentItem,
  FeedbackItem,
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

const KEY = "msak-demo-v1";
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
  });

  const users: DemoUser[] = [
    { id: "demo-member", email: "member@demo.msak", password: "demo1234" },
    { id: "demo-institutional", email: "campus@demo.msak", password: "demo1234" },
    { id: "demo-regional", email: "region@demo.msak", password: "demo1234" },
    { id: "demo-national", email: "national@demo.msak", password: "demo1234" },
    { id: "demo-admin", email: "admin@demo.msak", password: "demo1234" },
    { id: "demo-applicant-1", email: "a1@demo.msak", password: "demo1234" },
    { id: "demo-applicant-2", email: "a2@demo.msak", password: "demo1234" },
  ];
  const profiles = [
    person("demo-member", "Moses Mwangi", "Male", jkuat, 1),
    person("demo-institutional", "Ivy Wanjiku", "Female", jkuat, 2),
    person("demo-regional", "Rafael Otieno", "Male", ku, 4),
    person("demo-national", "Wanjiru Achieng", "Female", westInst, 3),
    person("demo-admin", "Ada Njeri", "Female", jkuat, 4),
    person("demo-applicant-1", "Kevin Kiprono", "Male", ku, 2),
    person("demo-applicant-2", "Grace Muthoni", "Female", nyeriInst, 3),
  ];
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
      id: newId(), author_id: "demo-admin", author_name: "Ada Njeri", author_title: "MSAK administrator",
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
        r.status === "approved" &&
        r.level === level &&
        (assoc == null || r.association_id === assoc) &&
        (inst == null || r.institution_id === inst),
    );
  const canManageChurches = (u: string, assoc: number) =>
    isAdmin(u) || hasRole(u, "national") || hasRole(u, "regional", assoc) || hasRole(u, "institutional", assoc);
  const canViewMember = (u: string, inst: number) =>
    isAdmin(u) || hasRole(u, "national") || hasRole(u, "regional", assocOf(inst)) || hasRole(u, "institutional", null, inst);

  return {
    mode: "demo",

    async getDirectory() {
      return { ...directory, institutions: [...directory.institutions] };
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
      if (s.roles.some((r) => r.user_id === u && r.level === level && ["pending", "approved"].includes(r.status))) {
        throw new Error(`You already have a ${level} role that is pending or approved.`);
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
      });
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
      if (!r || r.status !== "pending") throw new Error("That request is no longer pending.");
      if (r.user_id === u) throw new Error("You cannot review your own request.");
      if (!(isAdmin(u) || (r.level === "institutional" && hasRole(u, "regional", r.association_id)))) {
        throw new Error("You are not allowed to review this request.");
      }
      r.status = approve ? "approved" : "rejected";
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
      const myInst = p?.institution_id ?? null;
      const myAssoc = assocOf(myInst);
      return s.announcements
        .filter(
          (a) =>
            a.audience === "national" ||
            (a.audience === "regional" && a.association_id === myAssoc) ||
            (a.audience === "institutional" && a.institution_id === myInst) ||
            a.author_id === u ||
            isAdmin(u) ||
            hasRole(u, "regional", a.association_id) ||
            hasRole(u, "national"),
        )
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    },

    async postAnnouncement(input) {
      const u = me();
      if (input.title.trim().length < 3) throw new Error("Title must be 3–160 characters.");
      if (!input.body.trim()) throw new Error("Write a message.");
      const role = s.roles.find((r) => r.user_id === u && r.level === input.audience && r.status === "approved");
      let assoc: number | null;
      let inst: number | null;
      if (role) {
        assoc = role.association_id;
        inst = role.institution_id;
      } else if (isAdmin(u)) {
        inst = input.audience === "institutional" ? input.institution_id ?? null : null;
        assoc =
          input.audience === "national" ? null : input.audience === "institutional" ? assocOf(inst) : input.association_id ?? null;
        if (input.audience === "institutional" && !inst) throw new Error("Choose the institution.");
        if (input.audience === "regional" && !assoc) throw new Error("Choose the association.");
      } else {
        throw new Error(`You need an approved ${input.audience} leader role to post this.`);
      }
      const code = directory.associations.find((a) => a.id === assoc)?.code;
      s.announcements.push({
        id: newId(),
        author_id: u,
        author_name: profileOf(u)?.full_name ?? "MSAK",
        author_title: role
          ? `${input.audience[0].toUpperCase()}${input.audience.slice(1)} leader · ${role.position}${code ? ` · ${code}` : ""}`
          : "MSAK administrator",
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
          created_by_name: profileOf(u)?.full_name ?? null,
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

    async listDocuments() {
      me();
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

    async listMembers() {
      const u = me();
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

    async addInstitution(countyId, name) {
      if (!isAdmin(me())) throw new Error("Administrator permission required.");
      const nextId = Math.max(...directory.institutions.map((i) => i.id)) + 1;
      directory.institutions.push({ id: nextId, county_id: countyId, name: name.trim() });
    },
  };
}
