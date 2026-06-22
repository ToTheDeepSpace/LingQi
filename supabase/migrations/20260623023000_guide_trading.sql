-- 灵契攻略交易第一阶段
--
-- 1. 攻略主链路是购买/解锁，不用礼物伪装交易。
-- 2. 用户钱包继续走 lc_spend_wallet_balance。
-- 3. 创作者收入单独入账，不混入用户契约币余额。

CREATE TABLE IF NOT EXISTS public.lc_guides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES public.lc_profiles(id) ON DELETE CASCADE,
  author_name text NOT NULL DEFAULT '用户',
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  content text NOT NULL,
  price integer NOT NULL DEFAULT 0,
  spoiler_level text NOT NULL DEFAULT 'none',
  guide_type text NOT NULL DEFAULT 'other',
  target_type text NOT NULL DEFAULT 'custom',
  target_id text,
  target_name text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  sale_status text NOT NULL DEFAULT 'draft',
  copyright_confirmed boolean NOT NULL DEFAULT false,
  moderation_precheck jsonb NOT NULL DEFAULT '{}'::jsonb,
  purchase_count integer NOT NULL DEFAULT 0,
  gift_count integer NOT NULL DEFAULT 0,
  gift_amount integer NOT NULL DEFAULT 0,
  reject_reason text,
  admin_note text,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lc_guides_price_check CHECK (price >= 0 AND price <= 500),
  CONSTRAINT lc_guides_spoiler_level_check CHECK (spoiler_level IN ('none', 'light', 'heavy', 'played_only')),
  CONSTRAINT lc_guides_guide_type_check CHECK (guide_type IN ('script', 'role', 'city', 'carpool', 'photo', 'store_dm', 'other')),
  CONSTRAINT lc_guides_target_type_check CHECK (target_type IN ('script', 'script_role', 'city', 'store', 'dm', 'carpool_leader', 'creator', 'custom')),
  CONSTRAINT lc_guides_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  CONSTRAINT lc_guides_sale_status_check CHECK (sale_status IN ('draft', 'on_sale', 'off_sale', 'suspended'))
);

