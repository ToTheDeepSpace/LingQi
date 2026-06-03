-- 支付宝电脑网站支付：灵契钱包自动充值
--
-- 只做 additive schema 变更：
-- 1. 为 lc_transactions 增补支付网关/外部订单字段，便于交易记录追溯。
-- 2. 新增 lc_alipay_orders 记录支付宝订单状态。
-- 3. 新增 lc_confirm_alipay_recharge RPC，在支付宝异步通知验签后幂等加币。

ALTER TABLE lc_transactions
  ADD COLUMN IF NOT EXISTS gateway text,
  ADD COLUMN IF NOT EXISTS external_order_no text,
  ADD COLUMN IF NOT EXISTS external_trade_no text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS lc_transactions_external_order_no_idx
  ON lc_transactions(external_order_no)
  WHERE external_order_no IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS lc_transactions_external_trade_no_idx
  ON lc_transactions(external_trade_no)
  WHERE external_trade_no IS NOT NULL;

CREATE TABLE IF NOT EXISTS lc_alipay_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES lc_profiles(id) ON DELETE CASCADE,
  transaction_id uuid REFERENCES lc_transactions(id) ON DELETE SET NULL,
  out_trade_no text NOT NULL UNIQUE,
  trade_no text UNIQUE,
  amount integer NOT NULL CHECK (amount >= 10),
  total_amount numeric(12, 2) NOT NULL CHECK (total_amount >= 0),
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'paid', 'closed', 'failed')),
  buyer_id text,
  buyer_logon_id text,
  notify_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lc_alipay_orders_profile_created_idx
  ON lc_alipay_orders(profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS lc_alipay_orders_status_created_idx
  ON lc_alipay_orders(status, created_at DESC);

ALTER TABLE lc_alipay_orders ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION lc_confirm_alipay_recharge(
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
AS $$
DECLARE
  target_order record;
  new_balance integer;
BEGIN
  SELECT *
    INTO target_order
    FROM lc_alipay_orders
    WHERE out_trade_no = p_out_trade_no
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '支付宝订单不存在';
  END IF;

  IF target_order.status = 'paid' THEN
    SELECT COALESCE(balance, 0)
      INTO new_balance
      FROM lc_profiles
      WHERE id = target_order.profile_id;

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
    FROM lc_transactions
    WHERE id = target_order.transaction_id
      AND type = 'recharge'
      AND status = 'pending'
      AND gateway = 'alipay'
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '充值流水状态不可处理';
  END IF;

  UPDATE lc_profiles
    SET balance = COALESCE(balance, 0) + target_order.amount,
        updated_at = now()
    WHERE id = target_order.profile_id
    RETURNING lc_profiles.balance INTO new_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION '用户不存在';
  END IF;

  UPDATE lc_alipay_orders
    SET status = 'paid',
        trade_no = p_trade_no,
        buyer_id = NULLIF(p_payload->>'buyer_id', ''),
        buyer_logon_id = NULLIF(p_payload->>'buyer_logon_id', ''),
        notify_payload = COALESCE(p_payload, '{}'::jsonb),
        paid_at = now(),
        updated_at = now()
    WHERE id = target_order.id;

  UPDATE lc_transactions
    SET status = 'approved',
        gateway = 'alipay',
        external_order_no = target_order.out_trade_no,
        external_trade_no = p_trade_no,
        payment_proof = '支付宝自动到账：' || p_trade_no,
        metadata = COALESCE(metadata, '{}'::jsonb)
          || jsonb_build_object(
            'alipay_trade_status', p_payload->>'trade_status',
            'alipay_notify_time', p_payload->>'notify_time'
          ),
        updated_at = now()
    WHERE id = target_order.transaction_id
      AND status = 'pending';

  RETURN QUERY SELECT target_order.profile_id, new_balance, target_order.transaction_id, false;
END;
$$;
