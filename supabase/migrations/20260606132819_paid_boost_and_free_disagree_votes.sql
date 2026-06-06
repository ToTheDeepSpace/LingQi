-- 付费打榜 + 免费同意/反对/欢乐
--
-- 1. 红榜/白榜允许免费反对，反对作为治理信号，不扣契约币。
-- 2. 非黑榜只有 like（前台叫“打榜”）扣 1 契约币。
-- 3. 黑榜继续只允许免费同意/反对，不开放欢乐。

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
  wallet_result record;
  has_existing boolean := false;
  old_cost integer := 0;
  next_cost integer := 0;
  tx_key text;
  refund_paid integer := 0;
  refund_bonus integer := 0;
  next_likes integer := 0;
  next_dislikes integer := 0;
  next_joys integer := 0;
BEGIN
  IF p_vote_type NOT IN ('like', 'dislike', 'joy') THEN
    RAISE EXCEPTION '无效投票类型';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_ranking_id::text || ':' || p_voter_id::text));

  SELECT r.id, r.type, r.likes, r.dislikes, COALESCE(r.joys, 0) AS joys, r.status
    INTO target
    FROM public.lc_rankings r
    WHERE r.id = p_ranking_id
    FOR UPDATE;

  IF NOT FOUND OR target.status <> 'approved' THEN
    RAISE EXCEPTION '帖子不存在或未上线';
  END IF;

  IF target.type = 'black' AND p_vote_type NOT IN ('like', 'dislike') THEN
    RAISE EXCEPTION '黑榜只开放同意和反对';
  END IF;

  SELECT p.id, COALESCE(p.balance, 0) AS balance,
         COALESCE(p.paid_balance, 0) AS paid_balance,
         COALESCE(p.bonus_balance, 0) AS bonus_balance
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
  has_existing := FOUND;

  IF has_existing AND existing_vote.vote_type = p_vote_type THEN
    likes := COALESCE(target.likes, 0);
    dislikes := COALESCE(target.dislikes, 0);
    joys := COALESCE(target.joys, 0);
    balance := voter.balance;
    balance_delta := 0;
    vote_id := existing_vote.id;
    vote_type := existing_vote.vote_type;
    vote_created_at := existing_vote.created_at;
    is_duplicate := true;
    RETURN NEXT;
    RETURN;
  END IF;

  old_cost := CASE
    WHEN target.type <> 'black' AND has_existing AND existing_vote.vote_type = 'like' THEN 1
    ELSE 0
  END;
  next_cost := CASE
    WHEN target.type <> 'black' AND p_vote_type = 'like' THEN 1
    ELSE 0
  END;

  IF has_existing THEN
    balance_delta := old_cost - next_cost;

    next_likes := COALESCE(target.likes, 0)
      - CASE WHEN existing_vote.vote_type = 'like' THEN 1 ELSE 0 END
      + CASE WHEN p_vote_type = 'like' THEN 1 ELSE 0 END;
    next_dislikes := COALESCE(target.dislikes, 0)
      - CASE WHEN existing_vote.vote_type = 'dislike' THEN 1 ELSE 0 END
      + CASE WHEN p_vote_type = 'dislike' THEN 1 ELSE 0 END;
    next_joys := COALESCE(target.joys, 0)
      - CASE WHEN existing_vote.vote_type = 'joy' THEN 1 ELSE 0 END
      + CASE WHEN p_vote_type = 'joy' THEN 1 ELSE 0 END;

    IF balance_delta < 0 THEN
      tx_key := 'ranking_vote:change:' || existing_vote.id::text || ':' || p_vote_type || ':' || gen_random_uuid()::text;

      SELECT *
        INTO wallet_result
        FROM public.lc_spend_wallet_balance(
          p_voter_id,
          abs(balance_delta),
          '红黑榜打榜 · 1 契约币',
          'ranking_vote',
          p_ranking_id,
          tx_key,
          jsonb_build_object('vote_type', p_vote_type, 'ranking_type', target.type, 'reason', 'change_vote')
        );

      balance := wallet_result.balance;
    ELSIF balance_delta > 0 THEN
      SELECT COALESCE(abs(t.paid_amount), 0), COALESCE(abs(t.bonus_amount), 0)
        INTO refund_paid, refund_bonus
        FROM public.lc_transactions t
        WHERE t.profile_id = p_voter_id
          AND t.ref_type = 'ranking_vote'
          AND t.ref_id = p_ranking_id
          AND t.amount < 0
          AND (
            t.idempotency_key = 'ranking_vote:create:' || existing_vote.id::text
            OR t.idempotency_key LIKE 'ranking_vote:change:' || existing_vote.id::text || ':%'
          )
        ORDER BY t.created_at DESC
        LIMIT 1;

      refund_paid := COALESCE(refund_paid, balance_delta);
      refund_bonus := COALESCE(refund_bonus, 0);
      IF refund_paid + refund_bonus <= 0 THEN
        refund_paid := balance_delta;
        refund_bonus := 0;
      END IF;

      tx_key := 'ranking_vote:refund-change:' || existing_vote.id::text || ':' || p_vote_type || ':' || gen_random_uuid()::text;

      SELECT *
        INTO wallet_result
        FROM public.lc_refund_wallet_balance(
          p_voter_id,
          refund_paid,
          refund_bonus,
          '改投免费互动退回 · ' || balance_delta || ' 契约币',
          'ranking_vote',
          p_ranking_id,
          tx_key,
          jsonb_build_object('from_vote_type', existing_vote.vote_type, 'to_vote_type', p_vote_type, 'ranking_type', target.type)
        );

      balance := wallet_result.balance;
    ELSE
      balance := voter.balance;
    END IF;

    UPDATE public.lc_votes
      SET vote_type = p_vote_type,
          voter_ip = p_voter_ip,
          voter_name = p_voter_name,
          voter_is_realname = p_voter_is_realname,
          created_at = CASE WHEN old_cost <> next_cost THEN now() ELSE created_at END
      WHERE id = existing_vote.id
      RETURNING lc_votes.id, lc_votes.vote_type, lc_votes.created_at
      INTO existing_vote;

    UPDATE public.lc_rankings
      SET likes = GREATEST(0, next_likes),
          dislikes = GREATEST(0, next_dislikes),
          joys = GREATEST(0, next_joys)
      WHERE id = p_ranking_id
      RETURNING lc_rankings.likes, lc_rankings.dislikes, COALESCE(lc_rankings.joys, 0)
      INTO likes, dislikes, joys;

    vote_id := existing_vote.id;
    vote_type := existing_vote.vote_type;
    vote_created_at := existing_vote.created_at;
    is_duplicate := false;
    RETURN NEXT;
    RETURN;
  END IF;

  balance_delta := -next_cost;

  INSERT INTO public.lc_votes(ranking_id, vote_type, voter_ip, voter_id, voter_name, voter_is_realname)
  VALUES (p_ranking_id, p_vote_type, p_voter_ip, p_voter_id, p_voter_name, p_voter_is_realname)
  RETURNING lc_votes.id, lc_votes.vote_type, lc_votes.created_at
  INTO existing_vote;

  IF next_cost > 0 THEN
    SELECT *
      INTO wallet_result
      FROM public.lc_spend_wallet_balance(
        p_voter_id,
        next_cost,
        '红黑榜打榜 · 1 契约币',
        'ranking_vote',
        p_ranking_id,
        'ranking_vote:create:' || existing_vote.id::text,
        jsonb_build_object('vote_type', p_vote_type, 'ranking_type', target.type)
      );

    balance := wallet_result.balance;
  ELSE
    balance := voter.balance;
  END IF;

  next_likes := COALESCE(target.likes, 0) + CASE WHEN p_vote_type = 'like' THEN 1 ELSE 0 END;
  next_dislikes := COALESCE(target.dislikes, 0) + CASE WHEN p_vote_type = 'dislike' THEN 1 ELSE 0 END;
  next_joys := COALESCE(target.joys, 0) + CASE WHEN p_vote_type = 'joy' THEN 1 ELSE 0 END;

  UPDATE public.lc_rankings
    SET likes = next_likes,
        dislikes = next_dislikes,
        joys = next_joys
    WHERE id = p_ranking_id
    RETURNING lc_rankings.likes, lc_rankings.dislikes, COALESCE(lc_rankings.joys, 0)
    INTO likes, dislikes, joys;

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
  wallet_result record;
  refund_amount integer := 0;
  refund_paid integer := 0;
  refund_bonus integer := 0;
  next_likes integer := 0;
  next_dislikes integer := 0;
  next_joys integer := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_ranking_id::text || ':' || p_voter_id::text));

  SELECT r.id, r.type, r.likes, r.dislikes, COALESCE(r.joys, 0) AS joys
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

  refund_amount := CASE
    WHEN target.type <> 'black' AND existing_vote.vote_type = 'like' THEN 1
    ELSE 0
  END;

  DELETE FROM public.lc_votes WHERE id = existing_vote.id;

  next_likes := COALESCE(target.likes, 0) - CASE WHEN existing_vote.vote_type = 'like' THEN 1 ELSE 0 END;
  next_dislikes := COALESCE(target.dislikes, 0) - CASE WHEN existing_vote.vote_type = 'dislike' THEN 1 ELSE 0 END;
  next_joys := COALESCE(target.joys, 0) - CASE WHEN existing_vote.vote_type = 'joy' THEN 1 ELSE 0 END;

  UPDATE public.lc_rankings
    SET likes = GREATEST(0, next_likes),
        dislikes = GREATEST(0, next_dislikes),
        joys = GREATEST(0, next_joys)
    WHERE id = p_ranking_id
    RETURNING lc_rankings.likes, lc_rankings.dislikes, COALESCE(lc_rankings.joys, 0)
    INTO likes, dislikes, joys;

  IF refund_amount > 0 THEN
    SELECT COALESCE(abs(t.paid_amount), 0), COALESCE(abs(t.bonus_amount), 0)
      INTO refund_paid, refund_bonus
      FROM public.lc_transactions t
      WHERE t.profile_id = p_voter_id
        AND t.ref_type = 'ranking_vote'
        AND t.ref_id = p_ranking_id
        AND t.amount < 0
        AND (
          t.idempotency_key = 'ranking_vote:create:' || existing_vote.id::text
          OR t.idempotency_key LIKE 'ranking_vote:change:' || existing_vote.id::text || ':%'
        )
      ORDER BY t.created_at DESC
      LIMIT 1;

    refund_paid := COALESCE(refund_paid, refund_amount);
    refund_bonus := COALESCE(refund_bonus, 0);
    IF refund_paid + refund_bonus <= 0 THEN
      refund_paid := refund_amount;
      refund_bonus := 0;
    END IF;

    SELECT *
      INTO wallet_result
      FROM public.lc_refund_wallet_balance(
        p_voter_id,
        refund_paid,
        refund_bonus,
        '24小时内撤销打榜退回 · ' || refund_amount || ' 契约币',
        'ranking_vote',
        p_ranking_id,
        'ranking_vote:cancel:' || existing_vote.id::text,
        jsonb_build_object('vote_type', existing_vote.vote_type, 'ranking_type', target.type)
      );

    balance := wallet_result.balance;
  ELSE
    balance := voter.balance;
  END IF;

  refunded := refund_amount;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.lc_apply_ranking_vote(uuid, uuid, text, text, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.lc_cancel_ranking_vote(uuid, uuid) TO service_role;
