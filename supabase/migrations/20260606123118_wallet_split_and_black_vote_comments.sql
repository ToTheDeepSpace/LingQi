-- 钱包拆分 + 黑榜赞同/反对免费互动
--
-- 1. 契约币拆成 paid_balance（充值币）和 bonus_balance（赠币）。
-- 2. 历史流水按描述/网关回放拆分，保持 balance = paid_balance + bonus_balance。
-- 3. 评论改为免费后，钱包 RPC 统一支持赠币优先消费。
-- 4. 黑榜互动改为免费“赞同 / 反对”，不再开放付费负面打榜。

ALTER TABLE public.lc_profiles
  ADD COLUMN IF NOT EXISTS paid_balance integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_balance integer NOT NULL DEFAULT 0;

ALTER TABLE public.lc_transactions
  ADD COLUMN IF NOT EXISTS paid_amount integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_amount integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_balance_before integer,
  ADD COLUMN IF NOT EXISTS paid_balance_after integer,
  ADD COLUMN IF NOT EXISTS bonus_balance_before integer,
  ADD COLUMN IF NOT EXISTS bonus_balance_after integer;

ALTER TABLE public.lc_transactions
  DROP CONSTRAINT IF EXISTS lc_transactions_type_check;

ALTER TABLE public.lc_transactions
  ADD CONSTRAINT lc_transactions_type_check
  CHECK (type IN ('recharge', 'spend', 'refund'));

