// Shared data shapes. These mirror the tables in supabase/01_schema.sql.

export type Association = { id: number; code: string; name: string };
export type County = { id: number; association_id: number; name: string };
export type Institution = { id: number; county_id: number; name: string };

export type Directory = {
  associations: Association[];
  counties: County[];
  institutions: Institution[];
};

export type Gender = "Male" | "Female";

export type Profile = {
  id: string;
  full_name: string;
  gender: Gender;
  phone: string;
  institution_id: number;
  course: string;
  admission_year: number;
  year_of_study: number;
  expected_completion_year: number;
  terms_accepted_at: string;
  created_at: string;
  /** Confirmed by a campus/regional leader as a real student. New sign-ups start as "pending". */
  verification: Verification;
  verified_at: string | null;
  verification_note: string | null;
  /** Profile photo: a storage path (live) or an image data link (demo). */
  photo_path?: string | null;
};

export type Verification = "pending" | "verified" | "declined";

export type ProfilePatch = Partial<
  Pick<
    Profile,
    | "full_name"
    | "gender"
    | "phone"
    | "institution_id"
    | "course"
    | "admission_year"
    | "year_of_study"
    | "expected_completion_year"
  >
>;

export type LeaderLevel = "institutional" | "regional" | "national";
export type RoleStatus = "pending" | "approved" | "rejected" | "revoked";

export type LeaderRole = {
  id: string;
  user_id: string;
  level: LeaderLevel;
  position: string;
  association_id: number | null;
  institution_id: number | null;
  status: RoleStatus;
  requested_at: string;
  reviewed_at: string | null;
  review_note: string | null;
  /** Approved roles are active until this date (31 August); then they must be renewed. */
  term_ends_on: string | null;
  /** Set while a renewal for the next year is waiting for approval. */
  renewal_requested_at: string | null;
};

/** A role plus the person who holds or requested it (for reviewers). */
export type LeaderRoleWithPerson = LeaderRole & {
  person: { full_name: string; phone: string; institution_id: number } | null;
};

export type Me = {
  userId: string;
  email: string | null;
  profile: Profile | null;
  roles: LeaderRole[];
  isAdmin: boolean;
};

export type Audience = LeaderLevel | "alumni";

export type Announcement = {
  id: string;
  author_id: string | null;
  author_name: string;
  author_title: string;
  audience: Audience;
  association_id: number | null;
  institution_id: number | null;
  title: string;
  body: string;
  created_at: string;
};

export type NewAnnouncement = {
  audience: Audience;
  title: string;
  body: string;
  /** Only used when an administrator posts without a leader role. */
  association_id?: number | null;
  institution_id?: number | null;
};

export type ChurchStatus = "published" | "suggested" | "rejected";

