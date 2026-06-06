-- 公众举报临时折叠与社区观察员众审建议。
--
-- 设计口径：
-- 1. 举报和众审只产生治理信号，不直接替代平台最终审核责任。
-- 2. 高风险举报可以触发临时折叠，管理员复核后恢复或正式下架。
-- 3. 社区观察员只能提交建议，不能直接通过、下架、封号或改判。

ALTER TABLE public.lc_reports
  ADD COLUMN IF NOT EXISTS risk_level text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS auto_action text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS auto_action_reason text,
  ADD COLUMN IF NOT EXISTS auto_action_at timestamptz,
  ADD COLUMN IF NOT EXISTS target_status_before text,
  ADD COLUMN IF NOT EXISTS target_status_after text,
  ADD COLUMN IF NOT EXISTS report_group_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS reporter_trust_score integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS reviewer_summary jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lc_reports_risk_level_check'
  ) THEN
    ALTER TABLE public.lc_reports
      ADD CONSTRAINT lc_reports_risk_level_check
      CHECK (risk_level IN ('normal', 'high', 'urgent'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lc_reports_auto_action_check'
  ) THEN
    ALTER TABLE public.lc_reports
      ADD CONSTRAINT lc_reports_auto_action_check
      CHECK (auto_action IN ('none', 'temporary_hidden', 'queued_priority'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS lc_reports_auto_action_idx
  ON public.lc_reports(auto_action, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS lc_reports_target_status_idx
  ON public.lc_reports(target_type, target_id, status, auto_action);

CREATE TABLE IF NOT EXISTS public.lc_moderation_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL
    CHECK (target_type IN ('carpool', 'ranking', 'comment', 'commission', 'profile')),
  target_id uuid NOT NULL,
  reviewer_id uuid NOT NULL REFERENCES public.lc_profiles(id) ON DELETE CASCADE,
  reviewer_name text NOT NULL,
  reviewer_role text NOT NULL DEFAULT 'community_observer',
  decision text NOT NULL
    CHECK (decision IN ('safe', 'hide', 'needs_more_evidence', 'privacy_risk', 'legal_risk', 'duplicate', 'unclear')),
  risk_labels text[] NOT NULL DEFAULT '{}'::text[],
  note text,
  target_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'retracted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(target_type, target_id, reviewer_id)
);

ALTER TABLE public.lc_moderation_reviews ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON TABLE public.lc_moderation_reviews TO service_role;

CREATE INDEX IF NOT EXISTS lc_moderation_reviews_target_idx
  ON public.lc_moderation_reviews(target_type, target_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS lc_moderation_reviews_reviewer_idx
  ON public.lc_moderation_reviews(reviewer_id, created_at DESC);