CREATE OR REPLACE FUNCTION public.lc_is_bonus_credit(
  p_description text,
  p_ref_type text DEFAULT NULL,
  p_gateway text DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    COALESCE(p_ref_type, '') IN (
      'referral_invitee_bonus',
      'referral_stage1_bonus',
      'referral_stage2_bonus',
      'script_contribution_reward'
    )
    OR COALESCE(p_description, '') ILIKE ANY (ARRAY[
      '%赠送%',
      '%奖励%',
      '%邀请%',
      '%注册赠%'
    ])
    OR (
      COALESCE(p_gateway, '') = ''
      AND COALESCE(p_description, '') ILIKE '%维护剧本库%'
    );
$$;

DO $$
DECLARE
  split_rows integer;
  tx record;
  paid_before integer;
  bonus_before integer;
  paid_delta integer;
  bonus_delta integer;
  paid_after integer;
  bonus_after integer;
  total_before integer;
  total_after integer;
  spend_amount integer;
BEGIN
  SELECT count(*)
    INTO split_rows
    FROM public.lc_transactions
    WHERE paid_balance_after IS NOT NULL
       OR bonus_balance_after IS NOT NULL
       OR paid_amount <> 0
       OR bonus_amount <> 0;

  IF split_rows = 0 THEN
    UPDATE public.lc_profiles
      SET paid_balance = 0,
          bonus_balance = 0;

    UPDATE public.lc_transactions
      SET paid_amount = 0,
          bonus_amount = 0,
          paid_balance_before = NULL,
          paid_balance_after = NULL,
          bonus_balance_before = NULL,
          bonus_balance_after = NULL;

    FOR tx IN
      SELECT *
        FROM public.lc_transactions
        WHERE status = 'approved'
        ORDER BY created_at ASC, id ASC
    LOOP
      SELECT COALESCE(paid_balance, 0), COALESCE(bonus_balance, 0)
        INTO paid_before, bonus_before
        FROM public.lc_profiles
        WHERE id = tx.profile_id
        FOR UPDATE;

      paid_before := COALESCE(paid_before, 0);
      bonus_before := COALESCE(bonus_before, 0);
      total_before := paid_before + bonus_before;

      IF tx.amount >= 0 THEN
        IF public.lc_is_bonus_credit(tx.description, tx.ref_type, tx.gateway) THEN
          paid_delta := 0;
          bonus_delta := tx.amount;
        ELSE
          paid_delta := tx.amount;
          bonus_delta := 0;
        END IF;
      ELSE
        spend_amount := abs(tx.amount);
        bonus_delta := -LEAST(bonus_before, spend_amount);
        paid_delta := -(spend_amount - abs(bonus_delta));
      END IF;

      paid_after := paid_before + paid_delta;
      bonus_after := bonus_before + bonus_delta;
      total_after := paid_after + bonus_after;

      UPDATE public.lc_profiles
        SET paid_balance = paid_after,
            bonus_balance = bonus_after,
            balance = total_after,
            updated_at = now()
        WHERE id = tx.profile_id;

      UPDATE public.lc_transactions
        SET paid_amount = paid_delta,
            bonus_amount = bonus_delta,
            paid_balance_before = paid_before,
            paid_balance_after = paid_after,
            bonus_balance_before = bonus_before,
            bonus_balance_after = bonus_after,
            balance_before = COALESCE(balance_before, total_before),
            balance_after = COALESCE(balance_after, total_after),
            updated_at = now()
        WHERE id = tx.id;
    END LOOP;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.lc_fill_transaction_balance_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  current_balance integer;
BEGIN
  IF NEW.status = 'approved'
     AND NEW.profile_id IS NOT NULL
     AND (NEW.balance_before IS NULL OR NEW.balance_after IS NULL) THEN
    SELECT COALESCE(p.balance, 0)
      INTO current_balance
      FROM public.lc_profiles p
      WHERE p.id = NEW.profile_id;

    IF FOUND THEN
      NEW.balance_after := COALESCE(NEW.balance_after, current_balance);
      NEW.balance_before := COALESCE(NEW.balance_before, current_balance - COALESCE(NEW.amount, 0));
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS public.lc_spend_wallet_balance(
  uuid,
  integer,
  text,
  text,
  uuid,
  text,
  jsonb
);

CREATE OR REPLACE FUNCTION public.lc_spend_wallet_balance(
  p_profile_id uuid,
  p_amount integer,
  p_description text,
  p_ref_type text DEFAULT NULL,
  p_ref_id uuid DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(
  transaction_id uuid,
  balance integer,
  paid_balance integer,
  bonus_balance integer,
  paid_spent integer,
  bonus_spent integer,
  applied boolean
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  profile_row record;
  existing_tx record;
  spend_bonus integer;
  spend_paid integer;
  next_paid integer;
  next_bonus integer;
  next_balance integer;
  inserted_tx_id uuid;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION '消费金额必须大于 0';
  END IF;

  SELECT p.id, COALESCE(p.balance, 0) AS balance,
         COALESCE(p.paid_balance, 0) AS paid_balance,
         COALESCE(p.bonus_balance, 0) AS bonus_balance
    INTO profile_row
    FROM public.lc_profiles p
    WHERE p.id = p_profile_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '用户不存在';
  END IF;

  IF p_idempotency_key IS NOT NULL AND length(trim(p_idempotency_key)) > 0 THEN
    SELECT t.id
      INTO existing_tx
      FROM public.lc_transactions t
      WHERE t.profile_id = p_profile_id
        AND t.idempotency_key = p_idempotency_key
      LIMIT 1;

    IF FOUND THEN
      RETURN QUERY SELECT
        existing_tx.id,
        profile_row.balance,
        profile_row.paid_balance,
        profile_row.bonus_balance,
        0,
        0,
        false;
      RETURN;
    END IF;
  END IF;

  IF profile_row.balance < p_amount THEN
    RAISE EXCEPTION '契约币不足，请先充值';
  END IF;

  spend_bonus := LEAST(profile_row.bonus_balance, p_amount);
  spend_paid := p_amount - spend_bonus;
  next_bonus := profile_row.bonus_balance - spend_bonus;
  next_paid := profile_row.paid_balance - spend_paid;
  next_balance := next_paid + next_bonus;

  UPDATE public.lc_profiles p
    SET paid_balance = next_paid,
        bonus_balance = next_bonus,
        balance = next_balance,
        updated_at = now()
    WHERE p.id = p_profile_id;

  INSERT INTO public.lc_transactions(
    profile_id,
    type,
    amount,
    paid_amount,
    bonus_amount,
    description,
    status,
    ref_type,
    ref_id,
    idempotency_key,
    metadata,
    balance_before,
    balance_after,
    paid_balance_before,
    paid_balance_after,
    bonus_balance_before,
    bonus_balance_after,
    created_at,
    updated_at
  )
  VALUES (
    p_profile_id,
    'spend',
    -p_amount,
    -spend_paid,
    -spend_bonus,
    p_description,
    'approved',
    p_ref_type,
    p_ref_id,
    NULLIF(trim(COALESCE(p_idempotency_key, '')), ''),
    COALESCE(p_metadata, '{}'::jsonb),
    profile_row.balance,
    next_balance,
    profile_row.paid_balance,
    next_paid,
    profile_row.bonus_balance,
    next_bonus,
    now(),
    now()
  )
  RETURNING id INTO inserted_tx_id;

  RETURN QUERY SELECT
    inserted_tx_id,
    next_balance,
    next_paid,
    next_bonus,
    spend_paid,
    spend_bonus,
    true;
END;
$$;

DROP FUNCTION IF EXISTS public.lc_refund_wallet_balance(
  uuid,
  integer,
  integer,
  text,
  text,
  uuid,
  text,
  jsonb
);

CREATE OR REPLACE FUNCTION public.lc_refund_wallet_balance(
  p_profile_id uuid,
  p_paid_amount integer,
  p_bonus_amount integer,
  p_description text,
  p_ref_type text DEFAULT NULL,
  p_ref_id uuid DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(
  transaction_id uuid,
  balance integer,
  paid_balance integer,
  bonus_balance integer,
  paid_refunded integer,
  bonus_refunded integer,
  applied boolean
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  profile_row record;
  existing_tx record;
  next_paid integer;
  next_bonus integer;
  next_balance integer;
  total_amount integer;
  inserted_tx_id uuid;
BEGIN
  p_paid_amount := GREATEST(0, COALESCE(p_paid_amount, 0));
  p_bonus_amount := GREATEST(0, COALESCE(p_bonus_amount, 0));
  total_amount := p_paid_amount + p_bonus_amount;

  IF total_amount <= 0 THEN
    RAISE EXCEPTION '退款金额必须大于 0';
  END IF;

  SELECT p.id, COALESCE(p.balance, 0) AS balance,
         COALESCE(p.paid_balance, 0) AS paid_balance,
         COALESCE(p.bonus_balance, 0) AS bonus_balance
    INTO profile_row
    FROM public.lc_profiles p
    WHERE p.id = p_profile_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '用户不存在';
  END IF;

  IF p_idempotency_key IS NOT NULL AND length(trim(p_idempotency_key)) > 0 THEN
    SELECT t.id
      INTO existing_tx
      FROM public.lc_transactions t
      WHERE t.profile_id = p_profile_id
        AND t.idempotency_key = p_idempotency_key
      LIMIT 1;

    IF FOUND THEN
      RETURN QUERY SELECT
        existing_tx.id,
        profile_row.balance,
        profile_row.paid_balance,
        profile_row.bonus_balance,
        0,
        0,
        false;
      RETURN;
    END IF;
  END IF;

  next_paid := profile_row.paid_balance + p_paid_amount;
  next_bonus := profile_row.bonus_balance + p_bonus_amount;
  next_balance := next_paid + next_bonus;

  UPDATE public.lc_profiles p
    SET paid_balance = next_paid,
        bonus_balance = next_bonus,
        balance = next_balance,
        updated_at = now()
    WHERE p.id = p_profile_id;

  INSERT INTO public.lc_transactions(
    profile_id,
    type,
    amount,
    paid_amount,
    bonus_amount,
    description,
    status,
    ref_type,
    ref_id,
    idempotency_key,
    metadata,
    balance_before,
    balance_after,
    paid_balance_before,
    paid_balance_after,
    bonus_balance_before,
    bonus_balance_after,
    created_at,
    updated_at
  )
  VALUES (
    p_profile_id,
    'refund',
    total_amount,
    p_paid_amount,
    p_bonus_amount,
    p_description,
    'approved',
    p_ref_type,
    p_ref_id,
    NULLIF(trim(COALESCE(p_idempotency_key, '')), ''),
    COALESCE(p_metadata, '{}'::jsonb),
    profile_row.balance,
    next_balance,
    profile_row.paid_balance,
    next_paid,
    profile_row.bonus_balance,
    next_bonus,
    now(),
    now()
  )
  RETURNING id INTO inserted_tx_id;

  RETURN QUERY SELECT
    inserted_tx_id,
    next_balance,
    next_paid,
    next_bonus,
    p_paid_amount,
    p_bonus_amount,
    true;
END;
$$;

DROP FUNCTION IF EXISTS public.approve_lc_recharge(uuid);

CREATE OR REPLACE FUNCTION public.approve_lc_recharge(p_transaction_id uuid)
RETURNS TABLE(profile_id uuid, balance integer)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  tx record;
  profile_row record;
  next_paid integer;
  next_bonus integer;
  next_balance integer;
BEGIN
  SELECT t.id, t.profile_id, t.amount, t.status, t.type
    INTO tx
    FROM public.lc_transactions t
    WHERE t.id = p_transaction_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '充值记录不存在';
  END IF;

  IF tx.type <> 'recharge' THEN
    RAISE EXCEPTION '不是充值记录';
  END IF;

  IF tx.status <> 'pending' THEN
    RAISE EXCEPTION '充值记录已处理';
  END IF;

  SELECT p.id, COALESCE(p.balance, 0) AS balance,
         COALESCE(p.paid_balance, 0) AS paid_balance,
         COALESCE(p.bonus_balance, 0) AS bonus_balance
    INTO profile_row
    FROM public.lc_profiles p
    WHERE p.id = tx.profile_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '用户不存在';
  END IF;

  next_paid := profile_row.paid_balance + tx.amount;
  next_bonus := profile_row.bonus_balance;
  next_balance := next_paid + next_bonus;

  UPDATE public.lc_profiles p
    SET paid_balance = next_paid,
        bonus_balance = next_bonus,
        balance = next_balance,
        updated_at = now()
    WHERE p.id = tx.profile_id;

  UPDATE public.lc_transactions t
    SET status = 'approved',
        paid_amount = tx.amount,
        bonus_amount = 0,
        balance_before = profile_row.balance,
        balance_after = next_balance,
        paid_balance_before = profile_row.paid_balance,
        paid_balance_after = next_paid,
        bonus_balance_before = profile_row.bonus_balance,
        bonus_balance_after = next_bonus,
        updated_at = now()
    WHERE t.id = tx.id;

  RETURN QUERY SELECT tx.profile_id, next_balance;
END;
$$;

DROP FUNCTION IF EXISTS public.lc_confirm_alipay_recharge(text, text, numeric, jsonb);

CREATE OR REPLACE FUNCTION public.lc_confirm_alipay_recharge(
  p_out_trade_no text,
  p_trade_no text,
  p_total_amount numeric,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(
  profile_id uuid,
  balance integer,
  transaction_id uuid,
  already_processed boolean
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  target_order record;
  profile_row record;
  next_paid integer;
  next_bonus integer;
  next_balance integer;
BEGIN
  SELECT *
    INTO target_order
    FROM public.lc_alipay_orders o
    WHERE o.out_trade_no = p_out_trade_no
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '支付宝订单不存在';
  END IF;

  IF target_order.status = 'paid' THEN
    SELECT COALESCE(p.balance, 0)
      INTO next_balance
      FROM public.lc_profiles p
      WHERE p.id = target_order.profile_id;

    RETURN QUERY SELECT target_order.profile_id, next_balance, target_order.transaction_id, true;
    RETURN;
  END IF;

  IF target_order.status <> 'created' THEN
    RAISE EXCEPTION '支付宝订单状态不可处理';
  END IF;

  IF target_order.total_amount <> p_total_amount THEN
    RAISE EXCEPTION '支付宝通知金额不匹配';
  END IF;

  PERFORM 1
    FROM public.lc_transactions t
    WHERE t.id = target_order.transaction_id
      AND t.type = 'recharge'
      AND t.status = 'pending'
      AND t.gateway = 'alipay'
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '充值流水状态不可处理';
  END IF;

  SELECT p.id, COALESCE(p.balance, 0) AS balance,
         COALESCE(p.paid_balance, 0) AS paid_balance,
         COALESCE(p.bonus_balance, 0) AS bonus_balance
    INTO profile_row
    FROM public.lc_profiles p
    WHERE p.id = target_order.profile_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '用户不存在';
  END IF;

  next_paid := profile_row.paid_balance + target_order.amount;
  next_bonus := profile_row.bonus_balance;
  next_balance := next_paid + next_bonus;

  UPDATE public.lc_profiles p
    SET paid_balance = next_paid,
        bonus_balance = next_bonus,
        balance = next_balance,
        updated_at = now()
    WHERE p.id = target_order.profile_id;

  UPDATE public.lc_alipay_orders o
    SET status = 'paid',
        trade_no = p_trade_no,
        buyer_id = NULLIF(p_payload->>'buyer_id', ''),
        buyer_logon_id = NULLIF(p_payload->>'buyer_logon_id', ''),
        notify_payload = COALESCE(p_payload, '{}'::jsonb),
        paid_at = now(),
        updated_at = now()
    WHERE o.id = target_order.id;

  UPDATE public.lc_transactions t
    SET status = 'approved',
        gateway = 'alipay',
        external_order_no = target_order.out_trade_no,
        external_trade_no = p_trade_no,
        payment_proof = '支付宝自动到账：' || p_trade_no,
        paid_amount = target_order.amount,
        bonus_amount = 0,
        balance_before = profile_row.balance,
        balance_after = next_balance,
        paid_balance_before = profile_row.paid_balance,
        paid_balance_after = next_paid,
        bonus_balance_before = profile_row.bonus_balance,
        bonus_balance_after = next_bonus,
        metadata = COALESCE(t.metadata, '{}'::jsonb)
          || jsonb_build_object(
            'alipay_trade_status', p_payload->>'trade_status',
            'alipay_notify_time', p_payload->>'notify_time'
          ),
        updated_at = now()
    WHERE t.id = target_order.transaction_id
      AND t.status = 'pending';

  RETURN QUERY SELECT target_order.profile_id, next_balance, target_order.transaction_id, false;
END;
$$;

DROP FUNCTION IF EXISTS public.lc_confirm_wechat_pay_recharge(text, text, integer, jsonb);

CREATE OR REPLACE FUNCTION public.lc_confirm_wechat_pay_recharge(
  p_out_trade_no text,
  p_transaction_id_wechat text,
  p_total_fee integer,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(
  profile_id uuid,
  balance integer,
  transaction_id uuid,
  already_processed boolean
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  target_order record;
  profile_row record;
  next_paid integer;
  next_bonus integer;
  next_balance integer;
BEGIN
  SELECT *
    INTO target_order
    FROM public.lc_wechat_pay_orders o
    WHERE o.out_trade_no = p_out_trade_no
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '微信支付订单不存在';
  END IF;

  IF target_order.status = 'paid' THEN
    SELECT COALESCE(p.balance, 0)
      INTO next_balance
      FROM public.lc_profiles p
      WHERE p.id = target_order.profile_id;

    RETURN QUERY SELECT target_order.profile_id, next_balance, target_order.transaction_id, true;
    RETURN;
  END IF;

  IF target_order.status <> 'created' THEN
    RAISE EXCEPTION '微信支付订单状态不可处理';
  END IF;

  IF target_order.total_fee <> p_total_fee THEN
    RAISE EXCEPTION '微信支付通知金额不匹配';
  END IF;

  PERFORM 1
    FROM public.lc_transactions t
    WHERE t.id = target_order.transaction_id
      AND t.type = 'recharge'
      AND t.status = 'pending'
      AND t.gateway = 'wechat_pay'
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '充值流水状态不可处理';
  END IF;

  SELECT p.id, COALESCE(p.balance, 0) AS balance,
         COALESCE(p.paid_balance, 0) AS paid_balance,
         COALESCE(p.bonus_balance, 0) AS bonus_balance
    INTO profile_row
    FROM public.lc_profiles p
    WHERE p.id = target_order.profile_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '用户不存在';
  END IF;

  next_paid := profile_row.paid_balance + target_order.amount;
  next_bonus := profile_row.bonus_balance;
  next_balance := next_paid + next_bonus;

  UPDATE public.lc_profiles p
    SET paid_balance = next_paid,
        bonus_balance = next_bonus,
        balance = next_balance,
        updated_at = now()
    WHERE p.id = target_order.profile_id;

  UPDATE public.lc_wechat_pay_orders o
    SET status = 'paid',
        transaction_id_wechat = p_transaction_id_wechat,
        payer_openid = NULLIF(p_payload #>> '{payer,openid}', ''),
        notify_payload = COALESCE(p_payload, '{}'::jsonb),
        paid_at = now(),
        updated_at = now()
    WHERE o.id = target_order.id;

  UPDATE public.lc_transactions t
    SET status = 'approved',
        gateway = 'wechat_pay',
        external_order_no = target_order.out_trade_no,
        external_trade_no = p_transaction_id_wechat,
        payment_proof = '微信支付自动到账：' || p_transaction_id_wechat,
        paid_amount = target_order.amount,
        bonus_amount = 0,
        balance_before = profile_row.balance,
        balance_after = next_balance,
        paid_balance_before = profile_row.paid_balance,
        paid_balance_after = next_paid,
        bonus_balance_before = profile_row.bonus_balance,
        bonus_balance_after = next_bonus,
        metadata = COALESCE(t.metadata, '{}'::jsonb)
          || jsonb_build_object(
            'wechat_trade_state', p_payload->>'trade_state',
            'wechat_success_time', p_payload->>'success_time',
            'wechat_notify_time', p_payload->>'notify_time'
          ),
        updated_at = now()
    WHERE t.id = target_order.transaction_id
      AND t.status = 'pending';

  RETURN QUERY SELECT target_order.profile_id, next_balance, target_order.transaction_id, false;
END;
$$;

DROP FUNCTION IF EXISTS public.lc_apply_wallet_credit(uuid, integer, text, text, uuid, text, jsonb);

CREATE OR REPLACE FUNCTION public.lc_apply_wallet_credit(
  p_profile_id uuid,
  p_amount integer,
  p_description text,
  p_ref_type text,
  p_ref_id uuid,
  p_idempotency_key text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(
  transaction_id uuid,
  balance integer,
  applied boolean
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  profile_row record;
  existing_tx record;
  next_paid integer;
  next_bonus integer;
  next_balance integer;
  inserted_tx_id uuid;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION '奖励金额必须大于 0';
  END IF;

  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
    RAISE EXCEPTION '缺少幂等键';
  END IF;

  SELECT p.id, COALESCE(p.balance, 0) AS balance,
         COALESCE(p.paid_balance, 0) AS paid_balance,
         COALESCE(p.bonus_balance, 0) AS bonus_balance
    INTO profile_row
    FROM public.lc_profiles p
    WHERE p.id = p_profile_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '用户不存在';
  END IF;

  SELECT t.id
    INTO existing_tx
    FROM public.lc_transactions t
    WHERE t.profile_id = p_profile_id
      AND t.idempotency_key = p_idempotency_key
    LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT existing_tx.id, profile_row.balance, false;
    RETURN;
  END IF;

  next_paid := profile_row.paid_balance;
  next_bonus := profile_row.bonus_balance + p_amount;
  next_balance := next_paid + next_bonus;

  UPDATE public.lc_profiles p
    SET paid_balance = next_paid,
        bonus_balance = next_bonus,
        balance = next_balance,
        updated_at = now()
    WHERE p.id = p_profile_id;

  INSERT INTO public.lc_transactions(
    profile_id,
    type,
    amount,
    paid_amount,
    bonus_amount,
    description,
    status,
    ref_type,
    ref_id,
    idempotency_key,
    metadata,
    balance_before,
    balance_after,
    paid_balance_before,
    paid_balance_after,
    bonus_balance_before,
    bonus_balance_after,
    created_at,
    updated_at
  )
  VALUES (
    p_profile_id,
    'recharge',
    p_amount,
    0,
    p_amount,
    p_description,
    'approved',
    p_ref_type,
    p_ref_id,
    p_idempotency_key,
    COALESCE(p_metadata, '{}'::jsonb),
    profile_row.balance,
    next_balance,
    profile_row.paid_balance,
    next_paid,
    profile_row.bonus_balance,
    next_bonus,
    now(),
    now()
  )
  RETURNING id INTO inserted_tx_id;

  RETURN QUERY SELECT inserted_tx_id, next_balance, true;
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
  has_existing boolean;
  old_cost integer := 0;
  next_cost integer := 0;
  next_likes integer := 0;
  next_dislikes integer := 0;
  next_joys integer := 0;
  refund_paid integer := 0;
  refund_bonus integer := 0;
  tx_key text;
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
    RAISE EXCEPTION '黑榜只开放赞同和反对';
  END IF;

  IF target.type <> 'black' AND p_vote_type = 'dislike' THEN
    RAISE EXCEPTION '红榜和白榜不开放反对票';
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

  IF target.type = 'black' THEN
    old_cost := 0;
    next_cost := 0;
  ELSE
    old_cost := CASE WHEN has_existing AND existing_vote.vote_type IN ('like', 'dislike') THEN 1 ELSE 0 END;
    next_cost := CASE WHEN p_vote_type = 'like' THEN 1 ELSE 0 END;
  END IF;

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
          CASE WHEN p_vote_type = 'like' THEN '赞扬红黑榜 · 1 契约币' ELSE '红黑榜互动 · 1 契约币' END,
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
        '赞扬红黑榜 · 1 契约币',
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

DROP FUNCTION IF EXISTS public.lc_cancel_ranking_vote(uuid, uuid);

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
    WHEN target.type = 'black' THEN 0
    WHEN existing_vote.vote_type IN ('like', 'dislike') THEN 1
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
        '24小时内撤销赞扬退回 · ' || refund_amount || ' 契约币',
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

GRANT EXECUTE ON FUNCTION public.approve_lc_recharge(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.lc_confirm_alipay_recharge(text, text, numeric, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.lc_confirm_wechat_pay_recharge(text, text, integer, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.lc_apply_wallet_credit(uuid, integer, text, text, uuid, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.lc_spend_wallet_balance(uuid, integer, text, text, uuid, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.lc_refund_wallet_balance(uuid, integer, integer, text, text, uuid, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.lc_apply_ranking_vote(uuid, uuid, text, text, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.lc_cancel_ranking_vote(uuid, uuid) TO service_role;
