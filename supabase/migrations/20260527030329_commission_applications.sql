-- 015: 委托需求接单申请

CREATE TABLE IF NOT EXISTS lc_commission_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_id uuid REFERENCES lc_commissions(id) ON DELETE CASCADE,
  applicant_id uuid REFERENCES lc_profiles(id),
  applicant_name text NOT NULL,
  applicant_is_realname boolean DEFAULT false,
  letter text NOT NULL,
  status text DEFAULT 'submitted',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (commission_id, applicant_id)
);

ALTER TABLE lc_commission_applications ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS lc_commission_applications_commission_idx
  ON lc_commission_applications(commission_id, created_at DESC);

CREATE INDEX IF NOT EXISTS lc_commission_applications_applicant_idx
  ON lc_commission_applications(applicant_id, created_at DESC);
