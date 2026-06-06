-- 钱包流水余额快照与微信支付回调修复
--
-- 1. lc_transactions 增加每笔交易发生前/后的余额快照。
-- 2. 修复支付确认 RPC 中 balance 字段与返回列同名导致的歧义。
-- 3. 用触发器兜底：approved 流水如果未显式写快照，则按当前账户余额补齐。

ALTER TABLE public.lc_transactions
  ADD COLUMN IF NOT EXISTS balance_before integer,
  ADD COLUMN IF NOT EXISTS balance_after integer;

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

DROP TRIGGER IF EXISTS lc_transactions_balance_snapshot_fill ON public.lc_transactions;

CREATE TRIGGER lc_transactions_balance_snapshot_fill
BEFORE INSERT OR UPDATE OF status, profile_id, amount
ON public.lc_transactions
FOR EACH ROW
EXECUTE FUNCTION public.lc_fill_transaction_balance_snapshot();

DROP FUNCTION IF EXISTS public.approve_lc_recharge(uuid);

CREATE OR REPLACE FUNCTION public.approve_lc_recharge(p_transaction_id uuid)
RETURNS TABLE(profile_id uuid, balance integer)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  tx record;
  previous_balance integer;
  new_balance integer;
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

  UPDATE public.lc_profiles p
    SET balance = COALESCE(p.balance, 0) + tx.amount,
        updated_at = now()
    WHERE p.id = tx.profile_id
    RETURNING p.balance - tx.amount, p.balance INTO previous_balance, new_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION '用户不存在';
  END IF;

  UPDATE public.lc_transactions t
    SET status = 'approved',
        balance_before = previous_balance,
        balance_after = new_balance,
        updated_at = now()
    WHERE t.id = tx.id;

  RETURN QUERY SELECT tx.profile_id, new_balance;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_lc_recharge(uuid) TO service_role;

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
  previous_balance integer;
  new_balance integer;
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
      INTO new_balance
      FROM public.lc_profiles p
      WHERE p.id = target_order.profile_id;

    RETURN QUERY SELECT target_order.profile_id, new_balance, target_order.transaction_id, true;
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

  UPDATE public.lc_profiles p
    SET balance = COALESCE(p.balance, 0) + target_order.amount,
        updated_at = now()
    WHERE p.id = target_order.profile_id
    RETURNING p.balance - target_order.amount, p.balance INTO previous_balance, new_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION '用户不存在';
  END IF;

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
        balance_before = previous_balance,
        balance_after = new_balance,
        metadata = COALESCE(t.metadata, '{}'::jsonb)
          || jsonb_build_object(
            'alipay_trade_status', p_payload->>'trade_status',
            'alipay_notify_time', p_payload->>'notify_time'
          ),
        updated_at = now()
    WHERE t.id = target_order.transaction_id
      AND t.status = 'pending';

  RETURN QUERY SELECT target_order.profile_id, new_balance, target_order.transaction_id, false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.lc_confirm_alipay_recharge(text, text, numeric, jsonb) TO service_role;

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
  previous_balance integer;
  new_balance integer;
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
      INTO new_balance
      FROM public.lc_profiles p
      WHERE p.id = target_order.profile_id;

    RETURN QUERY SELECT target_order.profile_id, new_balance, target_order.transaction_id, true;
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

  UPDATE public.lc_profiles p
    SET balance = COALESCE(p.balance, 0) + target_order.amount,
        updated_at = now()
    WHERE p.id = target_order.profile_id
    RETURNING p.balance - target_order.amount, p.balance INTO previous_balance, new_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION '用户不存在';
  END IF;

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
        balance_before = previous_balance,
        balance_after = new_balance,
        metadata = COALESCE(t.metadata, '{}'::jsonb)
          || jsonb_build_object(
            'wechat_trade_state', p_payload->>'trade_state',
            'wechat_success_time', p_payload->>'success_time',
            'wechat_notify_time', p_payload->>'notify_time'
          ),
        updated_at = now()
    WHERE t.id = target_order.transaction_id
      AND t.status = 'pending';

  RETURN QUERY SELECT target_order.profile_id, new_balance, target_order.transaction_id, false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.lc_confirm_wechat_pay_recharge(text, text, integer, jsonb) TO service_role;

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
  inserted_tx_id uuid;
  previous_balance integer;
  current_balance integer;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION '奖励金额必须大于 0';
  END IF;

  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
    RAISE EXCEPTION '缺少幂等键';
  END IF;

  SELECT COALESCE(p.balance, 0)
    INTO previous_balance
    FROM public.lc_profiles p
    WHERE p.id = p_profile_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '用户不存在';
  END IF;

  INSERT INTO public.lc_transactions(
    profile_id,
    type,
    amount,
    description,
    status,
    ref_type,
    ref_id,
    idempotency_key,
    metadata,
    created_at,
    updated_at
  )
  VALUES (
    p_profile_id,
    'recharge',
    p_amount,
    p_description,
    'approved',
    p_ref_type,
    p_ref_id,
    p_idempotency_key,
    COALESCE(p_metadata, '{}'::jsonb),
    now(),
    now()
  )
  ON CONFLICT (profile_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL
    DO NOTHING
  RETURNING id INTO inserted_tx_id;

  IF inserted_tx_id IS NULL THEN
    SELECT COALESCE(p.balance, 0)
      INTO current_balance
      FROM public.lc_profiles p
      WHERE p.id = p_profile_id;

    RETURN QUERY
      SELECT existing.id, current_balance, false
        FROM public.lc_transactions existing
        WHERE existing.profile_id = p_profile_id
          AND existing.idempotency_key = p_idempotency_key
        LIMIT 1;
    RETURN;
  END IF;

  UPDATE public.lc_profiles p
    SET balance = previous_balance + p_amount,
        updated_at = now()
    WHERE p.id = p_profile_id
    RETURNING p.balance INTO current_balance;

  UPDATE public.lc_transactions t
    SET balance_before = previous_balance,
        balance_after = current_balance,
        updated_at = now()
    WHERE t.id = inserted_tx_id;

  RETURN QUERY SELECT inserted_tx_id, current_balance, true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.lc_apply_wallet_credit(uuid, integer, text, text, uuid, text, jsonb) TO service_role;
