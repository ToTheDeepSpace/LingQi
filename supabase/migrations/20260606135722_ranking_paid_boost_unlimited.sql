-- 红黑榜付费打榜/踩榜金额化 + 免费态度票拆分
--
-- 1. 付费动作从 lc_votes 一人一票中拆出，改为 lc_apply_ranking_paid_boost 任意正整数金额。
-- 2. lc_votes 只表示免费态度：同意 / 反对 / 欢乐，一人对同一帖只保留一个免费态度。
-- 3. 旧付费 like 票保留为 legacy_paid_boost 标记，金额沉淀到 boost_amount，不再占用免费态度票。

ALTER TABLE public.lc_rankings
  ADD COLUMN IF NOT EXISTS boost_amount integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS negative_boost_amount integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS agree_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS oppose_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.lc_votes
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'free_vote';

DO $$
BEGIN
  ALTER TABLE public.lc_rankings
    ADD CONSTRAINT lc_rankings_boost_amount_nonnegative
    CHECK (boost_amount >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.lc_rankings
    ADD CONSTRAINT lc_rankings_negative_boost_amount_nonnegative
    CHECK (negative_boost_amount >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.lc_rankings
    ADD CONSTRAINT lc_rankings_agree_count_nonnegative
    CHECK (agree_count >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.lc_rankings
    ADD CONSTRAINT lc_rankings_oppose_count_nonnegative
    CHECK (oppose_count >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.lc_votes
    ADD CONSTRAINT lc_votes_source_check
    CHECK (source IN ('free_vote', 'legacy_paid_boost'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

WITH prepared AS (
  SELECT
    r.id,
    CASE
      WHEN COALESCE(r.boost_amount, 0) = 0
       AND COALESCE(r.negative_boost_amount, 0) = 0
       AND COALESCE(r.agree_count, 0) = 0
       AND COALESCE(r.oppose_count, 0) = 0
      THEN CASE WHEN r.type <> 'black' THEN GREATEST(0, COALESCE(r.likes, 0)) ELSE 0 END
      ELSE COALESCE(r.boost_amount, 0)
    END AS next_boost,
    CASE
      WHEN COALESCE(r.boost_amount, 0) = 0
       AND COALESCE(r.negative_boost_amount, 0) = 0
       AND COALESCE(r.agree_count, 0) = 0
       AND COALESCE(r.oppose_count, 0) = 0
      THEN 0
      ELSE COALESCE(r.negative_boost_amount, 0)
    END AS next_negative_boost,
    CASE
      WHEN COALESCE(r.boost_amount, 0) = 0
       AND COALESCE(r.negative_boost_amount, 0) = 0
       AND COALESCE(r.agree_count, 0) = 0
       AND COALESCE(r.oppose_count, 0) = 0
      THEN CASE WHEN r.type = 'black' THEN GREATEST(0, COALESCE(r.likes, 0)) ELSE 0 END
      ELSE COALESCE(r.agree_count, 0)
    END AS next_agree,
    CASE
      WHEN COALESCE(r.boost_amount, 0) = 0
       AND COALESCE(r.negative_boost_amount, 0) = 0
       AND COALESCE(r.agree_count, 0) = 0
       AND COALESCE(r.oppose_count, 0) = 0
      THEN GREATEST(0, COALESCE(r.dislikes, 0))
      ELSE COALESCE(r.oppose_count, 0)
    END AS next_oppose,
    GREATEST(0, COALESCE(r.joys, 0)) AS next_joys
  FROM public.lc_rankings r
)
UPDATE public.lc_rankings r
SET boost_amount = p.next_boost,
    negative_boost_amount = p.next_negative_boost,
    agree_count = p.next_agree,
    oppose_count = p.next_oppose,
    likes = GREATEST(0, p.next_boost + p.next_agree),
    dislikes = GREATEST(0, p.next_negative_boost + p.next_oppose),
    joys = p.next_joys
FROM prepared p
WHERE r.id = p.id;

UPDATE public.lc_votes v
SET source = 'legacy_paid_boost'
FROM public.lc_rankings r
WHERE v.ranking_id = r.id
  AND r.type <> 'black'
  AND v.vote_type = 'like'
  AND COALESCE(v.source, 'free_vote') = 'free_vote';

DROP INDEX IF EXISTS public.lc_votes_one_per_user_per_ranking;

CREATE UNIQUE INDEX IF NOT EXISTS lc_votes_one_free_vote_per_user_per_ranking
  ON public.lc_votes(ranking_id, voter_id)
  WHERE voter_id IS NOT NULL AND source = 'free_vote';

CREATE INDEX IF NOT EXISTS lc_rankings_paid_boost_sort_idx
  ON public.lc_rankings(type, boost_amount DESC, negative_boost_amount DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS lc_votes_free_vote_lookup_idx
  ON public.lc_votes(ranking_id, source, created_at DESC);

DROP FUNCTION IF EXISTS public.lc_apply_ranking_paid_boost(uuid, uuid, text, integer, text);

CREATE OR REPLACE FUNCTION public.lc_apply_ranking_paid_boost(
  p_ranking_id uuid,
  p_profile_id uuid,
  p_direction text,
  p_amount integer,
  p_actor_name text DEFAULT NULL
)
RETURNS TABLE(
  boost_amount integer,
  negative_boost_amount integer,
  agree_count integer,
  oppose_count integer,
  likes integer,
  dislikes integer,
  joys integer,
  balance integer,
  paid_amount integer,
  transaction_id uuid
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  target record;
  wallet_result record;
  next_boost integer;
  next_negative_boost integer;
  next_likes integer;
  next_dislikes integer;
BEGIN
  IF p_direction NOT IN ('boost', 'negative_boost') THEN
    RAISE EXCEPTION '无效打榜方向';
  END IF;

  IF COALESCE(p_amount, 0) <= 0 THEN
    RAISE EXCEPTION '打榜金额必须大于 0';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_ranking_id::text || ':paid_boost'));

  SELECT r.id,
         r.type,
         r.status,
         r.subject_name,
         COALESCE(r.boost_amount, CASE WHEN r.type <> 'black' THEN COALESCE(r.likes, 0) ELSE 0 END) AS boost_amount,
         COALESCE(r.negative_boost_amount, 0) AS negative_boost_amount,
         COALESCE(r.agree_count, CASE WHEN r.type = 'black' THEN COALESCE(r.likes, 0) ELSE 0 END) AS agree_count,
         COALESCE(r.oppose_count, COALESCE(r.dislikes, 0)) AS oppose_count,
         COALESCE(r.joys, 0) AS joys
    INTO target
    FROM public.lc_rankings r
    WHERE r.id = p_ranking_id
    FOR UPDATE;

  IF NOT FOUND OR target.status <> 'approved' THEN
    RAISE EXCEPTION '帖子不存在或未上线';
  END IF;

  SELECT *
    INTO wallet_result
    FROM public.lc_spend_wallet_balance(
      p_profile_id,
      p_amount,
      CASE WHEN p_direction = 'negative_boost' THEN '红黑榜踩榜 · ' ELSE '红黑榜打榜 · ' END || p_amount || ' 契约币',
      'ranking_paid_boost',
      p_ranking_id,
      'ranking_paid_boost:' || p_direction || ':' || gen_random_uuid()::text,
      jsonb_build_object(
        'direction', p_direction,
        'ranking_type', target.type,
        'subject_name', target.subject_name,
        'actor_name', p_actor_name
      )
    );

  next_boost := target.boost_amount + CASE WHEN p_direction = 'boost' THEN p_amount ELSE 0 END;
  next_negative_boost := target.negative_boost_amount + CASE WHEN p_direction = 'negative_boost' THEN p_amount ELSE 0 END;
  next_likes := next_boost + target.agree_count;
  next_dislikes := next_negative_boost + target.oppose_count;

  UPDATE public.lc_rankings
    SET boost_amount = next_boost,
        negative_boost_amount = next_negative_boost,
        likes = next_likes,
        dislikes = next_dislikes
    WHERE id = p_ranking_id
    RETURNING lc_rankings.boost_amount,
              lc_rankings.negative_boost_amount,
              lc_rankings.agree_count,
              lc_rankings.oppose_count,
              lc_rankings.likes,
              lc_rankings.dislikes,
              COALESCE(lc_rankings.joys, 0)
    INTO boost_amount,
         negative_boost_amount,
         agree_count,
         oppose_count,
         likes,
         dislikes,
         joys;

  balance := wallet_result.balance;
  paid_amount := p_amount;
  transaction_id := wallet_result.transaction_id;
  RETURN NEXT;
END;
$$;

DROP FUNCTION IF EXISTS public.lc_apply_ranking_vote(uuid, uuid, text, text, text, boolean);

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
  next_agree integer := 0;
  next_oppose integer := 0;
  next_joys integer := 0;
BEGIN
  IF p_vote_type NOT IN ('like', 'dislike', 'joy') THEN
    RAISE EXCEPTION '无效投票类型';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_ranking_id::text || ':' || p_voter_id::text || ':free_vote'));

  SELECT r.id,
         r.type,
         r.status,
         COALESCE(r.boost_amount, CASE WHEN r.type <> 'black' THEN COALESCE(r.likes, 0) ELSE 0 END) AS boost_amount,
         COALESCE(r.negative_boost_amount, 0) AS negative_boost_amount,
         COALESCE(r.agree_count, CASE WHEN r.type = 'black' THEN COALESCE(r.likes, 0) ELSE 0 END) AS agree_count,
         COALESCE(r.oppose_count, COALESCE(r.dislikes, 0)) AS oppose_count,
         COALESCE(r.joys, 0) AS joys
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
    likes := target.boost_amount + target.agree_count;
    dislikes := target.negative_boost_amount + target.oppose_count;
    joys := target.joys;
    boost_amount := target.boost_amount;
    negative_boost_amount := target.negative_boost_amount;
    agree_count := target.agree_count;
    oppose_count := target.oppose_count;
    balance := voter.balance;
    balance_delta := 0;
    vote_id := existing_vote.id;
    vote_type := existing_vote.vote_type;
    vote_created_at := existing_vote.created_at;
    is_duplicate := true;
    RETURN NEXT;
    RETURN;
  END IF;

  next_agree := target.agree_count
    - CASE WHEN FOUND AND existing_vote.vote_type = 'like' THEN 1 ELSE 0 END
    + CASE WHEN p_vote_type = 'like' THEN 1 ELSE 0 END;
  next_oppose := target.oppose_count
    - CASE WHEN FOUND AND existing_vote.vote_type = 'dislike' THEN 1 ELSE 0 END
    + CASE WHEN p_vote_type = 'dislike' THEN 1 ELSE 0 END;
  next_joys := target.joys
    - CASE WHEN FOUND AND existing_vote.vote_type = 'joy' THEN 1 ELSE 0 END
    + CASE WHEN p_vote_type = 'joy' THEN 1 ELSE 0 END;

  IF FOUND THEN
    UPDATE public.lc_votes
      SET vote_type = p_vote_type,
          voter_ip = p_voter_ip,
          voter_name = p_voter_name,
          voter_is_realname = p_voter_is_realname
      WHERE id = existing_vote.id
      RETURNING lc_votes.id, lc_votes.vote_type, lc_votes.created_at
      INTO existing_vote;
  ELSE
    INSERT INTO public.lc_votes(ranking_id, vote_type, voter_ip, voter_id, voter_name, voter_is_realname, source)
    VALUES (p_ranking_id, p_vote_type, p_voter_ip, p_voter_id, p_voter_name, p_voter_is_realname, 'free_vote')
    RETURNING lc_votes.id, lc_votes.vote_type, lc_votes.created_at
    INTO existing_vote;
  END IF;

  UPDATE public.lc_rankings
    SET agree_count = GREATEST(0, next_agree),
        oppose_count = GREATEST(0, next_oppose),
        joys = GREATEST(0, next_joys),
        likes = GREATEST(0, target.boost_amount + next_agree),
        dislikes = GREATEST(0, target.negative_boost_amount + next_oppose)
    WHERE id = p_ranking_id
    RETURNING lc_rankings.likes,
              lc_rankings.dislikes,
              COALESCE(lc_rankings.joys, 0),
              lc_rankings.boost_amount,
              lc_rankings.negative_boost_amount,
              lc_rankings.agree_count,
              lc_rankings.oppose_count
    INTO likes,
         dislikes,
         joys,
         boost_amount,
         negative_boost_amount,
         agree_count,
         oppose_count;

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
  next_agree integer := 0;
  next_oppose integer := 0;
  next_joys integer := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_ranking_id::text || ':' || p_voter_id::text || ':free_vote'));

  SELECT r.id,
         r.type,
         COALESCE(r.boost_amount, CASE WHEN r.type <> 'black' THEN COALESCE(r.likes, 0) ELSE 0 END) AS boost_amount,
         COALESCE(r.negative_boost_amount, 0) AS negative_boost_amount,
         COALESCE(r.agree_count, CASE WHEN r.type = 'black' THEN COALESCE(r.likes, 0) ELSE 0 END) AS agree_count,
         COALESCE(r.oppose_count, COALESCE(r.dislikes, 0)) AS oppose_count,
         COALESCE(r.joys, 0) AS joys
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

  next_agree := target.agree_count - CASE WHEN existing_vote.vote_type = 'like' THEN 1 ELSE 0 END;
  next_oppose := target.oppose_count - CASE WHEN existing_vote.vote_type = 'dislike' THEN 1 ELSE 0 END;
  next_joys := target.joys - CASE WHEN existing_vote.vote_type = 'joy' THEN 1 ELSE 0 END;

  UPDATE public.lc_rankings
    SET agree_count = GREATEST(0, next_agree),
        oppose_count = GREATEST(0, next_oppose),
        joys = GREATEST(0, next_joys),
        likes = GREATEST(0, target.boost_amount + next_agree),
        dislikes = GREATEST(0, target.negative_boost_amount + next_oppose)
    WHERE id = p_ranking_id
    RETURNING lc_rankings.likes,
              lc_rankings.dislikes,
              COALESCE(lc_rankings.joys, 0),
              lc_rankings.boost_amount,
              lc_rankings.negative_boost_amount,
              lc_rankings.agree_count,
              lc_rankings.oppose_count
    INTO likes,
         dislikes,
         joys,
         boost_amount,
         negative_boost_amount,
         agree_count,
         oppose_count;

  balance := voter.balance;
  refunded := 0;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.lc_apply_ranking_paid_boost(uuid, uuid, text, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.lc_apply_ranking_vote(uuid, uuid, text, text, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.lc_cancel_ranking_vote(uuid, uuid) TO service_role;
