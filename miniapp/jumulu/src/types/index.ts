export type ApiEnvelope<T> = { success: boolean; data: T; error?: string | { message?: string }; code?: string; details?: Record<string, unknown> }

export type AuthSession = {
  id: string
  token: string
  display_name: string
  avatar?: string | null
  phone?: string | null
  phone_verified_at?: string | null
  email?: string | null
  email_verified_at?: string | null
  city?: string | null
  role?: string
  auth_provider?: string
  account_merged?: boolean
}

export type AccountStatus = {
  state: 'active' | 'restricted' | 'merged'
  message?: string
  reauthenticate?: boolean
  unread_count?: number
  restriction?: {
    id?: string | null
    scope: 'publish' | 'account'
    reason: string
    starts_at?: string | null
    ends_at?: string | null
  } | null
  appeal?: {
    id: string
    content: string
    evidence_urls?: string[]
    status: 'pending' | 'needs_info' | 'approved' | 'rejected' | 'withdrawn'
    admin_reply?: string | null
    created_at: string
  } | null
}

export type RatingSummary = {
  avg: number | null
  review_count: number
  player_count: number
  sample_status: 'insufficient' | 'stable'
}

export type DossierPhoto = {
  url: string
  name?: string
  caption?: string | null
  focus_x?: number | null
  focus_y?: number | null
}

export type Dossier = {
  id: string
  entity_type?: 'dm' | 'store'
  dm_name: string
  city?: string | null
  workplace?: string | null
  employment_status?: string | null
  employer_store_id?: string | null
  affiliation?: { store_dossier_id?: string | null; store_name?: string | null; status?: string; source?: string } | null
  photo_url?: string | null
  photo_focus_x?: number | null
  photo_focus_y?: number | null
  photo_files?: DossierPhoto[]
  note?: string | null
  bio?: string | null
  tags?: string[]
  rating_tags?: string[]
  common_scripts?: Array<{ id?: string; name: string }>
  claim_status?: string
  birth_year?: number | null
  height_cm?: number | null
  weight_kg?: number | null
  mbti?: string | null
  zodiac?: string | null
  dm_started_month?: string | null
  created_at?: string | null
  rating_summary?: RatingSummary
}

export type NewDossierDraft = {
  entityType: 'dm' | 'store'
  name: string
  city: string
  workplace: string
  employmentStatus: 'unknown' | 'freelance'
  photoUrl: string
  note: string
  tags: string[]
}

export type DossierRating = {
  id: string
  profile_id?: string | null
  profile_name: string
  script_name: string
  store_name?: string
  store_dossier_id?: string | null
  played_on?: string
  visited_on?: string
  replay_number?: number
  rating: number
  content: string
  tags?: string[]
  created_at?: string
  official_response?: { content?: string; author_name?: string } | null
  follow_ups?: Array<{ id: string; content: string; author_name?: string }>
}

export type DossierDetail = {
  dossier: Dossier
  summary: RatingSummary
  ratings: DossierRating[]
}

export type RankingFile = { name?: string; url: string; type?: string; size?: number }

export type Ranking = {
  id: string
  type: 'red' | 'black' | 'white'
  subject_name: string
  subject_type?: string
  subject_city?: string | null
  subject_dossier_id?: string | null
  event_date?: string | null
  event_script_name?: string | null
  event_store_name?: string | null
  content: string
  display_files?: RankingFile[]
  author_name?: string
  poster_id?: string | null
  likes?: number
  dislikes?: number
  joys?: number
  agree_count?: number
  oppose_count?: number
  created_at?: string
  last_activity_at?: string
  status?: string
  reject_reason?: string | null
  pinned_comments?: RankingComment[]
  my_vote?: { id: string; vote_type: 'like' | 'dislike' | 'joy'; created_at?: string } | null
}

export type RankingComment = {
  id: string
  author_id?: string | null
  author_name?: string
  content: string
  status?: string
  is_pinned?: boolean
  likes?: number
  created_at?: string
}

export type Carpool = {
  id: string
  poster_id?: string
  poster_name?: string
  title: string
  city: string
  event_date?: string | null
  start_time?: string | null
  deadline_date?: string | null
  script_name?: string | null
  role_name?: string | null
  role_note?: string | null
  needed_count?: number
  joined_count?: number
  content?: string | null
  subsidy_note?: string | null
  status?: string
  reject_reason?: string | null
  is_expired?: boolean
}

export type CarpoolApplication = {
  id: string
  carpool_id: string
  applicant_id?: string
  applicant_name?: string
  role_name?: string | null
  message?: string
  status: 'submitted' | 'accepted' | 'rejected'
  created_at?: string
  carpool?: Pick<Carpool, 'id' | 'title' | 'city' | 'event_date'> | null
}

export type Commission = {
  id: string
  poster_id?: string
  poster_name?: string
  title: string
  content: string
  script_name?: string | null
  desired_role?: string | null
  target_type?: string | null
  needed_date?: string | null
  needed_end_date?: string | null
  city?: string | null
  location?: string | null
  budget?: string | null
  contact_note?: string | null
  accept_expedition?: boolean
  has_private_contact?: boolean
  status?: string
  reject_reason?: string | null
  is_expired?: boolean
  created_at?: string
}

export type CommissionApplication = {
  id: string
  commission_id: string
  applicant_id?: string
  applicant_name?: string
  applicant_is_realname?: boolean
  letter?: string
  status: 'submitted' | 'accepted' | 'rejected'
  contacts?: { poster: string; applicant: string } | null
  created_at?: string
  commission?: Pick<Commission, 'id' | 'title' | 'city' | 'needed_date' | 'needed_end_date' | 'has_private_contact' | 'accept_expedition'> | null
}

export type PublicProfile = {
  id: string
  display_name: string
  avatar?: string | null
  city?: string | null
  bio?: string | null
  tags?: string[]
  available_cities?: string[]
  travel_status?: string | null
  commission_match?: 'local' | 'expedition' | null
}

export type ScriptRole = { target_id?: string; role_name: string; gender?: string; tags?: string[]; rating_avg?: number | null; rating_count?: number; role_kind?: string; role_source?: string }
export type Script = {
  id: string
  name: string
  city?: string | null
  duration_minutes?: number | null
  min_duration_hours?: number | null
  max_duration_hours?: number | null
  rating_avg?: number | null
  rating_count?: number
  player_roles?: ScriptRole[]
  actor_roles?: ScriptRole[]
}

export type DailyCheckin = {
  id: string
  checkin_date: string
  streak: number
  daily_reward: number
  streak_bonus: number
  reward: number
  created_at?: string
}

export type DailyCheckinTransaction = {
  id: string
  amount: number
  description: string
  metadata?: Record<string, unknown>
  created_at?: string
}

export type DailyCheckinState = {
  today: string
  checked_in: boolean
  current_streak: number
  balance: number
  bonus_balance: number
  checkins: DailyCheckin[]
  transactions: DailyCheckinTransaction[]
  claim?: {
    checkin_id: string
    checkin_date: string
    streak: number
    daily_reward: number
    streak_bonus: number
    reward: number
    balance: number
    bonus_balance: number
    applied: boolean
  } | null
}

export type RoleRating = {
  id: string
  profile_id?: string
  profile_name?: string
  rating: number
  content: string
  tags?: string[]
  review_lane?: 'experience' | 'deep_spoiler'
  created_at?: string
}
