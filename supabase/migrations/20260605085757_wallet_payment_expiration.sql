-- 钱包自动支付订单过期归档
--
-- 支付宝/微信支付的自动充值订单如果长时间未完成支付，应从待支付状态
-- 转为失败，避免充值页长期显示一堆无法处理的待支付流水。

ALTER TABLE lc_alipay_orders
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

ALTER TABLE lc_wechat_pay_orders
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

CREATE INDEX IF NOT EXISTS lc_alipay_orders_expires_idx
  ON lc_alipay_orders(expires_at)
  WHERE status = 'created';

CREATE INDEX IF NOT EXISTS lc_wechat_pay_orders_expires_idx
  ON lc_wechat_pay_orders(expires_at)
  WHERE status = 'created';

CREATE OR REPLACE FUNCTION lc_expire_stale_payment_recharges(
  p_profile_id uuid DEFAULT NULL,
  p_ttl_minutes integer DEFAULT 30
)
RETURNS TABLE(expired_count integer)
LANGUAGE plpgsql
AS $$
DECLARE
  affected integer := 0;
  ttl_minutes integer := GREATEST(COALESCE(p_ttl_minutes, 30), 1);
BEGIN
  WITH expired_alipay AS (
    UPDATE lc_alipay_orders o
      SET status = 'failed',
          notify_payload = COALESCE(o.notify_payload, '{}'::jsonb)
            || jsonb_build_object(
              'expire_reason', 'payment_timeout',
              'expired_at', now()
            ),
          updated_at = now()
      WHERE o.status = 'created'
        AND (p_profile_id IS NULL OR o.profile_id = p_profile_id)
        AND COALESCE(o.expires_at, o.created_at + make_interval(mins => ttl_minutes)) <= now()
      RETURNING o.transaction_id
  ),
  expired_wechat AS (
    UPDATE lc_wechat_pay_orders o
      SET status = 'failed',
          notify_payload = COALESCE(o.notify_payload, '{}'::jsonb)
            || jsonb_build_object(
              'expire_reason', 'payment_timeout',
              'expired_at', now()
            ),
          updated_at = now()
      WHERE o.status = 'created'
        AND (p_profile_id IS NULL OR o.profile_id = p_profile_id)
        AND COALESCE(o.expires_at, o.created_at + make_interval(mins => ttl_minutes)) <= now()
      RETURNING o.transaction_id
  ),
  expired_transactions AS (
    UPDATE lc_transactions t
      SET status = 'rejected',
          reject_reason = '支付超时未完成，订单已失效',
          metadata = COALESCE(t.metadata, '{}'::jsonb)
            || jsonb_build_object(
              'payment_expire_reason', 'payment_timeout',
              'payment_expired_at', now()
            ),
          updated_at = now()
      WHERE t.type = 'recharge'
        AND t.status = 'pending'
        AND t.gateway IN ('alipay', 'wechat_pay')
        AND t.id IN (
          SELECT transaction_id FROM expired_alipay WHERE transaction_id IS NOT NULL
          UNION
          SELECT transaction_id FROM expired_wechat WHERE transaction_id IS NOT NULL
        )
      RETURNING 1
  )
  SELECT COUNT(*) INTO affected FROM expired_transactions;

  RETURN QUERY SELECT affected;
END;
$$;
