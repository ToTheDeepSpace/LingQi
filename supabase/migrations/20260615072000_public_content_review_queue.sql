CREATE TABLE IF NOT EXISTS lc_public_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL,
  profile_id uuid REFERENCES lc_profiles(id) ON DELETE SET NULL,
  profile_name text,
  title text,
  summary text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  moderation_precheck jsonb,
  reviewed_by uuid REFERENCES lc_profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lc_public_reviews_status_created
  ON lc_public_reviews(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lc_public_reviews_profile_created
  ON lc_public_reviews(profile_id, created_at DESC);
