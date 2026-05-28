-- 拼车区 MVP：收集城市 / 日期 / 本名 / 角色 / 补贴数据，后续对接剧司辰拼车日历。

CREATE TABLE IF NOT EXISTS lc_carpools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poster_id uuid NOT NULL REFERENCES lc_profiles(id) ON DELETE CASCADE,
  poster_name text NOT NULL,
  poster_is_realname boolean NOT NULL DEFAULT false,
  title text NOT NULL,
  city text NOT NULL,
  event_date date NOT NULL,
  start_time text,
  deadline_date date,
  deadline_time text,
  script_name text NOT NULL,
  role_name text,
  role_note text,
  store_name text,
  store_city text,
  store_address text,
  store_source_url text,
  store_verify_note text,
  store_suggestion_status text NOT NULL DEFAULT 'none'
    CHECK (store_suggestion_status IN ('none', 'pending', 'linked')),
  subsidy_mode text NOT NULL DEFAULT 'none'
    CHECK (subsidy_mode IN ('none', 'asking', 'offering')),
  subsidy_amount integer NOT NULL DEFAULT 0 CHECK (subsidy_amount >= 0),
  needed_count integer NOT NULL DEFAULT 1 CHECK (needed_count >= 1 AND needed_count <= 20),
  joined_count integer NOT NULL DEFAULT 0 CHECK (joined_count >= 0),
  leader_contact text,
  contact_note text,
  content text NOT NULL,
  boost_amount integer NOT NULL DEFAULT 0 CHECK (boost_amount >= 0),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'closed')),
  reject_reason text,
  juzhanggui_sync_status text NOT NULL DEFAULT 'pending'
    CHECK (juzhanggui_sync_status IN ('pending', 'synced', 'failed', 'disabled')),
  juzhanggui_schedule_id text,
  ai_assist_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lc_carpools_public_idx
  ON lc_carpools(status, city, event_date, boost_amount DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS lc_carpools_poster_idx
  ON lc_carpools(poster_id, created_at DESC);

CREATE INDEX IF NOT EXISTS lc_carpools_script_city_idx
  ON lc_carpools(script_name, city, event_date DESC);

CREATE TABLE IF NOT EXISTS lc_carpool_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carpool_id uuid NOT NULL REFERENCES lc_carpools(id) ON DELETE CASCADE,
  applicant_id uuid NOT NULL REFERENCES lc_profiles(id) ON DELETE CASCADE,
  applicant_name text NOT NULL,
  applicant_is_realname boolean NOT NULL DEFAULT false,
  role_name text,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'accepted', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(carpool_id, applicant_id)
);

CREATE INDEX IF NOT EXISTS lc_carpool_applications_owner_idx
  ON lc_carpool_applications(carpool_id, created_at DESC);

CREATE INDEX IF NOT EXISTS lc_carpool_applications_applicant_idx
  ON lc_carpool_applications(applicant_id, created_at DESC);
