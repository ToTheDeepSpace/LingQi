-- Keep money-weighted boosts and one-account attitude votes separate.
--
-- lc_votes has two historical uses:
-- - source = 'legacy_paid_boost': old paid boost records kept for boost history.
-- - source = 'free_vote': current free attitude votes, one account per ranking.
--
-- The stale global unique index on (ranking_id, voter_id) made legacy paid boosts
-- block free attitude votes. From here on only free_vote rows are one-account votes.

ALTER TABLE public.lc_votes
  DROP CONSTRAINT IF EXISTS lc_votes_ranking_voter_key;

DROP INDEX IF EXISTS public.lc_votes_ranking_voter_key;

CREATE UNIQUE INDEX IF NOT EXISTS lc_votes_one_free_vote_per_user_per_ranking
  ON public.lc_votes(ranking_id, voter_id)
  WHERE voter_id IS NOT NULL AND source = 'free_vote';

WITH vote_counts AS (
  SELECT
    v.ranking_id,
    COUNT(*) FILTER (WHERE v.vote_type = 'like')::integer AS agree_count,
    COUNT(*) FILTER (WHERE v.vote_type = 'dislike')::integer AS oppose_count,
    COUNT(*) FILTER (WHERE v.vote_type = 'joy')::integer AS joys
  FROM public.lc_votes v
  WHERE v.source = 'free_vote'
  GROUP BY v.ranking_id
),
prepared AS (
  SELECT
    r.id,
    COALESCE(v.agree_count, 0) AS agree_count,
    COALESCE(v.oppose_count, 0) AS oppose_count,
    COALESCE(v.joys, 0) AS joys
  FROM public.lc_rankings r
  LEFT JOIN vote_counts v ON v.ranking_id = r.id
)
UPDATE public.lc_rankings r
SET agree_count = p.agree_count,
    oppose_count = p.oppose_count,
    joys = p.joys,
    likes = GREATEST(0, COALESCE(r.boost_amount, 0) + p.agree_count),
    dislikes = GREATEST(0, COALESCE(r.negative_boost_amount, 0) + p.oppose_count)
FROM prepared p
WHERE r.id = p.id
  AND (
    COALESCE(r.agree_count, -1) <> p.agree_count
    OR COALESCE(r.oppose_count, -1) <> p.oppose_count
    OR COALESCE(r.joys, -1) <> p.joys
    OR COALESCE(r.likes, -1) <> GREATEST(0, COALESCE(r.boost_amount, 0) + p.agree_count)
    OR COALESCE(r.dislikes, -1) <> GREATEST(0, COALESCE(r.negative_boost_amount, 0) + p.oppose_count)
  );

