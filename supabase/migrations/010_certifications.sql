CREATE TABLE IF NOT EXISTS lc_certifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES lc_profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('dm', 'shop')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  files jsonb DEFAULT '[]',
  description text,
  reject_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lc_certifications_profile_idx ON lc_certifications(profile_id);
CREATE INDEX IF NOT EXISTS lc_certifications_status_idx ON lc_certifications(status, created_at DESC);

ALTER TABLE lc_certifications ENABLE ROW LEVEL SECURITY;

ALTER TABLE lc_profiles ADD COLUMN IF NOT EXISTS verified_dm boolean NOT NULL DEFAULT false;
ALTER TABLE lc_profiles ADD COLUMN IF NOT EXISTS verified_shop boolean NOT NULL DEFAULT false;
