-- Enforce reputation voting by a verified natural-person identity.
--
-- A person may keep one stance vote (agree or oppose) and one independent joy
-- reaction per ranking. Existing votes are preserved and only receive identity
-- annotations; no vote is deleted and public counts do not change.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.lc_reputation_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lc_reputation_identity_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id uuid NOT NULL REFERENCES public.lc_reputation_identities(id) ON DELETE RESTRICT,
  credential_type text NOT NULL CHECK (credential_type IN ('phone', 'wechat_unionid')),
  credential_hash text NOT NULL CHECK (credential_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (credential_type, credential_hash)
);

CREATE INDEX IF NOT EXISTS lc_reputation_identity_credentials_identity_idx
  ON public.lc_reputation_identity_credentials(identity_id);

ALTER TABLE public.lc_profiles
  ADD COLUMN IF NOT EXISTS reputation_identity_id uuid
    REFERENCES public.lc_reputation_identities(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS lc_profiles_reputation_identity_idx
  ON public.lc_profiles(reputation_identity_id)
  WHERE reputation_identity_id IS NOT NULL;

ALTER TABLE public.lc_votes
  ADD COLUMN IF NOT EXISTS reputation_identity_id uuid
    REFERENCES public.lc_reputation_identities(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS vote_channel text;

CREATE TEMP TABLE reputation_identity_backfill (
  profile_id uuid PRIMARY KEY,
  identity_id uuid NOT NULL
) ON COMMIT DROP;

INSERT INTO reputation_identity_backfill(profile_id, identity_id)
SELECT profile.id, COALESCE(profile.reputation_identity_id, gen_random_uuid())
FROM public.lc_profiles profile
WHERE profile.merged_into IS NULL
  AND (
    (profile.phone IS NOT NULL AND profile.phone_verified_at IS NOT NULL)
    OR profile.wechat_unionid IS NOT NULL
  );

INSERT INTO public.lc_reputation_identities(id)
SELECT DISTINCT backfill.identity_id
FROM reputation_identity_backfill backfill
ON CONFLICT (id) DO NOTHING;

UPDATE public.lc_profiles profile
SET reputation_identity_id = backfill.identity_id
FROM reputation_identity_backfill backfill
WHERE profile.id = backfill.profile_id
  AND profile.reputation_identity_id IS DISTINCT FROM backfill.identity_id;

INSERT INTO public.lc_reputation_identity_credentials(identity_id, credential_type, credential_hash)
SELECT backfill.identity_id,
       'phone',
       encode(digest('reputation-phone-v1:' || profile.phone, 'sha256'), 'hex')
FROM reputation_identity_backfill backfill
JOIN public.lc_profiles profile ON profile.id = backfill.profile_id
WHERE profile.phone IS NOT NULL
  AND profile.phone_verified_at IS NOT NULL
ON CONFLICT (credential_type, credential_hash) DO NOTHING;

INSERT INTO public.lc_reputation_identity_credentials(identity_id, credential_type, credential_hash)
SELECT backfill.identity_id,
       'wechat_unionid',
       encode(digest('reputation-wechat-unionid-v1:' || profile.wechat_unionid, 'sha256'), 'hex')
FROM reputation_identity_backfill backfill
JOIN public.lc_profiles profile ON profile.id = backfill.profile_id
WHERE profile.wechat_unionid IS NOT NULL
ON CONFLICT (credential_type, credential_hash) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.lc_profiles profile
    JOIN public.lc_reputation_identity_credentials credential
      ON (
        credential.credential_type = 'phone'
        AND profile.phone IS NOT NULL
        AND profile.phone_verified_at IS NOT NULL
        AND credential.credential_hash = encode(digest('reputation-phone-v1:' || profile.phone, 'sha256'), 'hex')
      )
      OR (
        credential.credential_type = 'wechat_unionid'
        AND profile.wechat_unionid IS NOT NULL
        AND credential.credential_hash = encode(digest('reputation-wechat-unionid-v1:' || profile.wechat_unionid, 'sha256'), 'hex')
      )
    WHERE profile.merged_into IS NULL
      AND credential.identity_id IS DISTINCT FROM profile.reputation_identity_id
  ) THEN
    RAISE EXCEPTION '口碑身份回填冲突，迁移已中止且不会修改现有投票';
  END IF;
END;
$$;

UPDATE public.lc_votes vote
SET reputation_identity_id = profile.reputation_identity_id,
    vote_channel = CASE WHEN vote.vote_type = 'joy' THEN 'joy' ELSE 'stance' END
FROM public.lc_profiles profile
WHERE vote.voter_id = profile.id
  AND vote.source = 'free_vote'
  AND profile.reputation_identity_id IS NOT NULL
  AND (
    vote.reputation_identity_id IS DISTINCT FROM profile.reputation_identity_id
    OR vote.vote_channel IS DISTINCT FROM CASE WHEN vote.vote_type = 'joy' THEN 'joy' ELSE 'stance' END
  );

UPDATE public.lc_votes
SET vote_channel = CASE WHEN vote_type = 'joy' THEN 'joy' ELSE 'stance' END
WHERE source = 'free_vote'
  AND vote_channel IS NULL;

DROP INDEX IF EXISTS public.lc_votes_one_free_vote_per_user_per_ranking;

CREATE UNIQUE INDEX IF NOT EXISTS lc_votes_one_reputation_vote_per_identity_channel
  ON public.lc_votes(ranking_id, reputation_identity_id, vote_channel)
  WHERE source = 'free_vote' AND reputation_identity_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS lc_votes_one_legacy_vote_per_account_channel
  ON public.lc_votes(ranking_id, voter_id, vote_channel)
  WHERE source = 'free_vote' AND reputation_identity_id IS NULL AND voter_id IS NOT NULL;

ALTER TABLE public.lc_votes
  DROP CONSTRAINT IF EXISTS lc_votes_free_vote_channel_check;

ALTER TABLE public.lc_votes
  ADD CONSTRAINT lc_votes_free_vote_channel_check
  CHECK (
    source IS DISTINCT FROM 'free_vote'
    OR (
      reputation_identity_id IS NOT NULL
      AND vote_channel = CASE WHEN vote_type = 'joy' THEN 'joy' ELSE 'stance' END
    )
  ) NOT VALID;

ALTER TABLE public.lc_votes
  VALIDATE CONSTRAINT lc_votes_free_vote_channel_check;

CREATE OR REPLACE FUNCTION public.lc_resolve_reputation_identity(
  p_voter_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  voter record;
  phone_hash text;
  unionid_hash text;
  mapped_identity_ids uuid[];
  resolved_identity_id uuid;
  conflicting_vote boolean;
BEGIN
  SELECT profile.id,
         profile.phone,
         profile.phone_verified_at,
         profile.wechat_unionid,
         profile.reputation_identity_id,
         profile.merged_into
    INTO voter
    FROM public.lc_profiles profile
    WHERE profile.id = p_voter_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '用户不存在';
  END IF;
  IF voter.merged_into IS NOT NULL THEN
    RAISE EXCEPTION '账号已合并，请重新登录';
  END IF;
  IF (voter.phone IS NULL OR voter.phone_verified_at IS NULL)
     AND voter.wechat_unionid IS NULL THEN
    RAISE EXCEPTION '投口碑票前请先验证手机号；已取得微信 UnionID 的账号也可以直接投票';
  END IF;

  phone_hash := CASE
    WHEN voter.phone IS NOT NULL AND voter.phone_verified_at IS NOT NULL
      THEN encode(digest('reputation-phone-v1:' || voter.phone, 'sha256'), 'hex')
    ELSE NULL
  END;
  unionid_hash := CASE
    WHEN voter.wechat_unionid IS NOT NULL
      THEN encode(digest('reputation-wechat-unionid-v1:' || voter.wechat_unionid, 'sha256'), 'hex')
    ELSE NULL
  END;

  IF phone_hash IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('reputation-phone:' || phone_hash));
  END IF;
  IF unionid_hash IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('reputation-wechat:' || unionid_hash));
  END IF;

  SELECT array_agg(DISTINCT credential.identity_id)
    INTO mapped_identity_ids
    FROM public.lc_reputation_identity_credentials credential
    WHERE (credential.credential_type = 'phone' AND credential.credential_hash = phone_hash)
       OR (credential.credential_type = 'wechat_unionid' AND credential.credential_hash = unionid_hash);

  IF COALESCE(array_length(mapped_identity_ids, 1), 0) > 1 THEN
    RAISE EXCEPTION '口碑身份绑定冲突，请联系管理员合并账号';
  END IF;

  resolved_identity_id := voter.reputation_identity_id;
  IF resolved_identity_id IS NULL AND COALESCE(array_length(mapped_identity_ids, 1), 0) = 1 THEN
    resolved_identity_id := mapped_identity_ids[1];
  ELSIF resolved_identity_id IS NOT NULL
        AND COALESCE(array_length(mapped_identity_ids, 1), 0) = 1
        AND mapped_identity_ids[1] IS DISTINCT FROM resolved_identity_id THEN
    RAISE EXCEPTION '口碑身份绑定冲突，请联系管理员合并账号';
  END IF;

  IF resolved_identity_id IS NULL THEN
    INSERT INTO public.lc_reputation_identities DEFAULT VALUES
    RETURNING id INTO resolved_identity_id;
  END IF;

  IF phone_hash IS NOT NULL THEN
    INSERT INTO public.lc_reputation_identity_credentials(identity_id, credential_type, credential_hash)
    VALUES (resolved_identity_id, 'phone', phone_hash)
    ON CONFLICT (credential_type, credential_hash) DO NOTHING;
  END IF;
  IF unionid_hash IS NOT NULL THEN
    INSERT INTO public.lc_reputation_identity_credentials(identity_id, credential_type, credential_hash)
    VALUES (resolved_identity_id, 'wechat_unionid', unionid_hash)
    ON CONFLICT (credential_type, credential_hash) DO NOTHING;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.lc_reputation_identity_credentials credential
    WHERE (
      (credential.credential_type = 'phone' AND credential.credential_hash = phone_hash)
      OR (credential.credential_type = 'wechat_unionid' AND credential.credential_hash = unionid_hash)
    )
      AND credential.identity_id IS DISTINCT FROM resolved_identity_id
  ) THEN
    RAISE EXCEPTION '口碑身份绑定冲突，请联系管理员合并账号';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.lc_votes legacy_vote
    JOIN public.lc_votes identity_vote
      ON identity_vote.ranking_id = legacy_vote.ranking_id
     AND identity_vote.vote_channel = CASE WHEN legacy_vote.vote_type = 'joy' THEN 'joy' ELSE 'stance' END
     AND identity_vote.reputation_identity_id = resolved_identity_id
     AND identity_vote.source = 'free_vote'
    WHERE legacy_vote.voter_id = p_voter_id
      AND legacy_vote.source = 'free_vote'
      AND legacy_vote.reputation_identity_id IS NULL
  ) INTO conflicting_vote;
  IF conflicting_vote THEN
    RAISE EXCEPTION '口碑身份已有重复历史票，请联系管理员处理';
  END IF;

  UPDATE public.lc_votes
  SET reputation_identity_id = resolved_identity_id,
      vote_channel = CASE WHEN vote_type = 'joy' THEN 'joy' ELSE 'stance' END
  WHERE voter_id = p_voter_id
    AND source = 'free_vote'
    AND reputation_identity_id IS NULL;

  UPDATE public.lc_profiles
  SET reputation_identity_id = resolved_identity_id,
      updated_at = now()
  WHERE id = p_voter_id
    AND reputation_identity_id IS DISTINCT FROM resolved_identity_id;

  RETURN resolved_identity_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.lc_apply_ranking_vote(
  p_ranking_id uuid,
  p_voter_id uuid,
  p_vote_type text,
  p_voter_ip text DEFAULT NULL,
  p_voter_name text DEFAULT NULL,
  p_voter_is_realname boolean DEFAULT false
)
RETURNS TABLE(
  likes integer,
  dislikes integer,
  joys integer,
  boost_amount integer,
  negative_boost_amount integer,
  agree_count integer,
  oppose_count integer,
  balance integer,
  balance_delta integer,
  vote_id uuid,
  vote_type text,
  vote_created_at timestamptz,
  is_duplicate boolean
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  target record;
  voter record;
  existing_vote record;
  metrics record;
  resolved_identity_id uuid;
  requested_channel text;
BEGIN
  IF p_vote_type NOT IN ('like', 'dislike', 'joy') THEN
    RAISE EXCEPTION '无效投票类型';
  END IF;

  resolved_identity_id := public.lc_resolve_reputation_identity(p_voter_id);
  requested_channel := CASE WHEN p_vote_type = 'joy' THEN 'joy' ELSE 'stance' END;
  PERFORM pg_advisory_xact_lock(hashtext(p_ranking_id::text || ':' || resolved_identity_id::text || ':' || requested_channel));

  SELECT ranking.id, ranking.status
    INTO target
    FROM public.lc_rankings ranking
    WHERE ranking.id = p_ranking_id
    FOR UPDATE;
  IF NOT FOUND OR target.status <> 'approved' THEN
    RAISE EXCEPTION '帖子不存在或未上线';
  END IF;

  SELECT profile.id, COALESCE(profile.balance, 0) AS balance
    INTO voter
    FROM public.lc_profiles profile
    WHERE profile.id = p_voter_id
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION '用户不存在';
  END IF;

  SELECT vote.id, vote.vote_type, vote.created_at
    INTO existing_vote
    FROM public.lc_votes vote
    WHERE vote.ranking_id = p_ranking_id
      AND vote.reputation_identity_id = resolved_identity_id
      AND vote.vote_channel = requested_channel
      AND vote.source = 'free_vote'
    FOR UPDATE;

  IF FOUND AND existing_vote.vote_type = p_vote_type THEN
    SELECT * INTO metrics
    FROM public.lc_recalculate_ranking_free_vote_counts(p_ranking_id);

    likes := metrics.likes;
    dislikes := metrics.dislikes;
    joys := metrics.joys;
    boost_amount := metrics.boost_amount;
    negative_boost_amount := metrics.negative_boost_amount;
    agree_count := metrics.agree_count;
    oppose_count := metrics.oppose_count;
    balance := voter.balance;
    balance_delta := 0;
    vote_id := existing_vote.id;
    vote_type := existing_vote.vote_type;
    vote_created_at := existing_vote.created_at;
    is_duplicate := true;
    RETURN NEXT;
    RETURN;
  END IF;

  IF FOUND THEN
    UPDATE public.lc_votes
    SET vote_type = p_vote_type,
        voter_id = p_voter_id,
        voter_ip = p_voter_ip,
        voter_name = p_voter_name,
        voter_is_realname = p_voter_is_realname,
        reputation_identity_id = resolved_identity_id,
        vote_channel = requested_channel,
        source = 'free_vote'
    WHERE id = existing_vote.id
    RETURNING lc_votes.id, lc_votes.vote_type, lc_votes.created_at
    INTO existing_vote;
  ELSE
    INSERT INTO public.lc_votes(
      ranking_id,
      vote_type,
      voter_ip,
      voter_id,
      voter_name,
      voter_is_realname,
      reputation_identity_id,
      vote_channel,
      source
    )
    VALUES (
      p_ranking_id,
      p_vote_type,
      p_voter_ip,
      p_voter_id,
      p_voter_name,
      p_voter_is_realname,
      resolved_identity_id,
      requested_channel,
      'free_vote'
    )
    RETURNING lc_votes.id, lc_votes.vote_type, lc_votes.created_at
    INTO existing_vote;
  END IF;

  SELECT * INTO metrics
  FROM public.lc_recalculate_ranking_free_vote_counts(p_ranking_id);

  likes := metrics.likes;
  dislikes := metrics.dislikes;
  joys := metrics.joys;
  boost_amount := metrics.boost_amount;
  negative_boost_amount := metrics.negative_boost_amount;
  agree_count := metrics.agree_count;
  oppose_count := metrics.oppose_count;
  balance := voter.balance;
  balance_delta := 0;
  vote_id := existing_vote.id;
  vote_type := existing_vote.vote_type;
  vote_created_at := existing_vote.created_at;
  is_duplicate := false;
  RETURN NEXT;
END;
$$;

DROP FUNCTION IF EXISTS public.lc_cancel_ranking_vote(uuid, uuid);

CREATE OR REPLACE FUNCTION public.lc_cancel_ranking_vote(
  p_ranking_id uuid,
  p_voter_id uuid,
  p_vote_type text
)
RETURNS TABLE(
  likes integer,
  dislikes integer,
  joys integer,
  boost_amount integer,
  negative_boost_amount integer,
  agree_count integer,
  oppose_count integer,
  balance integer,
  refunded integer
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  voter record;
  existing_vote record;
  metrics record;
  resolved_identity_id uuid;
  requested_channel text;
BEGIN
  IF p_vote_type NOT IN ('like', 'dislike', 'joy') THEN
    RAISE EXCEPTION '无效投票类型';
  END IF;
  resolved_identity_id := public.lc_resolve_reputation_identity(p_voter_id);
  requested_channel := CASE WHEN p_vote_type = 'joy' THEN 'joy' ELSE 'stance' END;
  PERFORM pg_advisory_xact_lock(hashtext(p_ranking_id::text || ':' || resolved_identity_id::text || ':' || requested_channel));

  PERFORM 1
  FROM public.lc_rankings ranking
  WHERE ranking.id = p_ranking_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION '帖子不存在';
  END IF;

  SELECT profile.id, COALESCE(profile.balance, 0) AS balance
    INTO voter
    FROM public.lc_profiles profile
    WHERE profile.id = p_voter_id
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION '用户不存在';
  END IF;

  SELECT vote.id, vote.vote_type, vote.created_at
    INTO existing_vote
    FROM public.lc_votes vote
    WHERE vote.ranking_id = p_ranking_id
      AND vote.reputation_identity_id = resolved_identity_id
      AND vote.vote_channel = requested_channel
      AND vote.source = 'free_vote'
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION '你还没有给这条内容投过这类票';
  END IF;
  IF now() - existing_vote.created_at > interval '24 hours' THEN
    RAISE EXCEPTION '投票超过24小时，不能撤销';
  END IF;

  DELETE FROM public.lc_votes WHERE id = existing_vote.id;

  SELECT * INTO metrics
  FROM public.lc_recalculate_ranking_free_vote_counts(p_ranking_id);

  likes := metrics.likes;
  dislikes := metrics.dislikes;
  joys := metrics.joys;
  boost_amount := metrics.boost_amount;
  negative_boost_amount := metrics.negative_boost_amount;
  agree_count := metrics.agree_count;
  oppose_count := metrics.oppose_count;
  balance := voter.balance;
  refunded := 0;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.lc_resolve_reputation_identity(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lc_apply_ranking_vote(uuid, uuid, text, text, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lc_cancel_ranking_vote(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON TABLE public.lc_reputation_identities FROM PUBLIC;
REVOKE ALL ON TABLE public.lc_reputation_identity_credentials FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE public.lc_reputation_identities FROM anon;
    REVOKE ALL ON TABLE public.lc_reputation_identity_credentials FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE public.lc_reputation_identities FROM authenticated;
    REVOKE ALL ON TABLE public.lc_reputation_identity_credentials FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lingqi_app') THEN
    REVOKE ALL ON TABLE public.lc_reputation_identities FROM lingqi_app;
    REVOKE ALL ON TABLE public.lc_reputation_identity_credentials FROM lingqi_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lingqi_app') THEN
    GRANT EXECUTE ON FUNCTION public.lc_resolve_reputation_identity(uuid) TO lingqi_app;
    GRANT EXECUTE ON FUNCTION public.lc_apply_ranking_vote(uuid, uuid, text, text, text, boolean) TO lingqi_app;
    GRANT EXECUTE ON FUNCTION public.lc_cancel_ranking_vote(uuid, uuid, text) TO lingqi_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.lc_resolve_reputation_identity(uuid) TO service_role;
    GRANT EXECUTE ON FUNCTION public.lc_apply_ranking_vote(uuid, uuid, text, text, text, boolean) TO service_role;
    GRANT EXECUTE ON FUNCTION public.lc_cancel_ranking_vote(uuid, uuid, text) TO service_role;
  END IF;
END;
$$;

COMMIT;
