export interface Creator {
  id: string;
  phone?: string;
  phone_verified_at?: string | null;
  email?: string;
  email_verified_at?: string | null;
  has_password?: boolean;
  display_name: string;
  avatar: string | null;
  bio: string | null;
  tags: string[];
  city: string | null;
  gender?: string | null;
  sexual_orientation?: string | null;
  preferred_story_lines?: string[];
  role?: string;
  role_type: string;
  identity_roles?: string[];
  social_links: Record<string, string>;
  social_snapshots?: Record<string, SocialSnapshot>;
  wechat?: string | null;
  available_cities?: string[];
  travel_status?: string | null;
  contact_unlock_enabled?: boolean;
  contact_intent_amount?: number;
  is_visible: boolean;
  is_realname: boolean;
  reject_reason: string | null;
  created_at: string;
  verified_dm?: boolean;
  verified_shop?: boolean;
  has_pending_shop_cert?: boolean;
  has_pending_dm_cert?: boolean;
  role_preferences?: ProfileRolePreference[];
}

export interface ProfileRolePreference {
  id?: string;
  profile_id?: string;
  script_id?: string | null;
  script_name: string;
  role_name: string;
  role_gender?: string | null;
  role_tags?: string[];
  is_recommended?: boolean;
  note?: string | null;
  sort_order?: number;
}

export interface Service {
  id: string;
  creator_id: string;
  service_type: string;
  price: number;
  duration: string | null;
  description: string | null;
  is_active: boolean;
}

export interface Availability {
  id: string;
  creator_id: string;
  date: string;
  start_time: string;
  end_time: string;
  city: string | null;
  location: string | null;
  is_booked: boolean;
  note: string | null;
  source?: 'manual' | 'juzhanggui' | 'screenshot' | string | null;
  source_id?: string | null;
  source_payload?: Record<string, unknown> | null;
}

export interface Portfolio {
  id: string;
  creator_id: string;
  image_url: string;
  caption: string | null;
  created_at: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
}

export interface AuthData {
  id: string;
  display_name: string;
  phone?: string;
  phone_verified_at?: string | null;
  email?: string;
  email_verified_at?: string | null;
  has_password?: boolean;
  token: string;
  role: string;
  role_type?: string;
  identity_roles?: string[];
  verified_shop?: boolean;
  verified_dm?: boolean;
}

export type CarpoolSubsidyType = 'none' | 'half_price' | 'free_ticket' | 'discount' | 'a_subsidy' | 'fixed_deduct' | 'custom';

export interface ScriptRoleCatalogItem {
  id?: string;
  target_id: string;
  role_name: string;
  gender?: string | null;
  tags?: string[];
  role_kind?: string | null;
  role_source?: 'player' | 'actor';
  rating_avg?: number | null;
  rating_count?: number | null;
}

export interface ScriptCatalogItem {
  id: string;
  name: string;
  credits?: Record<string, string[]>;
  player_roles: ScriptRoleCatalogItem[];
  actor_roles?: ScriptRoleCatalogItem[];
  duration_minutes?: number | null;
  min_duration_hours?: number | null;
  max_duration_hours?: number | null;
  rating_avg?: number | null;
  rating_count?: number | null;
}

export interface StoreCatalogItem {
  id: string;
  name: string;
  city?: string | null;
  address?: string | null;
}

export interface SocialSnapshot {
  url: string;
  title?: string;
  description?: string;
  platform?: string;
  captured_at?: string;
}

export interface Commission {
  id: string;
  poster_id: string;
  poster_name: string;
  poster_is_realname: boolean;
  title: string;
  content: string;
  script_id?: string | null;
  script_name?: string | null;
  desired_role: string | null;
  target_type: string | null;
  needed_date: string | null;
  city: string | null;
  location: string | null;
  budget: string | null;
  contact_note: string | null;
  ai_assist_context?: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected' | 'closed';
  reject_reason: string | null;
  is_expired?: boolean;
  created_at: string;
}

export interface CommissionApplication {
  id: string;
  commission_id: string;
  applicant_id: string;
  applicant_name: string;
  applicant_is_realname: boolean;
  letter: string;
  status: 'submitted' | 'accepted' | 'rejected';
  created_at: string;
  commission?: Pick<Commission, 'id' | 'title' | 'city' | 'needed_date'> | null;
}

export interface Carpool {
  id: string;
  poster_id: string;
  poster_name: string;
  poster_is_realname: boolean;
  title: string;
  city: string;
  event_date: string;
  start_time: string | null;
  deadline_date: string | null;
  deadline_time: string | null;
  script_id?: string | null;
  script_name: string;
  role_name: string | null;
  role_note: string | null;
  script_roles?: CarpoolRole[];
  seated_roles?: CarpoolRole[];
  store_id?: string | null;
  store_name: string | null;
  store_city: string | null;
  store_address: string | null;
  store_source_url: string | null;
  store_verify_note: string | null;
  store_suggestion_status: 'none' | 'pending' | 'linked';
  subsidy_mode: 'none' | 'asking' | 'offering';
  subsidy_type: CarpoolSubsidyType;
  subsidy_amount: number;
  subsidy_discount: number | null;
  subsidy_note: string | null;
  needed_count: number;
  joined_count: number;
  leader_contact: string | null;
  contact_note: string | null;
  content: string;
  boost_amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'closed';
  reject_reason: string | null;
  juzhanggui_sync_status: 'pending' | 'synced' | 'failed' | 'disabled';
  juzhanggui_schedule_id: string | null;
  ai_assist_context?: Record<string, unknown>;
  applications?: CarpoolApplication[];
  is_expired?: boolean;
  created_at: string;
}

export interface CarpoolRole {
  role_name: string;
  gender?: string | null;
  tags?: string[];
  status?: 'needed' | 'seated';
  player_name?: string | null;
  player_gender?: string | null;
}

export interface CarpoolApplication {
  id: string;
  carpool_id: string;
  applicant_id: string;
  applicant_name: string;
  applicant_is_realname: boolean;
  applicant_avatar?: string | null;
  applicant_gender?: string | null;
  role_name: string | null;
  role_gender?: string | null;
  message: string;
  status: 'submitted' | 'accepted' | 'rejected';
  created_at: string;
  carpool?: Pick<Carpool, 'id' | 'title' | 'city' | 'event_date'> | null;
}

export interface Certification {
  id: string;
  profile_id: string;
  type: 'realname' | 'dm' | 'shop';
  status: 'pending' | 'approved' | 'rejected';
  files: { name: string; url: string }[];
  description: string | null;
  reject_reason: string | null;
  created_at: string;
  updated_at: string;
  profile?: {
    display_name: string;
    phone: string;
  };
}
