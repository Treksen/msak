import type { SupabaseClient } from "@supabase/supabase-js";
import type { Api } from "./api";
import { isBannerLive } from "./banners";
import type {
  Announcement,
  Church,
  ChurchReport,
  PastRole,
  PublicPastLeader,
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

    profilePhotoUrl(path) {
      return path ? sb.storage.from("profile-photos").getPublicUrl(path).data.publicUrl : null;
    },

    async uploadProfilePhoto(file) {
      const id = await uid();
      const old = (check(await sb.from("profiles").select("photo_path").eq("id", id).maybeSingle()) as { photo_path: string | null } | null)
        ?.photo_path;
      const path = `${id}/${crypto.randomUUID()}.jpg`;
      check(await sb.storage.from("profile-photos").upload(path, file, { contentType: "image/jpeg", upsert: false, cacheControl: "31536000" }));
      try {
        check(await sb.from("profiles").update({ photo_path: path }).eq("id", id));
      } catch (e) {
        await sb.storage.from("profile-photos").remove([path]);
        throw e;
      }
      if (old) await sb.storage.from("profile-photos").remove([old]); // tidy up; ignore failures
    },

    async removeProfilePhoto() {
      const id = await uid();
      const old = (check(await sb.from("profiles").select("photo_path").eq("id", id).maybeSingle()) as { photo_path: string | null } | null)
        ?.photo_path;
      check(await sb.from("profiles").update({ photo_path: null }).eq("id", id));
      if (old) await sb.storage.from("profile-photos").remove([old]);
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

    async reviewMember(memberId, approve, note) {
      check(await sb.rpc("review_member", { p_member: memberId, p_approve: approve, p_note: note ?? null }));
    },

    async countPendingMembers() {
      const { data: auth } = await sb.auth.getUser();
      let q = sb.from("profiles").select("id", { count: "exact", head: true }).eq("verification", "pending");
      if (auth.user) q = q.neq("id", auth.user.id);
      const { count, error } = await q;
      if (error) throw error;
      return count ?? 0;
    },

    async removeDeclinedAccount(memberId) {
      check(await sb.rpc("remove_declined_account", { p_member: memberId }));
    },

    async purgeDeclinedAccounts() {
      return Number(check(await sb.rpc("purge_declined_accounts")) ?? 0);
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

    async listMembers(opts = {}) {
      const [p, r, a, e] = await Promise.all([
        sb.from("profiles").select("*").order("full_name").range(0, 4999),
        sb.from("leader_roles").select("*").in("status", ["pending", "approved"]),
        sb.from("admins").select("user_id"),
        opts.emails ? sb.rpc("admin_member_emails") : Promise.resolve({ data: [], error: null }),
      ]);
      // confirmed past leadership (readable by active leaders and admins; empty for others)
      const past = await sb.from("past_roles").select("*").eq("status", "confirmed");
      const pastRows = ((past.error ? [] : past.data) ?? []) as PastRole[];
      // If the email function isn't in the database yet (migration 11), still show the members — just without emails.
      const emailsMissing = !!opts.emails && !!e.error;
      const emails = new Map((((e.error ? [] : e.data) ?? []) as { id: string; email: string }[]).map((x) => [x.id, x.email]));
      const profiles = (check(p) ?? []) as Profile[];
      const roles = (check(r) ?? []) as LeaderRole[];
      const admins = new Set(((check(a) ?? []) as { user_id: string }[]).map((x) => x.user_id));
      return profiles.map<MemberRow>((pr) => ({
        ...pr,
        roles: roles.filter((x) => x.user_id === pr.id),
        isAdmin: admins.has(pr.id),
        email: opts.emails && !emailsMissing ? (emails.get(pr.id) ?? null) : undefined,
        pastRoles: pastRows.filter((x) => x.user_id === pr.id),
      }));
    },

    async listPastRoles() {
      return (check(await sb.from("past_roles").select("*").order("to_year", { ascending: false }).limit(2000)) ?? []) as PastRole[];
    },

    async addPastRole(i) {
      check(
        await sb.rpc("add_past_role", {
          p_level: i.level,
          p_institution_id: i.institution_id,
          p_association_id: i.association_id,
          p_position: i.position,
          p_from: i.from_year,
          p_to: i.to_year,
          p_show_publicly: i.show_publicly,
        }),
      );
    },

    async updatePastRole(id, i) {
      check(
        await sb.rpc("update_past_role", {
          p_id: id,
          p_level: i.level,
          p_institution_id: i.institution_id,
          p_association_id: i.association_id,
          p_position: i.position,
          p_from: i.from_year,
          p_to: i.to_year,
        }),
      );
      if (i.level !== "institutional") check(await sb.rpc("set_past_role_public", { p_id: id, p_show: i.show_publicly }));
    },

    async updateLeaderRequest(id, position) {
      check(await sb.rpc("update_leader_request", { p_role_id: id, p_position: position }));
    },

    async withdrawLeaderRequest(id) {
      check(await sb.rpc("withdraw_leader_request", { p_role_id: id }));
    },

    async removePastRole(id) {
      check(await sb.rpc("remove_past_role", { p_id: id }));
    },

    async setPastRolePublic(id, show) {
      check(await sb.rpc("set_past_role_public", { p_id: id, p_show: show }));
    },

    async reviewPastRole(id, confirm, note) {
      check(await sb.rpc("review_past_role", { p_id: id, p_confirm: confirm, p_note: note ?? null }));
    },

    async adminHidePastRole(id, hidden) {
      check(await sb.rpc("admin_hide_past_role", { p_id: id, p_hidden: hidden }));
    },

    async getPastLeadersPublic() {
      const { data, error } = await sb.from("site_settings").select("value").eq("key", "past_leaders_public").maybeSingle();
      if (error) return true; // setting not set up yet: page stays on
      return data ? data.value !== false : true;
    },

    async setPastLeadersPublic(on) {
      check(await sb.from("site_settings").upsert({ key: "past_leaders_public", value: on, updated_at: new Date().toISOString() }));
    },

    async publicPastLeaders() {
      return (check(await sb.rpc("public_past_leaders")) ?? []) as PublicPastLeader[];
    },

    async adminUpdateProfile(id, p) {
      check(
        await sb.rpc("admin_update_profile", {
          p_member: id,
          p_full_name: p.full_name,
          p_gender: p.gender,
          p_phone: p.phone,
          p_institution_id: p.institution_id,
          p_course: p.course,
          p_admission_year: p.admission_year,
          p_year_of_study: p.year_of_study,
          p_expected_completion_year: p.expected_completion_year,
          p_verification: p.verification,
        }),
      );
    },
    async adminDeleteMember(id) {
      check(await sb.rpc("admin_delete_member", { p_member: id }));
    },
    async adminAssignRole(memberId, r) {
      check(
        await sb.rpc("admin_assign_role", {
          p_member: memberId,
          p_level: r.level,
          p_position: r.position,
          p_association_id: r.association_id,
          p_institution_id: r.institution_id,
          p_term_ends_on: r.term_ends_on,
        }),
      );
    },
    async adminUpdateRole(roleId, r) {
      check(
        await sb.rpc("admin_update_role", {
          p_role_id: roleId,
          p_level: r.level,
          p_position: r.position,
          p_association_id: r.association_id,
          p_institution_id: r.institution_id,
          p_status: r.status,
          p_term_ends_on: r.term_ends_on,
        }),
      );
    },
    async adminDeleteRole(roleId) {
      check(await sb.rpc("admin_delete_role", { p_role_id: roleId }));
    },
    async adminUpdatePastRole(id, i) {
      check(
        await sb.rpc("admin_update_past_role", {
          p_id: id,
          p_level: i.level,
          p_institution_id: i.institution_id,
          p_association_id: i.association_id,
          p_position: i.position,
          p_from: i.from_year,
          p_to: i.to_year,
          p_status: i.status,
          p_show_publicly: i.show_publicly,
        }),
      );
    },
    async updateAnnouncement(id, title, body) {
      check(await sb.from("announcements").update({ title: title.trim(), body: body.trim() }).eq("id", id));
    },
    async updateDocument(id, title, description) {
      check(await sb.from("documents").update({ title: title.trim(), description: description.trim() || null }).eq("id", id));
    },
    async deleteFeedback(id) {
      check(await sb.from("feedback").delete().eq("id", id));
    },
    async deleteChurchReport(id) {
      check(await sb.from("church_reports").delete().eq("id", id));
    },
    async addAssociation(code, name) {
      check(await sb.from("associations").insert({ code: code.trim().toUpperCase(), name: name.trim() }));
    },
    async updateAssociation(id, code, name) {
      check(await sb.from("associations").update({ code: code.trim().toUpperCase(), name: name.trim() }).eq("id", id));
    },
    async deleteAssociation(id) {
      check(await sb.from("associations").delete().eq("id", id));
    },
    async addCounty(associationId, name) {
      check(await sb.from("counties").insert({ association_id: associationId, name: name.trim() }));
    },
    async updateCounty(id, associationId, name) {
      check(await sb.from("counties").update({ association_id: associationId, name: name.trim() }).eq("id", id));
    },
    async deleteCounty(id) {
      check(await sb.from("counties").delete().eq("id", id));
    },
    async updateInstitution(id, countyId, name) {
      check(await sb.from("institutions").update({ county_id: countyId, name: name.trim() }).eq("id", id));
    },
    async deleteInstitution(id) {
      check(await sb.from("institutions").delete().eq("id", id));
    },

    async adminChangeEmail(memberId, email) {
      check(await sb.rpc("admin_change_email", { p_member: memberId, p_email: email }));
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
