-- Treat any existing one-account-one-vote record as the user's free vote,
-- so old vote rows do not leak a database unique-constraint error to users.

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

GRANT EXECUTE ON FUNCTION public.lc_apply_ranking_vote(uuid, uuid, text, text, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.lc_cancel_ranking_vote(uuid, uuid) TO service_role;
