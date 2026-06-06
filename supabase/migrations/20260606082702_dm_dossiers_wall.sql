-- 爱D墙 / DM 档案墙第一版
-- 玩家可以先提交未认领 DM 档案；DM 后续入驻后可认领并绑定自己的灵契主页。

CREATE TABLE IF NOT EXISTS lc_dm_dossiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dm_name text NOT NULL,
  city text,
  workplace text,
  profile_url text,
  photo_url text,
  photo_files jsonb NOT NULL DEFAULT '[]'::jsonb,
  note text,
  tags text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  submitted_by uuid REFERENCES lc_profiles(id) ON DELETE SET NULL,
  submitted_by_name text,
  claimed_by uuid REFERENCES lc_profiles(id) ON DELETE SET NULL,
  claim_status text NOT NULL DEFAULT 'unclaimed',
  claim_note text,
  approved_by uuid,
  approved_at timestamptz,
  reject_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lc_dm_dossiers_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'hidden')),
  CONSTRAINT lc_dm_dossiers_claim_status_check CHECK (claim_status IN ('unclaimed', 'pending', 'approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS lc_dm_dossiers_status_city_idx
  ON lc_dm_dossiers(status, city, created_at DESC);

CREATE INDEX IF NOT EXISTS lc_dm_dossiers_dm_name_idx
  ON lc_dm_dossiers(dm_name);

CREATE INDEX IF NOT EXISTS lc_dm_dossiers_claimed_by_idx
  ON lc_dm_dossiers(claimed_by)
  WHERE claimed_by IS NOT NULL;

ALTER TABLE lc_dm_dossiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lc_dm_dossiers_public_read_approved" ON lc_dm_dossiers;
CREATE POLICY "lc_dm_dossiers_public_read_approved"
  ON lc_dm_dossiers
  FOR SELECT
  USING (status = 'approved');
