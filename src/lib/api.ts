import type {
  Announcement,
  Church,
  ChurchInput,
  ChurchReport,
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

  listMembers(): Promise<MemberRow[]>;
  setAdmin(userId: string, isAdmin: boolean): Promise<void>;
  addInstitution(countyId: number, name: string): Promise<void>;

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
  return message;
}
