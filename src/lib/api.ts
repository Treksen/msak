import type {
  Announcement,
  Church,
  ChurchInput,
  ChurchReport,
  AdminProfilePatch,
  AdminRoleInput,
  PastRole,
  PastRoleInput,
  PublicPastLeader,
  AdminDashboard,
  AuditEntry,
  ErrorEntry,
  ClientErrorReport,
  DemoPersona,
  Directory,
  DocumentItem,
  FeedbackItem,
  HomeBanner,
  HomeBannerInput,
  LeaderLevel,
  LeaderRoleWithPerson,
  Me,
  MemberRow,
  NewAnnouncement,
  ProfilePatch,
  SignUpInput,
  Stats,
} from "./types";
import { createSupabaseApi } from "./api-supabase";
import { createDemoApi } from "./api-demo";
import { supabase } from "./supabase";

/**
 * Everything the screens need from the backend. There are two implementations:
 *  - Supabase (real data) when VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set;
 *  - Demo (in the browser, saved to localStorage) when they are not, so the whole
 *    app can be clicked through before the backend exists.
 * Permission rules live in the database; the demo copies them closely enough to preview.
 */
export interface Api {
  mode: "supabase" | "demo";

  getDirectory(): Promise<Directory>;
  getStats(): Promise<Stats>;

