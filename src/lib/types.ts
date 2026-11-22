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
};

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

export type Audience = LeaderLevel;

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

export type MemberRow = Profile & { roles: LeaderRole[]; isAdmin: boolean };

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

export type DemoPersona = "member" | "institutional" | "regional" | "national" | "admin";