CREATE INDEX IF NOT EXISTS lc_guides_status_sale_idx ON public.lc_guides(status, sale_status, created_at DESC);
CREATE INDEX IF NOT EXISTS lc_guides_author_idx ON public.lc_guides(author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS lc_guides_target_idx ON public.lc_guides(target_type, target_id);

CREATE TABLE IF NOT EXISTS public.lc_guide_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_id uuid NOT NULL REFERENCES public.lc_guides(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES public.lc_profiles(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES public.lc_profiles(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  transaction_id uuid REFERENCES public.lc_transactions(id),
  status text NOT NULL DEFAULT 'approved',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lc_guide_purchases_amount_check CHECK (amount >= 0),
  CONSTRAINT lc_guide_purchases_status_check CHECK (status IN ('approved', 'refunded', 'reversed')),
  CONSTRAINT lc_guide_purchases_unique UNIQUE (guide_id, buyer_id)
);

CREATE INDEX IF NOT EXISTS lc_guide_purchases_buyer_idx ON public.lc_guide_purchases(buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS lc_guide_purchases_seller_idx ON public.lc_guide_purchases(seller_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.lc_creator_income_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES public.lc_profiles(id) ON DELETE CASCADE,
  payer_id uuid REFERENCES public.lc_profiles(id) ON DELETE SET NULL,
  guide_id uuid REFERENCES public.lc_guides(id) ON DELETE SET NULL,
  source_type text NOT NULL,
  source_id uuid,
  gross_amount integer NOT NULL,
  platform_fee integer NOT NULL DEFAULT 0,
  creator_amount integer NOT NULL,
  status text NOT NULL DEFAULT 'frozen',
  available_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  withdrawal_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lc_creator_income_amount_check CHECK (gross_amount >= 0 AND platform_fee >= 0 AND creator_amount >= 0),
  CONSTRAINT lc_creator_income_source_type_check CHECK (source_type IN ('guide_purchase', 'guide_gift')),
  CONSTRAINT lc_creator_income_status_check CHECK (status IN ('frozen', 'withdrawable', 'withdraw_requested', 'withdraw_paid', 'forfeited'))
);

CREATE INDEX IF NOT EXISTS lc_creator_income_creator_idx ON public.lc_creator_income_entries(creator_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS lc_creator_income_guide_idx ON public.lc_creator_income_entries(guide_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.lc_creator_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES public.lc_profiles(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  account_type text NOT NULL,
  account_name text NOT NULL,
  account_identifier text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  admin_note text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lc_creator_withdrawals_amount_check CHECK (amount > 0),
  CONSTRAINT lc_creator_withdrawals_account_type_check CHECK (account_type IN ('alipay', 'wechat', 'bank', 'other')),
  CONSTRAINT lc_creator_withdrawals_status_check CHECK (status IN ('pending', 'paid', 'rejected', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS lc_creator_withdrawals_creator_idx ON public.lc_creator_withdrawals(creator_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.lc_guide_gifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_id uuid NOT NULL REFERENCES public.lc_guides(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.lc_profiles(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES public.lc_profiles(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  message text,
  transaction_id uuid REFERENCES public.lc_transactions(id),
  income_entry_id uuid REFERENCES public.lc_creator_income_entries(id),
  status text NOT NULL DEFAULT 'approved',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lc_guide_gifts_amount_check CHECK (amount > 0),
  CONSTRAINT lc_guide_gifts_status_check CHECK (status IN ('approved', 'refunded', 'reversed'))
);

CREATE INDEX IF NOT EXISTS lc_guide_gifts_guide_idx ON public.lc_guide_gifts(guide_id, created_at DESC);
CREATE INDEX IF NOT EXISTS lc_guide_gifts_receiver_idx ON public.lc_guide_gifts(receiver_id, created_at DESC);

ALTER TABLE public.lc_creator_income_entries
  DROP CONSTRAINT IF EXISTS lc_creator_income_entries_withdrawal_id_fkey;

ALTER TABLE public.lc_creator_income_entries
  ADD CONSTRAINT lc_creator_income_entries_withdrawal_id_fkey
  FOREIGN KEY (withdrawal_id) REFERENCES public.lc_creator_withdrawals(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.lc_purchase_guide(
  p_buyer_id uuid,
  p_guide_id uuid
)
RETURNS TABLE(
  purchase_id uuid,
  guide_id uuid,
  transaction_id uuid,
  balance integer,
  creator_income_id uuid,
  already_purchased boolean
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  guide_row record;
  existing_purchase record;
  wallet_result record;
  inserted_purchase_id uuid;
  inserted_income_id uuid;
  fee_amount integer;
  creator_income_amount integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('lc_purchase_guide:' || p_guide_id::text || ':' || p_buyer_id::text));

  SELECT *
    INTO guide_row
    FROM public.lc_guides g
    WHERE g.id = p_guide_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '攻略不存在';
  END IF;

  IF guide_row.status <> 'approved' OR guide_row.sale_status <> 'on_sale' THEN
    RAISE EXCEPTION '攻略尚未上架';
  END IF;

  IF guide_row.author_id = p_buyer_id THEN
    RAISE EXCEPTION '不能购买自己的攻略';
  END IF;

  SELECT *
    INTO existing_purchase
    FROM public.lc_guide_purchases p
    WHERE p.guide_id = p_guide_id
      AND p.buyer_id = p_buyer_id
      AND p.status = 'approved'
    LIMIT 1;

  IF FOUND THEN
    SELECT COALESCE(lp.balance, 0)
      INTO balance
      FROM public.lc_profiles lp
      WHERE lp.id = p_buyer_id;

    purchase_id := existing_purchase.id;
    guide_id := p_guide_id;
    transaction_id := existing_purchase.transaction_id;
    creator_income_id := NULL;
    already_purchased := true;
    RETURN NEXT;
    RETURN;
  END IF;

  IF COALESCE(guide_row.price, 0) <= 0 THEN
    transaction_id := NULL;
    SELECT COALESCE(lp.balance, 0)
      INTO balance
      FROM public.lc_profiles lp
      WHERE lp.id = p_buyer_id
      FOR UPDATE;
  ELSE
    SELECT *
      INTO wallet_result
      FROM public.lc_spend_wallet_balance(
        p_buyer_id,
        guide_row.price,
        '购买攻略 · ' || left(guide_row.title, 60),
        'guide_purchase',
        p_guide_id,
        'guide_purchase:' || p_guide_id::text || ':' || p_buyer_id::text,
        jsonb_build_object('guide_title', guide_row.title, 'seller_id', guide_row.author_id)
      );
    transaction_id := wallet_result.transaction_id;
    balance := wallet_result.balance;
  END IF;

  INSERT INTO public.lc_guide_purchases(
    guide_id,
    buyer_id,
    seller_id,
    amount,
    transaction_id,
    status,
    created_at,
    updated_at
  )
  VALUES (
    p_guide_id,
    p_buyer_id,
    guide_row.author_id,
    COALESCE(guide_row.price, 0),
    transaction_id,
    'approved',
    now(),
    now()
  )
  RETURNING id INTO inserted_purchase_id;

  fee_amount := floor(COALESCE(guide_row.price, 0) * 0.2)::integer;
  creator_income_amount := COALESCE(guide_row.price, 0) - fee_amount;

  IF creator_income_amount > 0 THEN
    INSERT INTO public.lc_creator_income_entries(
      creator_id,
      payer_id,
      guide_id,
      source_type,
      source_id,
      gross_amount,
      platform_fee,
      creator_amount,
      status,
      available_at,
      metadata,
      created_at,
      updated_at
    )
    VALUES (
      guide_row.author_id,
      p_buyer_id,
      p_guide_id,
      'guide_purchase',
      inserted_purchase_id,
      COALESCE(guide_row.price, 0),
      fee_amount,
      creator_income_amount,
      'frozen',
      now() + interval '7 days',
      jsonb_build_object('purchase_id', inserted_purchase_id, 'guide_title', guide_row.title),
      now(),
      now()
    )
    RETURNING id INTO inserted_income_id;
  END IF;

  UPDATE public.lc_guides
    SET purchase_count = purchase_count + 1,
        updated_at = now()
    WHERE id = p_guide_id;

  purchase_id := inserted_purchase_id;
  guide_id := p_guide_id;
  creator_income_id := inserted_income_id;
  already_purchased := false;
  RETURN NEXT;
END;
$$;
