-- 020: 内容后置治理与举报
--
-- 拼车、红黑白榜、评论、委托需求和公开主页共用同一张举报表；
-- 拼车是强时效内容，默认先公开，治理重心放在举报、后置下架和审计留痕。

CREATE TABLE IF NOT EXISTS lc_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL
    CHECK (target_type IN ('carpool', 'ranking', 'comment', 'commission', 'profile')),
  target_id uuid NOT NULL,
  target_title text,
  reporter_id uuid NOT NULL REFERENCES lc_profiles(id) ON DELETE CASCADE,
  reporter_name text NOT NULL,
  reason text NOT NULL,
  description text,
  target_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'resolved', 'dismissed')),
  handler_id text,
  handler_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(target_type, target_id, reporter_id)
);

ALTER TABLE lc_reports ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON TABLE lc_reports TO service_role;

CREATE INDEX IF NOT EXISTS lc_reports_pending_idx
  ON lc_reports(status, created_at DESC);

CREATE INDEX IF NOT EXISTS lc_reports_target_idx
  ON lc_reports(target_type, target_id, created_at DESC);

CREATE INDEX IF NOT EXISTS lc_reports_reporter_idx
  ON lc_reports(reporter_id, created_at DESC);
