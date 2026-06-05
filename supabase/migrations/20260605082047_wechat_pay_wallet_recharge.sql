-- 微信支付 Native 扫码支付：灵契钱包自动充值
--
-- 只做 additive schema 变更：
-- 1. 新增 lc_wechat_pay_orders 记录微信支付订单、二维码和回调状态。
-- 2. 新增 lc_confirm_wechat_pay_recharge RPC，在微信支付回调验签解密后幂等加币。

CREATE TABLE IF NOT EXISTS lc_wechat_pay_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES lc_profiles(id) ON DELETE CASCADE,
  transaction_id uuid REFERENCES lc_transactions(id) ON DELETE SET NULL,
  out_trade_no text NOT NULL UNIQUE,
  transaction_id_wechat text UNIQUE,
  amount integer NOT NULL CHECK (amount >= 10),
  total_fee integer NOT NULL CHECK (total_fee >= 0),
  description text NOT NULL,
  status text NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'paid', 'closed', 'failed')),
  code_url text,
  payer_openid text,
  notify_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lc_wechat_pay_orders_profile_created_idx
  ON lc_wechat_pay_orders(profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS lc_wechat_pay_orders_status_created_idx
  ON lc_wechat_pay_orders(status, created_at DESC);

ALTER TABLE lc_wechat_pay_orders ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION lc_confirm_wechat_pay_recharge(
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
AS $$
DECLARE
  target_order record;
  new_balance integer;
BEGIN
  SELECT *
    INTO target_order
    FROM lc_wechat_pay_orders
    WHERE out_trade_no = p_out_trade_no
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '微信支付订单不存在';
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
    RAISE EXCEPTION '微信支付订单状态不可处理';
  END IF;

  IF target_order.total_fee <> p_total_fee THEN
    RAISE EXCEPTION '微信支付通知金额不匹配';
  END IF;

  PERFORM 1
    FROM lc_transactions
    WHERE id = target_order.transaction_id
      AND type = 'recharge'
      AND status = 'pending'
      AND gateway = 'wechat_pay'
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

  UPDATE lc_wechat_pay_orders
    SET status = 'paid',
        transaction_id_wechat = p_transaction_id_wechat,
        payer_openid = NULLIF(p_payload #>> '{payer,openid}', ''),
        notify_payload = COALESCE(p_payload, '{}'::jsonb),
        paid_at = now(),
        updated_at = now()
    WHERE id = target_order.id;

  UPDATE lc_transactions
    SET status = 'approved',
        gateway = 'wechat_pay',
        external_order_no = target_order.out_trade_no,
        external_trade_no = p_transaction_id_wechat,
        payment_proof = '微信支付自动到账：' || p_transaction_id_wechat,
        metadata = COALESCE(metadata, '{}'::jsonb)
          || jsonb_build_object(
            'wechat_trade_state', p_payload->>'trade_state',
            'wechat_success_time', p_payload->>'success_time',
            'wechat_notify_time', p_payload->>'notify_time'
          ),
        updated_at = now()
    WHERE id = target_order.transaction_id
      AND status = 'pending';

  RETURN QUERY SELECT target_order.profile_id, new_balance, target_order.transaction_id, false;
END;
$$;
