-- DM 缠头：只允许消耗真实充值形成的 paid_balance，赠币不能转成可提现收入。

ALTER TABLE public.lc_creator_income_entries
  DROP CONSTRAINT IF EXISTS lc_creator_income_source_type_check;

ALTER TABLE public.lc_creator_income_entries
  ADD CONSTRAINT lc_creator_income_source_type_check
  CHECK (source_type IN ('guide_purchase', 'guide_gift', 'dm_gift'));

CREATE TABLE IF NOT EXISTS public.lc_dm_gifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dm_dossier_id uuid NOT NULL REFERENCES public.lc_dm_dossiers(id) ON DELETE RESTRICT,
  sender_id uuid NOT NULL REFERENCES public.lc_profiles(id) ON DELETE RESTRICT,
  receiver_id uuid NOT NULL REFERENCES public.lc_profiles(id) ON DELETE RESTRICT,
  rating_id uuid REFERENCES public.lc_dm_ratings(id) ON DELETE SET NULL,
  amount integer NOT NULL,
  platform_fee integer NOT NULL,
  receiver_amount integer NOT NULL,
  message text,
  is_anonymous boolean NOT NULL DEFAULT false,
  transaction_id uuid NOT NULL REFERENCES public.lc_transactions(id) ON DELETE RESTRICT,
  income_entry_id uuid NOT NULL REFERENCES public.lc_creator_income_entries(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL,
  status text NOT NULL DEFAULT 'approved',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lc_dm_gifts_amount_check CHECK (
    amount BETWEEN 1 AND 1000
    AND platform_fee >= 0
    AND receiver_amount >= 0
    AND platform_fee + receiver_amount = amount
  ),
  CONSTRAINT lc_dm_gifts_status_check CHECK (status IN ('approved', 'refunded', 'reversed')),
  CONSTRAINT lc_dm_gifts_no_self_gift_check CHECK (sender_id <> receiver_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS lc_dm_gifts_sender_idempotency_idx
  ON public.lc_dm_gifts(sender_id, idempotency_key);

CREATE INDEX IF NOT EXISTS lc_dm_gifts_dossier_period_idx
  ON public.lc_dm_gifts(dm_dossier_id, created_at DESC)
  WHERE status = 'approved';

CREATE INDEX IF NOT EXISTS lc_dm_gifts_receiver_period_idx
  ON public.lc_dm_gifts(receiver_id, created_at DESC)
  WHERE status = 'approved';

CREATE INDEX IF NOT EXISTS lc_dm_gifts_sender_period_idx
  ON public.lc_dm_gifts(sender_id, created_at DESC)
  WHERE status = 'approved';

CREATE OR REPLACE FUNCTION public.lc_send_dm_gift(
  p_sender_id uuid,
  p_dm_dossier_id uuid,
  p_amount integer,
  p_message text DEFAULT NULL,
  p_is_anonymous boolean DEFAULT false,
  p_rating_id uuid DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS TABLE(
  gift_id uuid,
  transaction_id uuid,
  income_entry_id uuid,
  balance integer,
  paid_balance integer,
  bonus_balance integer,
  gross_amount integer,
  platform_fee integer,
  receiver_amount integer,
  available_at timestamptz,
  applied boolean
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  sender_row record;
  dossier_row record;
  existing_gift record;
  receiver_verified boolean;
  today_total integer;
  next_paid integer;
  next_balance integer;
  fee_amount integer;
  dm_income integer;
  new_gift_id uuid := gen_random_uuid();
  new_transaction_id uuid;
  new_income_id uuid;
  income_available_at timestamptz := now() + interval '3 days';
  safe_key text := NULLIF(trim(COALESCE(p_idempotency_key, '')), '');
BEGIN
  IF p_amount IS NULL OR p_amount < 1 OR p_amount > 1000 THEN
    RAISE EXCEPTION '单次缠头须为 1-1000 榜金';
  END IF;
  IF safe_key IS NULL THEN
    RAISE EXCEPTION '缺少幂等请求标识';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('lc_send_dm_gift:' || p_sender_id::text || ':' || safe_key));

  SELECT * INTO existing_gift
    FROM public.lc_dm_gifts g
    WHERE g.sender_id = p_sender_id AND g.idempotency_key = safe_key
    LIMIT 1;
  IF FOUND THEN
    SELECT COALESCE(p.balance, 0), COALESCE(p.paid_balance, 0), COALESCE(p.bonus_balance, 0)
      INTO balance, paid_balance, bonus_balance
      FROM public.lc_profiles p WHERE p.id = p_sender_id;
    gift_id := existing_gift.id;
    transaction_id := existing_gift.transaction_id;
    income_entry_id := existing_gift.income_entry_id;
    gross_amount := existing_gift.amount;
    platform_fee := existing_gift.platform_fee;
    receiver_amount := existing_gift.receiver_amount;
    SELECT e.available_at INTO available_at FROM public.lc_creator_income_entries e WHERE e.id = existing_gift.income_entry_id;
    applied := false;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT p.id, COALESCE(p.balance, 0) AS balance,
         COALESCE(p.paid_balance, 0) AS paid_balance,
         COALESCE(p.bonus_balance, 0) AS bonus_balance
    INTO sender_row
    FROM public.lc_profiles p
    WHERE p.id = p_sender_id
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '用户不存在'; END IF;

  SELECT d.id, d.dm_name, d.city, d.claimed_by, d.claim_status, d.status, d.entity_type
    INTO dossier_row
    FROM public.lc_dm_dossiers d
    WHERE d.id = p_dm_dossier_id
    FOR UPDATE;
  IF NOT FOUND OR dossier_row.entity_type <> 'dm' OR dossier_row.status <> 'approved' THEN
    RAISE EXCEPTION 'DM 档案不存在或尚未公开';
  END IF;
  IF dossier_row.claim_status <> 'approved' OR dossier_row.claimed_by IS NULL THEN
    RAISE EXCEPTION '这位 DM 尚未完成本人认领，暂不能收取缠头';
  END IF;
  IF dossier_row.claimed_by = p_sender_id THEN
    RAISE EXCEPTION '不能给自己的 DM 档案送缠头';
  END IF;

  SELECT COALESCE(p.verified_dm, false) INTO receiver_verified
    FROM public.lc_profiles p WHERE p.id = dossier_row.claimed_by;
  IF NOT COALESCE(receiver_verified, false) THEN
    RAISE EXCEPTION '收款 DM 身份尚未完成认证';
  END IF;

  IF p_rating_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.lc_dm_ratings r
    WHERE r.id = p_rating_id
      AND r.profile_id = p_sender_id
      AND r.dm_dossier_id = p_dm_dossier_id
  ) THEN
    RAISE EXCEPTION '关联评分不存在或不属于当前用户';
  END IF;

  SELECT COALESCE(sum(g.amount), 0)::integer INTO today_total
    FROM public.lc_dm_gifts g
    WHERE g.sender_id = p_sender_id
      AND g.status = 'approved'
      AND g.created_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Shanghai') AT TIME ZONE 'Asia/Shanghai');
  IF today_total + p_amount > 3000 THEN
    RAISE EXCEPTION '今日缠头已达到 3000 榜金上限，请理性支持';
  END IF;

  IF sender_row.paid_balance < p_amount THEN
    RAISE EXCEPTION '充值榜金不足；赠送榜金不能转换为可提现缠头';
  END IF;

  fee_amount := floor(p_amount * 0.20)::integer;
  dm_income := p_amount - fee_amount;
  next_paid := sender_row.paid_balance - p_amount;
  next_balance := next_paid + sender_row.bonus_balance;

  UPDATE public.lc_profiles
    SET paid_balance = next_paid, balance = next_balance, updated_at = now()
    WHERE id = p_sender_id;

  INSERT INTO public.lc_transactions(
    profile_id, type, amount, paid_amount, bonus_amount, description, status,
    ref_type, ref_id, idempotency_key, metadata,
    balance_before, balance_after, paid_balance_before, paid_balance_after,
    bonus_balance_before, bonus_balance_after, created_at, updated_at
  ) VALUES (
    p_sender_id, 'spend', -p_amount, -p_amount, 0,
    '送缠头 · ' || left(dossier_row.dm_name, 60), 'approved',
    'dm_gift', new_gift_id, 'dm_gift:' || safe_key,
    jsonb_build_object('dm_dossier_id', p_dm_dossier_id, 'dm_name', dossier_row.dm_name, 'receiver_id', dossier_row.claimed_by),
    sender_row.balance, next_balance, sender_row.paid_balance, next_paid,
    sender_row.bonus_balance, sender_row.bonus_balance, now(), now()
  ) RETURNING id INTO new_transaction_id;

  INSERT INTO public.lc_creator_income_entries(
    creator_id, payer_id, guide_id, source_type, source_id,
    gross_amount, platform_fee, creator_amount, status, available_at,
    metadata, created_at, updated_at
  ) VALUES (
    dossier_row.claimed_by, p_sender_id, NULL, 'dm_gift', new_gift_id,
    p_amount, fee_amount, dm_income, 'frozen', income_available_at,
    jsonb_build_object(
      'dm_dossier_id', p_dm_dossier_id,
      'dm_name', dossier_row.dm_name,
      'rating_id', p_rating_id,
      'gift_message', NULLIF(left(trim(COALESCE(p_message, '')), 200), ''),
      'is_anonymous', COALESCE(p_is_anonymous, false)
    ),
    now(), now()
  ) RETURNING id INTO new_income_id;

  INSERT INTO public.lc_dm_gifts(
    id, dm_dossier_id, sender_id, receiver_id, rating_id,
    amount, platform_fee, receiver_amount, message, is_anonymous,
    transaction_id, income_entry_id, idempotency_key, status, created_at, updated_at
  ) VALUES (
    new_gift_id, p_dm_dossier_id, p_sender_id, dossier_row.claimed_by, p_rating_id,
    p_amount, fee_amount, dm_income, NULLIF(left(trim(COALESCE(p_message, '')), 200), ''), COALESCE(p_is_anonymous, false),
    new_transaction_id, new_income_id, safe_key, 'approved', now(), now()
  );

  gift_id := new_gift_id;
  transaction_id := new_transaction_id;
  income_entry_id := new_income_id;
  balance := next_balance;
  paid_balance := next_paid;
  bonus_balance := sender_row.bonus_balance;
  gross_amount := p_amount;
  platform_fee := fee_amount;
  receiver_amount := dm_income;
  available_at := income_available_at;
  applied := true;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.lc_send_dm_gift(uuid, uuid, integer, text, boolean, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lc_send_dm_gift(uuid, uuid, integer, text, boolean, uuid, text) TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lingqi_app') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON TABLE public.lc_dm_gifts TO lingqi_app';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.lc_send_dm_gift(uuid, uuid, integer, text, boolean, uuid, text) TO lingqi_app';
  END IF;
END;
$$;
