import type { SupabaseClient } from "@supabase/supabase-js";
import type { Api } from "./api";
import { isBannerLive } from "./banners";
import type {
  Announcement,
  Church,
  ChurchReport,
  AdminDashboard,
  AuditEntry,
  ErrorEntry,
  DocumentItem,
  FeedbackItem,
  HomeBanner,
  LeaderRole,
  LeaderRoleWithPerson,
  MemberRow,
  Profile,
  Stats,
} from "./types";

/** Throw Supabase errors so screens can show them; otherwise return the data. */
function check<R extends { data: unknown; error: { message: string } | null }>(res: R): R["data"] {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export function createSupabaseApi(sb: SupabaseClient): Api {
  const siteUrl = () => window.location.origin;

  async function uid(): Promise<string> {
    const { data } = await sb.auth.getSession();
    const id = data.session?.user.id;
    if (!id) throw new Error("Please log in first.");
    return id;
  }

  return {
    mode: "supabase",

    async getDirectory() {
      const [a, c, i] = await Promise.all([
        sb.from("associations").select("id, code, name").order("id"),
        sb.from("counties").select("id, association_id, name").order("name"),
        sb.from("institutions").select("id, county_id, name").order("name").range(0, 4999),
      ]);
      return { associations: check(a) ?? [], counties: check(c) ?? [], institutions: check(i) ?? [] };
    },

    async getStats() {
      return check(await sb.rpc("public_stats")) as Stats;
    },

    onAuthChange(cb) {
      sb.auth.getSession().then(({ data }) => cb(data.session?.user.id ?? null));
      const { data } = sb.auth.onAuthStateChange((_event, session) => cb(session?.user.id ?? null));
      return () => data.subscription.unsubscribe();
    },

    async signIn(email, password) {
      check(await sb.auth.signInWithPassword({ email: email.trim(), password }));
    },

    async signUp(input) {
      const { email, password, ...meta } = input;
      const res = await sb.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${siteUrl()}/login?confirmed=1`,
          data: { ...meta, terms_accepted_at: new Date().toISOString() },
        },
      });
      check(res);
      return { needsConfirmation: !res.data.session };
    },

    async signOut() {
      const { error } = await sb.auth.signOut();
      if (error) throw new Error(error.message);
    },

    async sendPasswordReset(email) {
      check(await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${siteUrl()}/reset-password` }));
    },

    async updatePassword(password) {
      check(await sb.auth.updateUser({ password }));
    },

    async getMe() {
      const { data } = await sb.auth.getSession();
      const user = data.session?.user;
      if (!user) return null;
      const [p, r, a] = await Promise.all([
        sb.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        sb.from("leader_roles").select("*").eq("user_id", user.id).order("requested_at", { ascending: false }),
        sb.from("admins").select("user_id").eq("user_id", user.id).maybeSingle(),
      ]);
      return {
        userId: user.id,
        email: user.email ?? null,
        profile: (check(p) as Profile | null) ?? null,
        roles: (check(r) as LeaderRole[]) ?? [],
        isAdmin: !!check(a),
      };
    },

    async updateProfile(patch) {
      const id = await uid();
      check(await sb.from("profiles").update(patch).eq("id", id));
    },

    async requestLeaderRole(level, position) {
      check(await sb.rpc("request_leader_role", { p_level: level, p_position: position }));
    },

    async listLeaderRoles() {
      const id = await uid();
      const rows = check(
        await sb
          .from("leader_roles")
          .select("*, person:profiles(full_name, phone, institution_id)")
          .neq("user_id", id)
          .order("requested_at", { ascending: false }),
      );
      return (rows ?? []) as LeaderRoleWithPerson[];
    },

    async reviewLeaderRole(id, approve, note) {
      check(await sb.rpc("review_leader_role", { p_role_id: id, p_approve: approve, p_note: note ?? null }));
    },

    async revokeLeaderRole(id, note) {
      check(await sb.rpc("revoke_leader_role", { p_role_id: id, p_note: note ?? null }));
    },

    async renewLeaderRole(id) {
      check(await sb.rpc("renew_leader_role", { p_role_id: id }));
    },

    async listAnnouncements() {
      const rows = check(await sb.from("announcements").select("*").order("created_at", { ascending: false }).limit(200));
      return (rows ?? []) as Announcement[];
    },

    async postAnnouncement(input) {
      check(
        await sb.rpc("post_announcement", {
          p_audience: input.audience,
          p_title: input.title,
          p_body: input.body,
          p_association_id: input.association_id ?? null,
          p_institution_id: input.institution_id ?? null,
        }),
      );
    },

    async deleteAnnouncement(id) {
      check(await sb.from("announcements").delete().eq("id", id));
    },

    async listChurches() {
      const rows = check(await sb.from("churches").select("*").neq("status", "rejected").order("name"));
      return (rows ?? []) as Church[];
    },

    async saveChurch(input, id) {
      if (id) check(await sb.from("churches").update(input).eq("id", id));
      else check(await sb.from("churches").insert(input));
    },

    async deleteChurch(id) {
      check(await sb.from("churches").delete().eq("id", id));
    },

    async uploadChurchPhoto(file, associationId) {
      const path = `${associationId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      check(await sb.storage.from("church-photos").upload(path, file, { contentType: "image/jpeg", upsert: false }));
      return sb.storage.from("church-photos").getPublicUrl(path).data.publicUrl;
    },

    async reportChurch(churchId, message) {
      check(await sb.from("church_reports").insert({ church_id: churchId, message: message.trim() }));
    },

    async listChurchReports() {
      const rows = check(await sb.from("church_reports").select("*").order("created_at", { ascending: false }).limit(300));
      return (rows ?? []) as ChurchReport[];
    },

    async resolveChurchReport(id) {
      check(await sb.from("church_reports").update({ status: "resolved" }).eq("id", id));
    },

    async adminDashboard() {
      return check(await sb.rpc("admin_dashboard")) as AdminDashboard;
    },

    async listAuditLog(opts = {}) {
      let q = sb.from("audit_log").select("*").order("id", { ascending: false }).limit(50);
      if (opts.before) q = q.lt("id", opts.before);
      if (opts.entity) q = q.eq("entity", opts.entity);
      return (check(await q) ?? []) as AuditEntry[];
    },

    async listErrorLog(opts = {}) {
      let q = sb.from("error_log").select("*").order("id", { ascending: false }).limit(50);
      if (opts.before) q = q.lt("id", opts.before);
      return (check(await q) ?? []) as ErrorEntry[];
    },

    async deleteErrorEntry(id) {
      check(await sb.from("error_log").delete().eq("id", id));
    },

    async purgeLogs(days) {
      return Number(check(await sb.rpc("purge_logs", { p_days: days })) ?? 0);
    },

    async logClientError(r) {
      try {
        await sb.rpc("log_client_error", { p_message: r.message, p_stack: r.stack ?? null, p_url: r.url, p_user_agent: r.userAgent });
      } catch {
        /* reporting must never cause another error */
      }
    },

    async listDocuments() {
      const rows = check(await sb.from("documents").select("*").order("created_at", { ascending: false }));
      return (rows ?? []) as DocumentItem[];
    },

    async uploadDocument(file, title, description) {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-80);
      const path = `${Date.now()}-${safe}`;
      check(await sb.storage.from("documents").upload(path, file, { contentType: file.type, upsert: false }));
      const res = await sb.from("documents").insert({
        title: title.trim(),
        description: description.trim() || null,
        storage_path: path,
        file_name: file.name,
        content_type: file.type || "application/octet-stream",
        size_bytes: file.size,
        uploaded_by: await uid(),
      });
      if (res.error) {
        await sb.storage.from("documents").remove([path]);
        throw new Error(res.error.message);
      }
    },

    async getDocumentUrl(doc) {
      const data = check(await sb.storage.from("documents").createSignedUrl(doc.storage_path, 60 * 60)) as { signedUrl: string };
      return data.signedUrl;
    },

    async deleteDocument(doc) {
      check(await sb.from("documents").delete().eq("id", doc.id));
      await sb.storage.from("documents").remove([doc.storage_path]);
    },

    async sendFeedback(rating, message) {
      check(await sb.from("feedback").insert({ user_id: await uid(), rating, message: message.trim() }));
    },

    async listFeedback() {
      const rows = check(await sb.from("feedback").select("*").order("created_at", { ascending: false }));
      return (rows ?? []) as FeedbackItem[];
    },

    async listMembers() {
      const [p, r, a] = await Promise.all([
        sb.from("profiles").select("*").order("full_name").range(0, 4999),
        sb.from("leader_roles").select("*").in("status", ["pending", "approved"]),
        sb.from("admins").select("user_id"),
      ]);
      const profiles = (check(p) ?? []) as Profile[];
      const roles = (check(r) ?? []) as LeaderRole[];
      const admins = new Set(((check(a) ?? []) as { user_id: string }[]).map((x) => x.user_id));
      return profiles.map<MemberRow>((pr) => ({
        ...pr,
        roles: roles.filter((x) => x.user_id === pr.id),
        isAdmin: admins.has(pr.id),
      }));
    },

    async setAdmin(userId, isAdmin) {
      check(await sb.rpc("set_admin", { p_user_id: userId, p_is_admin: isAdmin }));
    },

    async addInstitution(countyId, name) {
      check(await sb.from("institutions").insert({ county_id: countyId, name: name.trim() }));
    },

    async listLiveBanners() {
      const rows = (check(await sb.from("home_banners").select("*").order("starts_at")) ?? []) as HomeBanner[];
      // Admins can read hidden/past banners too, so apply the public rule here as well.
      return rows.filter((b) => isBannerLive(b));
    },

    async listAllBanners() {
      const rows = check(await sb.from("home_banners").select("*").order("starts_at", { ascending: false }));
      return (rows ?? []) as HomeBanner[];
    },

    async saveBanner(input, id) {
      if (id) check(await sb.from("home_banners").update(input).eq("id", id));
      else check(await sb.from("home_banners").insert(input));
    },

    async deleteBanner(id) {
      check(await sb.from("home_banners").delete().eq("id", id));
    },
  };
}
