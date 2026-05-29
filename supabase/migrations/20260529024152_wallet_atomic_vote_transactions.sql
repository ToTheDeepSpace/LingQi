-- 017: 钱包事务一致性第一阶段 - 红黑榜投票原子化
--
-- 目标：
-- 1. 余额、流水、投票记录、榜单计数在同一个数据库事务里完成。
-- 2. 避免重复点击、并发请求导致重复扣币、少扣币或计数错误。
-- 3. 先覆盖最高频的红黑榜投票，发帖/评论/拼车加权后续再迁移。

ALTER TABLE lc_transactions
  ADD COLUMN IF NOT EXISTS ref_type text,
  ADD COLUMN IF NOT EXISTS ref_id uuid,
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS lc_transactions_profile_idempotency_key_idx
  ON lc_transactions(profile_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE OR REPLACE FUNCTION lc_apply_ranking_vote(
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
AS $$
DECLARE
  target record;
  voter record;
  existing_vote record;
  has_existing boolean;
  old_cost integer := 0;
  next_cost integer := 0;
  next_likes integer := 0;
  next_dislikes integer := 0;
  next_joys integer := 0;
  next_balance integer := 0;
  tx_type text;
  tx_description text;
  tx_key text;
BEGIN
  IF p_vote_type NOT IN ('like', 'dislike', 'joy') THEN
    RAISE EXCEPTION '无效投票类型';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_ranking_id::text || ':' || p_voter_id::text));

  SELECT r.id, r.likes, r.dislikes, COALESCE(r.joys, 0) AS joys, r.status
    INTO target
    FROM lc_rankings r
    WHERE r.id = p_ranking_id
    FOR UPDATE;

  IF NOT FOUND OR target.status <> 'approved' THEN
    RAISE EXCEPTION '帖子不存在或未上线';
  END IF;

  SELECT p.id, COALESCE(p.balance, 0) AS balance
    INTO voter
    FROM lc_profiles p
    WHERE p.id = p_voter_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '用户不存在';
  END IF;

  SELECT v.id, v.vote_type, v.created_at
    INTO existing_vote
    FROM lc_votes v
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

  IF has_existing THEN
    old_cost := CASE WHEN existing_vote.vote_type = 'joy' THEN 0 ELSE 1 END;
    next_cost := CASE WHEN p_vote_type = 'joy' THEN 0 ELSE 1 END;
    balance_delta := old_cost - next_cost;

    IF balance_delta < 0 AND voter.balance < ABS(balance_delta) THEN
      RAISE EXCEPTION '契约币不足，请先充值';
    END IF;

    next_likes := COALESCE(target.likes, 0)
      - CASE WHEN existing_vote.vote_type = 'like' THEN 1 ELSE 0 END
      + CASE WHEN p_vote_type = 'like' THEN 1 ELSE 0 END;
    next_dislikes := COALESCE(target.dislikes, 0)
      - CASE WHEN existing_vote.vote_type = 'dislike' THEN 1 ELSE 0 END
      + CASE WHEN p_vote_type = 'dislike' THEN 1 ELSE 0 END;
    next_joys := COALESCE(target.joys, 0)
      - CASE WHEN existing_vote.vote_type = 'joy' THEN 1 ELSE 0 END
      + CASE WHEN p_vote_type = 'joy' THEN 1 ELSE 0 END;

    UPDATE lc_votes
      SET vote_type = p_vote_type,
          voter_ip = p_voter_ip,
          voter_name = p_voter_name,
          voter_is_realname = p_voter_is_realname,
          created_at = CASE WHEN old_cost <> next_cost THEN now() ELSE created_at END
      WHERE id = existing_vote.id
      RETURNING lc_votes.id, lc_votes.vote_type, lc_votes.created_at
      INTO existing_vote;

    UPDATE lc_rankings
      SET likes = GREATEST(0, next_likes),
          dislikes = GREATEST(0, next_dislikes),
          joys = GREATEST(0, next_joys)
      WHERE id = p_ranking_id
      RETURNING lc_rankings.likes, lc_rankings.dislikes, COALESCE(lc_rankings.joys, 0)
      INTO likes, dislikes, joys;

    next_balance := voter.balance + balance_delta;

    IF balance_delta <> 0 THEN
      UPDATE lc_profiles
        SET balance = next_balance
        WHERE id = p_voter_id;

      tx_type := CASE WHEN balance_delta > 0 THEN 'recharge' ELSE 'spend' END;
      tx_description := CASE
        WHEN balance_delta > 0 THEN '改投欢乐退回 · ' || balance_delta || ' 契约币'
        WHEN p_vote_type = 'like' THEN '改投点赞红黑榜 · ' || ABS(balance_delta) || ' 契约币'
        ELSE '改投点踩红黑榜 · ' || ABS(balance_delta) || ' 契约币'
      END;
      tx_key := 'ranking_vote:change:' || existing_vote.id::text || ':' || p_vote_type || ':' || extract(epoch from now())::bigint::text;

      INSERT INTO lc_transactions(profile_id, type, amount, description, status, ref_type, ref_id, idempotency_key)
      VALUES (p_voter_id, tx_type, balance_delta, tx_description, 'approved', 'ranking_vote', p_ranking_id, tx_key);
    END IF;

    balance := next_balance;
    vote_id := existing_vote.id;
    vote_type := existing_vote.vote_type;
    vote_created_at := existing_vote.created_at;
    is_duplicate := false;
    RETURN NEXT;
    RETURN;
  END IF;

  next_cost := CASE WHEN p_vote_type = 'joy' THEN 0 ELSE 1 END;
  balance_delta := -next_cost;

  IF next_cost > 0 AND voter.balance < next_cost THEN
    RAISE EXCEPTION '契约币不足，请先充值';
  END IF;

  INSERT INTO lc_votes(ranking_id, vote_type, voter_ip, voter_id, voter_name, voter_is_realname)
  VALUES (p_ranking_id, p_vote_type, p_voter_ip, p_voter_id, p_voter_name, p_voter_is_realname)
  RETURNING lc_votes.id, lc_votes.vote_type, lc_votes.created_at
  INTO existing_vote;

  next_likes := COALESCE(target.likes, 0) + CASE WHEN p_vote_type = 'like' THEN 1 ELSE 0 END;
  next_dislikes := COALESCE(target.dislikes, 0) + CASE WHEN p_vote_type = 'dislike' THEN 1 ELSE 0 END;
  next_joys := COALESCE(target.joys, 0) + CASE WHEN p_vote_type = 'joy' THEN 1 ELSE 0 END;

  UPDATE lc_rankings
    SET likes = next_likes,
        dislikes = next_dislikes,
        joys = next_joys
    WHERE id = p_ranking_id
    RETURNING lc_rankings.likes, lc_rankings.dislikes, COALESCE(lc_rankings.joys, 0)
    INTO likes, dislikes, joys;

  next_balance := voter.balance + balance_delta;

  IF next_cost > 0 THEN
    UPDATE lc_profiles
      SET balance = next_balance
      WHERE id = p_voter_id;

    INSERT INTO lc_transactions(profile_id, type, amount, description, status, ref_type, ref_id, idempotency_key)
    VALUES (
      p_voter_id,
      'spend',
      balance_delta,
      CASE WHEN p_vote_type = 'like' THEN '点赞红黑榜 · 1 契约币' ELSE '点踩红黑榜 · 1 契约币' END,
      'approved',
      'ranking_vote',
      p_ranking_id,
      'ranking_vote:create:' || existing_vote.id::text
    );
  END IF;

  balance := next_balance;
  vote_id := existing_vote.id;
  vote_type := existing_vote.vote_type;
  vote_created_at := existing_vote.created_at;
  is_duplicate := false;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION lc_cancel_ranking_vote(
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
AS $$
DECLARE
  target record;
  voter record;
  existing_vote record;
  refund_amount integer := 0;
  next_likes integer := 0;
  next_dislikes integer := 0;
  next_joys integer := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_ranking_id::text || ':' || p_voter_id::text));

  SELECT r.id, r.likes, r.dislikes, COALESCE(r.joys, 0) AS joys
    INTO target
    FROM lc_rankings r
    WHERE r.id = p_ranking_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '帖子不存在';
  END IF;

  SELECT p.id, COALESCE(p.balance, 0) AS balance
    INTO voter
    FROM lc_profiles p
    WHERE p.id = p_voter_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '用户不存在';
  END IF;

  SELECT v.id, v.vote_type, v.created_at
    INTO existing_vote
    FROM lc_votes v
    WHERE v.ranking_id = p_ranking_id
      AND v.voter_id = p_voter_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '你还没有给这条内容投票';
  END IF;

  IF now() - existing_vote.created_at > interval '24 hours' THEN
    RAISE EXCEPTION '投票超过24小时，不能撤销';
  END IF;

  refund_amount := CASE WHEN existing_vote.vote_type = 'joy' THEN 0 ELSE 1 END;

  DELETE FROM lc_votes WHERE id = existing_vote.id;

  next_likes := COALESCE(target.likes, 0) - CASE WHEN existing_vote.vote_type = 'like' THEN 1 ELSE 0 END;
  next_dislikes := COALESCE(target.dislikes, 0) - CASE WHEN existing_vote.vote_type = 'dislike' THEN 1 ELSE 0 END;
  next_joys := COALESCE(target.joys, 0) - CASE WHEN existing_vote.vote_type = 'joy' THEN 1 ELSE 0 END;

  UPDATE lc_rankings
    SET likes = GREATEST(0, next_likes),
        dislikes = GREATEST(0, next_dislikes),
        joys = GREATEST(0, next_joys)
    WHERE id = p_ranking_id
    RETURNING lc_rankings.likes, lc_rankings.dislikes, COALESCE(lc_rankings.joys, 0)
    INTO likes, dislikes, joys;

  balance := voter.balance + refund_amount;

  IF refund_amount > 0 THEN
    UPDATE lc_profiles
      SET balance = voter.balance + refund_amount
      WHERE id = p_voter_id;

    INSERT INTO lc_transactions(profile_id, type, amount, description, status, ref_type, ref_id, idempotency_key)
    VALUES (
      p_voter_id,
      'recharge',
      refund_amount,
      '24小时内撤销' ||
        CASE
          WHEN existing_vote.vote_type = 'like' THEN '点赞'
          WHEN existing_vote.vote_type = 'dislike' THEN '点踩'
          ELSE '欢乐'
        END ||
        '退回 · ' || refund_amount || ' 契约币',
      'approved',
      'ranking_vote',
      p_ranking_id,
      'ranking_vote:cancel:' || existing_vote.id::text
    );
  END IF;

  refunded := refund_amount;
  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION lc_apply_ranking_vote(uuid, uuid, text, text, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION lc_cancel_ranking_vote(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION lc_apply_ranking_vote(uuid, uuid, text, text, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION lc_cancel_ranking_vote(uuid, uuid) TO service_role;