CREATE OR REPLACE FUNCTION public.lc_recalculate_ranking_free_vote_counts(
  p_ranking_id uuid
)
RETURNS TABLE(
  likes integer,
  dislikes integer,
  joys integer,
  boost_amount integer,
  negative_boost_amount integer,
  agree_count integer,
  oppose_count integer
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  target record;
  counts record;
BEGIN
  SELECT r.id,
         COALESCE(r.boost_amount, CASE WHEN r.type <> 'black' THEN COALESCE(r.likes, 0) ELSE 0 END) AS boost_amount,
         COALESCE(r.negative_boost_amount, 0) AS negative_boost_amount
    INTO target
    FROM public.lc_rankings r
    WHERE r.id = p_ranking_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '帖子不存在';
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE v.vote_type = 'like')::integer AS agree_count,
    COUNT(*) FILTER (WHERE v.vote_type = 'dislike')::integer AS oppose_count,
    COUNT(*) FILTER (WHERE v.vote_type = 'joy')::integer AS joys
    INTO counts
    FROM public.lc_votes v
    WHERE v.ranking_id = p_ranking_id
      AND v.source = 'free_vote';

  UPDATE public.lc_rankings r
    SET agree_count = COALESCE(counts.agree_count, 0),
        oppose_count = COALESCE(counts.oppose_count, 0),
        joys = COALESCE(counts.joys, 0),
        likes = GREATEST(0, target.boost_amount + COALESCE(counts.agree_count, 0)),
        dislikes = GREATEST(0, target.negative_boost_amount + COALESCE(counts.oppose_count, 0))
    WHERE r.id = p_ranking_id
    RETURNING r.likes,
              r.dislikes,
              COALESCE(r.joys, 0),
              r.boost_amount,
              r.negative_boost_amount,
              r.agree_count,
              r.oppose_count
    INTO likes,
         dislikes,
         joys,
         boost_amount,
         negative_boost_amount,
         agree_count,
         oppose_count;

  RETURN NEXT;
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
BEGIN
  IF p_vote_type NOT IN ('like', 'dislike', 'joy') THEN
    RAISE EXCEPTION '无效投票类型';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_ranking_id::text || ':' || p_voter_id::text || ':free_vote'));

  SELECT r.id, r.status
    INTO target
    FROM public.lc_rankings r
    WHERE r.id = p_ranking_id
    FOR UPDATE;

  IF NOT FOUND OR target.status <> 'approved' THEN
    RAISE EXCEPTION '帖子不存在或未上线';
  END IF;

  SELECT p.id, COALESCE(p.balance, 0) AS balance
    INTO voter
    FROM public.lc_profiles p
    WHERE p.id = p_voter_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '用户不存在';
  END IF;

  SELECT v.id, v.vote_type, v.created_at
    INTO existing_vote
    FROM public.lc_votes v
    WHERE v.ranking_id = p_ranking_id
      AND v.voter_id = p_voter_id
      AND v.source = 'free_vote'
    FOR UPDATE;

  IF FOUND AND existing_vote.vote_type = p_vote_type THEN
    SELECT *
      INTO metrics
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
          voter_ip = p_voter_ip,
          voter_name = p_voter_name,
          voter_is_realname = p_voter_is_realname,
          source = 'free_vote'
      WHERE id = existing_vote.id
      RETURNING lc_votes.id, lc_votes.vote_type, lc_votes.created_at
      INTO existing_vote;
  ELSE
    INSERT INTO public.lc_votes(ranking_id, vote_type, voter_ip, voter_id, voter_name, voter_is_realname, source)
    VALUES (p_ranking_id, p_vote_type, p_voter_ip, p_voter_id, p_voter_name, p_voter_is_realname, 'free_vote')
    RETURNING lc_votes.id, lc_votes.vote_type, lc_votes.created_at
    INTO existing_vote;
  END IF;

  SELECT *
    INTO metrics
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

CREATE OR REPLACE FUNCTION public.lc_cancel_ranking_vote(
  p_ranking_id uuid,
  p_voter_id uuid
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
  target record;
  voter record;
  existing_vote record;
  metrics record;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_ranking_id::text || ':' || p_voter_id::text || ':free_vote'));

  SELECT r.id
    INTO target
    FROM public.lc_rankings r
    WHERE r.id = p_ranking_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '帖子不存在';
  END IF;

  SELECT p.id, COALESCE(p.balance, 0) AS balance
    INTO voter
    FROM public.lc_profiles p
    WHERE p.id = p_voter_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '用户不存在';
  END IF;

  SELECT v.id, v.vote_type, v.created_at
    INTO existing_vote
    FROM public.lc_votes v
    WHERE v.ranking_id = p_ranking_id
      AND v.voter_id = p_voter_id
      AND v.source = 'free_vote'
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '你还没有给这条内容投票';
  END IF;

  IF now() - existing_vote.created_at > interval '24 hours' THEN
    RAISE EXCEPTION '投票超过24小时，不能撤销';
  END IF;

  DELETE FROM public.lc_votes WHERE id = existing_vote.id;

  SELECT *
    INTO metrics
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

GRANT EXECUTE ON FUNCTION public.lc_apply_ranking_vote(uuid, uuid, text, text, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.lc_cancel_ranking_vote(uuid, uuid) TO service_role;