export type Church = {
  id: string;
  name: string;
  fellowship: string;
  association_id: number;
  county_id: number | null;
  place: string;
  lat: number;
  lng: number;
  location_verified: boolean;
  phone: string | null;
  email: string | null;
  contact_person: string | null;
  service_times: string | null;
  maps_url: string | null;
  photo_url: string | null;
  notes: string | null;
  status: ChurchStatus;
  created_by: string | null;
  created_by_name: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ChurchInput = Pick<
  Church,
  | "name"
  | "fellowship"
  | "association_id"
  | "county_id"
  | "place"
  | "lat"
  | "lng"
  | "location_verified"
  | "phone"
  | "email"
  | "contact_person"
  | "service_times"
  | "maps_url"
  | "photo_url"
  | "notes"
  | "status"
>;

export type DocumentItem = {
  id: string;
  title: string;
  description: string | null;
  storage_path: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
};

export type FeedbackItem = {
  id: string;
  user_id: string;
  rating: number;
  message: string;
  created_at: string;
};

export type MemberRow = Profile & {
  roles: LeaderRole[];
  isAdmin: boolean;
  /** Login email — filled in for administrators only. */
  email?: string | null;
  /** Confirmed past leadership (shown to leaders and admins). */
  pastRoles?: PastRole[];
};

export type Stats = { associations: number; counties: number; institutions: number; churches: number };

export type SignUpInput = {
  email: string;
  password: string;
  full_name: string;
  gender: Gender;
  phone: string;
  institution_id: number;
  course: string;
  admission_year: number;
  year_of_study: number;
  expected_completion_year: number;
  leader_level: LeaderLevel | null;
  leader_position: string | null;
};

export type DemoPersona = "member" | "newcomer" | "institutional" | "regional" | "national" | "admin";

/** Event strip with a countdown on the homepage (managed by administrators). */
export type HomeBanner = {
  id: string;
  title: string;
  venue: string | null;
  starts_at: string;
  ends_at: string | null;
  link_url: string | null;
  link_label: string | null;
  is_active: boolean;
  created_at: string;
};

export type HomeBannerInput = Pick<HomeBanner, "title" | "venue" | "starts_at" | "ends_at" | "link_url" | "link_label" | "is_active">;

/** A member's note that a church's details are wrong. */
export type ChurchReport = {
  id: string;
  church_id: string;
  reporter_id: string | null;
  message: string;
  status: "open" | "resolved";
  created_at: string;
  resolved_at: string | null;
};

/** Every figure on the admin dashboard (one database call). */
export type AdminDashboard = {
  members: number;
  students: number;
  alumni: number;
  by_association: {
    association_id: number;
    code: string;
    name: string;
    students: number;
    alumni: number;
    churches: number;
    churches_confirmed: number;
  }[];
  /** Last 12 months, oldest first; month = "YYYY-MM". */
  signups: { month: string; count: number }[];
  leaders: { national: number; regional: number; institutional: number; waiting: number; expired: number };
  churches_suggested: number;
  open_reports: number;
  errors_7d: number;
  activity_7d: number;
};

/** One entry in the activity (audit) log. */
export type AuditEntry = {
  id: number;
  at: string;
  actor_id: string | null;
  actor_label: string;
  action: "insert" | "update" | "delete";
  entity: string;
  entity_id: string | null;
  summary: string | null;
  changes: Record<string, unknown> | null;
};

/** One app error reported from someone's browser. */
export type ErrorEntry = {
  id: number;
  at: string;
  user_id: string | null;
  message: string;
  stack: string | null;
  url: string | null;
  user_agent: string | null;
};

export type ClientErrorReport = { message: string; stack?: string | null; url: string; userAgent: string };

/** A leadership position someone held before; a leader confirms it. History only — no posting rights. */
export type PastRole = {
  id: string;
  user_id: string;
  level: LeaderLevel;
  association_id: number | null;
  institution_id: number | null;
  position: string;
  from_year: number;
  to_year: number;
  status: "pending" | "confirmed" | "declined";
  show_publicly: boolean;
  /** An administrator hid it from the public page (the member can't undo this). */
  hidden_by_admin: boolean;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type PastRoleInput = {
  level: LeaderLevel;
  association_id: number | null;
  institution_id: number | null;
  position: string;
  from_year: number;
  to_year: number;
  show_publicly: boolean;
};

/** One line on the public Past leaders page. */
export type PublicPastLeader = {
  full_name: string;
  level: "regional" | "national";
  association_code: string | null;
  association_name: string | null;
  title: string;
  from_year: number;
  to_year: number;
};

/** Everything an administrator can change on a member's profile. */
export type AdminProfilePatch = {
  full_name: string;
  gender: Gender;
  phone: string;
  institution_id: number;
  course: string;
  admission_year: number;
  year_of_study: number;
  expected_completion_year: number;
  verification: Verification;
};

/** A current leader role as an administrator sets it. */
export type AdminRoleInput = {
  level: LeaderLevel;
  position: string;
  association_id: number | null;
  institution_id: number | null;
  status: LeaderRole["status"];
  term_ends_on: string | null;
};
