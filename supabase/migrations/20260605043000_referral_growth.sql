-- 灵契邀请拉新第一版
--
-- 只做 additive schema 变更：
-- 1. 给 lc_profiles 增加邀请码、邀请来源和社区荣誉字段。
-- 2. 新增 lc_referrals 记录邀请关系与分阶段奖励状态。
-- 3. 新增 lc_apply_wallet_credit RPC，统一处理幂等赠送/奖励入账。

ALTER TABLE public.lc_profiles
  ADD COLUMN IF NOT EXISTS referral_code text,
  ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES public.lc_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referral_source_code text,
  ADD COLUMN IF NOT EXISTS community_role text,
  ADD COLUMN IF NOT EXISTS community_role_expires_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
      WHERE conname = 'lc_profiles_community_role_check'
  ) THEN
    ALTER TABLE public.lc_profiles
      ADD CONSTRAINT lc_profiles_community_role_check
      CHECK (
        community_role IS NULL
        OR community_role IN ('community_referrer', 'community_observer', 'founding_referrer')
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS lc_profiles_referral_code_unique_idx
  ON public.lc_profiles (upper(referral_code))
  WHERE referral_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS lc_profiles_referred_by_idx
  ON public.lc_profiles (referred_by)
  WHERE referred_by IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.lc_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES public.lc_profiles(id) ON DELETE CASCADE,
  invitee_id uuid NOT NULL REFERENCES public.lc_profiles(id) ON DELETE CASCADE,
  referral_code text NOT NULL,
  status text NOT NULL DEFAULT 'registered'
    CHECK (status IN ('registered', 'qualified', 'converted', 'rejected')),
  invitee_bonus_awarded_at timestamptz,
  stage1_awarded_at timestamptz,
  stage2_awarded_at timestamptz,
  stage2_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lc_referrals_no_self_invite CHECK (referrer_id <> invitee_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS lc_referrals_invitee_unique_idx
  ON public.lc_referrals (invitee_id);

CREATE INDEX IF NOT EXISTS lc_referrals_referrer_created_idx
  ON public.lc_referrals (referrer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS lc_referrals_referrer_stage1_idx
  ON public.lc_referrals (referrer_id, stage1_awarded_at)
  WHERE stage1_awarded_at IS NOT NULL;

ALTER TABLE public.lc_referrals ENABLE ROW LEVEL SECURITY;

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
  current_balance integer;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION '奖励金额必须大于 0';
  END IF;

  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
    RAISE EXCEPTION '缺少幂等键';
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

  UPDATE public.lc_profiles
    SET balance = COALESCE(balance, 0) + p_amount,
        updated_at = now()
    WHERE id = p_profile_id
    RETURNING public.lc_profiles.balance INTO current_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION '用户不存在';
  END IF;

  RETURN QUERY SELECT inserted_tx_id, current_balance, true;
END;
$$;
