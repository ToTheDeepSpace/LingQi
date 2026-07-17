ALTER TABLE public.lc_rankings
  ADD COLUMN IF NOT EXISTS withdrawn_at timestamptz,
  ADD COLUMN IF NOT EXISTS withdrawn_by uuid,
  ADD COLUMN IF NOT EXISTS withdrawal_reason text;

CREATE TABLE IF NOT EXISTS public.lc_ranking_edit_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ranking_id uuid NOT NULL REFERENCES public.lc_rankings(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.lc_profiles(id) ON DELETE CASCADE,
  request_kind text NOT NULL DEFAULT 'edit' CHECK (request_kind IN ('edit', 'restore')),
  before_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  proposed_patch jsonb NOT NULL DEFAULT '{}'::jsonb,
  changes jsonb NOT NULL DEFAULT '[]'::jsonb,
  change_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  moderation_precheck jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reject_reason text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS lc_ranking_edit_requests_one_pending_idx
  ON public.lc_ranking_edit_requests(ranking_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS lc_ranking_edit_requests_admin_queue_idx
  ON public.lc_ranking_edit_requests(status, created_at DESC);

CREATE INDEX IF NOT EXISTS lc_ranking_edit_requests_author_idx
  ON public.lc_ranking_edit_requests(author_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.lc_ranking_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ranking_id uuid NOT NULL REFERENCES public.lc_rankings(id) ON DELETE CASCADE,
  version_number integer NOT NULL CHECK (version_number > 0),
  source text NOT NULL CHECK (source IN ('original', 'author_edit', 'admin_edit', 'restore')),
  snapshot jsonb NOT NULL,
  changes jsonb NOT NULL DEFAULT '[]'::jsonb,
  actor_id uuid,
  edit_request_id uuid REFERENCES public.lc_ranking_edit_requests(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ranking_id, version_number)
);

CREATE INDEX IF NOT EXISTS lc_ranking_versions_public_idx
  ON public.lc_ranking_versions(ranking_id, version_number DESC);