  onAuthChange(cb: (userId: string | null) => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  signUp(input: SignUpInput): Promise<{ needsConfirmation: boolean }>;
  signOut(): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  demoSignInAs?(persona: DemoPersona): Promise<void>;
  demoReset?(): Promise<void>;

  getMe(): Promise<Me | null>;
  updateProfile(patch: ProfilePatch): Promise<void>;
  /** Replace your profile photo (already cropped and shrunk). */
  uploadProfilePhoto(file: Blob): Promise<void>;
  removeProfilePhoto(): Promise<void>;
  /** Link to show a stored profile photo, or null when there is none. */
  profilePhotoUrl(path: string | null | undefined): string | null;
  requestLeaderRole(level: LeaderLevel, position: string): Promise<void>;

  listLeaderRoles(): Promise<LeaderRoleWithPerson[]>;
  reviewLeaderRole(id: string, approve: boolean, note?: string): Promise<void>;
  revokeLeaderRole(id: string, note?: string): Promise<void>;
  /** Ask to renew one of your roles for the next academic year (needs approval again). */
  renewLeaderRole(id: string): Promise<void>;

  listAnnouncements(): Promise<Announcement[]>;
  postAnnouncement(input: NewAnnouncement): Promise<void>;
  deleteAnnouncement(id: string): Promise<void>;

  listChurches(): Promise<Church[]>;
  saveChurch(input: ChurchInput, id?: string): Promise<void>;
  deleteChurch(id: string): Promise<void>;
  /** Upload a church photo (already resized) and get its public https URL. */
  uploadChurchPhoto(file: Blob, associationId: number): Promise<string>;
  reportChurch(churchId: string, message: string): Promise<void>;
  /** Your own reports, plus every report for churches you manage. */
  listChurchReports(): Promise<ChurchReport[]>;
  resolveChurchReport(id: string): Promise<void>;

  listDocuments(): Promise<DocumentItem[]>;
  uploadDocument(file: File, title: string, description: string): Promise<void>;
  getDocumentUrl(doc: DocumentItem): Promise<string>;
  deleteDocument(doc: DocumentItem): Promise<void>;

  sendFeedback(rating: number, message: string): Promise<void>;
  listFeedback(): Promise<FeedbackItem[]>;

  /** Members in your scope. Administrators can ask for login emails too. */
  listMembers(opts?: { emails?: boolean }): Promise<MemberRow[]>;
  // Past leadership
  /** Your own entries, ones you can confirm, and (for active leaders) confirmed history. */
  listPastRoles(): Promise<PastRole[]>;
  addPastRole(input: PastRoleInput): Promise<void>;
  /** Edit your own entry; it goes back for confirmation. */
  updatePastRole(id: string, input: PastRoleInput): Promise<void>;
  /** Change the position title of your own leader request while it's waiting. */
  updateLeaderRequest(id: string, position: string): Promise<void>;
  /** Withdraw your own leader request while it's waiting. */
  withdrawLeaderRequest(id: string): Promise<void>;
  removePastRole(id: string): Promise<void>;
  setPastRolePublic(id: string, show: boolean): Promise<void>;
  reviewPastRole(id: string, confirm: boolean, note?: string): Promise<void>;
  /** Administrators: keep an entry off the public page whatever the member chose. */
  adminHidePastRole(id: string, hidden: boolean): Promise<void>;
  /** Is the public Past leaders page switched on? */
  getPastLeadersPublic(): Promise<boolean>;
  setPastLeadersPublic(on: boolean): Promise<void>;
  /** Public honour roll: confirmed national and regional leaders who agreed to be listed. */
  publicPastLeaders(): Promise<PublicPastLeader[]>;

  // ---- Administrators: change or delete anything ----
  adminUpdateProfile(memberId: string, patch: AdminProfilePatch): Promise<void>;
  /** Delete any member's login and profile (not administrators). */
  adminDeleteMember(memberId: string): Promise<void>;
  /** Give someone an approved role straight away. */
  adminAssignRole(memberId: string, input: AdminRoleInput): Promise<void>;
  adminUpdateRole(roleId: string, input: AdminRoleInput): Promise<void>;
  adminDeleteRole(roleId: string): Promise<void>;
  adminUpdatePastRole(id: string, input: PastRoleInput & { status: PastRole["status"] }): Promise<void>;
  updateAnnouncement(id: string, title: string, body: string): Promise<void>;
  updateDocument(id: string, title: string, description: string): Promise<void>;
  deleteFeedback(id: string): Promise<void>;
  deleteChurchReport(id: string): Promise<void>;
  addAssociation(code: string, name: string): Promise<void>;
  updateAssociation(id: number, code: string, name: string): Promise<void>;
  deleteAssociation(id: number): Promise<void>;
  addCounty(associationId: number, name: string): Promise<void>;
  updateCounty(id: number, associationId: number, name: string): Promise<void>;
  deleteCounty(id: number): Promise<void>;
  updateInstitution(id: number, countyId: number, name: string): Promise<void>;
  deleteInstitution(id: number): Promise<void>;

  /** Administrators: correct a member's login email (they keep their password). */
  adminChangeEmail(memberId: string, email: string): Promise<void>;
  setAdmin(userId: string, isAdmin: boolean): Promise<void>;
  addInstitution(countyId: number, name: string): Promise<void>;

  // Member confirmation (campus leaders, regional leaders, admins)
  /** Confirm (approve = true) or decline a new member. Declining needs a short reason. */
  reviewMember(memberId: string, approve: boolean, note?: string): Promise<void>;
  /** How many members you can confirm are waiting. */
  countPendingMembers(): Promise<number>;
  /** Admins: delete a declined member's login and profile completely. */
  removeDeclinedAccount(memberId: string): Promise<void>;
  /** Remove accounts declined more than 30 days ago. Returns how many were removed. */
  purgeDeclinedAccounts(): Promise<number>;

  // Admin dashboard and logs (admins only, except logClientError)
  adminDashboard(): Promise<AdminDashboard>;
  /** Newest first, 50 at a time; pass the last id you have as `before` to load older entries. */
  listAuditLog(opts?: { before?: number; entity?: string }): Promise<AuditEntry[]>;
  listErrorLog(opts?: { before?: number }): Promise<ErrorEntry[]>;
  deleteErrorEntry(id: number): Promise<void>;
  /** Delete activity and error entries older than `days` (at least 7). Returns how many were removed. */
  purgeLogs(days: number): Promise<number>;
  /** Anyone (even signed out) can report an app error. Never throws. */
  logClientError(report: ClientErrorReport): Promise<void>;

  /** Live banners for the homepage (anyone, logged in or not). */
  listLiveBanners(): Promise<HomeBanner[]>;
  /** Every banner, including hidden and past ones (administrators). */
  listAllBanners(): Promise<HomeBanner[]>;
  saveBanner(input: HomeBannerInput, id?: string): Promise<void>;
  deleteBanner(id: string): Promise<void>;
}

export const api: Api = supabase ? createSupabaseApi(supabase) : createDemoApi();

/** Turn any thrown value into a sentence a member can read. */
export function errorMessage(err: unknown): string {
  if (!err) return "Something went wrong.";
  if (typeof err === "string") return err;
  if (err instanceof Error) return friendly(err.message);
  if (typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string") {
    return friendly((err as { message: string }).message);
  }
  return "Something went wrong.";
}

function friendly(message: string): string {
  if (/Invalid login credentials/i.test(message)) return "That email and password don't match an account.";
  if (/Email not confirmed/i.test(message)) return "Please confirm your email first — check your inbox for the link.";
  if (/User already registered/i.test(message)) return "An account with this email already exists. Try logging in.";
  if (/Failed to fetch|NetworkError/i.test(message)) return "You seem to be offline. Check your connection and try again.";
  if (/row-level security|permission denied/i.test(message)) return "You don't have permission to do that.";
  if (/Database error saving new user/i.test(message)) return "We couldn't create your profile. Check your details and try again.";
  if (/violates foreign key constraint/i.test(message))
    return "This is still in use (members, churches, posts or roles are linked to it), so it can't be deleted. Move those first.";
  if (/duplicate key value/i.test(message)) return "That already exists.";
  return message;
}
