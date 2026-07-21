-- 将纯临时微信小程序账号并入已经验证手机号的剧幕录网站账号。
-- 只允许没有业务活动、没有充值、且仅持有首次赠送 30 榜金的账号自动合并。

ALTER TABLE public.lc_profiles
  ADD COLUMN IF NOT EXISTS merged_into uuid REFERENCES public.lc_profiles(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS merged_at timestamptz;

CREATE INDEX IF NOT EXISTS lc_profiles_merged_into_idx
  ON public.lc_profiles(merged_into)
  WHERE merged_into IS NOT NULL;

CREATE OR REPLACE FUNCTION public.lc_merge_pristine_miniapp_profile(
  p_source_profile_id uuid,
  p_target_profile_id uuid,
  p_verified_phone text
)
RETURNS TABLE (
  target_profile_id uuid,
  source_profile_id uuid,
  account_merged boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  source_profile public.lc_profiles%ROWTYPE;
  target_profile public.lc_profiles%ROWTYPE;
  activity_ref record;
  has_activity boolean;
  welcome_transaction_count integer;
BEGIN
  IF p_source_profile_id = p_target_profile_id THEN
    RAISE EXCEPTION 'SOURCE_NOT_PRISTINE_MINIAPP';
  END IF;

  PERFORM 1
  FROM public.lc_profiles
  WHERE id = ANY(ARRAY[p_source_profile_id, p_target_profile_id])
  ORDER BY id
  FOR UPDATE;

  SELECT * INTO source_profile FROM public.lc_profiles WHERE id = p_source_profile_id;
  SELECT * INTO target_profile FROM public.lc_profiles WHERE id = p_target_profile_id;
  IF source_profile.id IS NULL OR target_profile.id IS NULL THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND';
  END IF;

  IF source_profile.auth_provider IS DISTINCT FROM 'wechat_miniapp'
     OR source_profile.wechat_mini_openid IS NULL
     OR source_profile.phone IS NOT NULL
     OR source_profile.email IS NOT NULL
     OR source_profile.password_hash IS NOT NULL
     OR source_profile.wechat_openid IS NOT NULL
     OR source_profile.merged_into IS NOT NULL
     OR COALESCE(source_profile.is_banned, false) THEN
    RAISE EXCEPTION 'SOURCE_NOT_PRISTINE_MINIAPP';
  END IF;

  IF target_profile.phone IS DISTINCT FROM p_verified_phone
     OR target_profile.phone_verified_at IS NULL THEN
    RAISE EXCEPTION 'TARGET_PHONE_MISMATCH';
  END IF;
  IF COALESCE(target_profile.is_banned, false) THEN
    RAISE EXCEPTION 'TARGET_ACCOUNT_BANNED';
  END IF;
  IF (target_profile.wechat_mini_openid IS NOT NULL
      AND target_profile.wechat_mini_openid IS DISTINCT FROM source_profile.wechat_mini_openid)
     OR (source_profile.wechat_unionid IS NOT NULL
         AND target_profile.wechat_unionid IS NOT NULL
         AND target_profile.wechat_unionid IS DISTINCT FROM source_profile.wechat_unionid) THEN
    RAISE EXCEPTION 'TARGET_WECHAT_CONFLICT';
  END IF;

  IF COALESCE(source_profile.balance, 0) <> 30
     OR COALESCE(source_profile.paid_balance, 0) <> 0
     OR COALESCE(source_profile.bonus_balance, 0) <> 30 THEN
    RAISE EXCEPTION 'MINIAPP_ACCOUNT_WALLET_CHANGED';
  END IF;

  SELECT count(*)::integer
  INTO welcome_transaction_count
  FROM public.lc_transactions
  WHERE profile_id = p_source_profile_id
    AND type = 'recharge'
    AND status = 'approved'
    AND amount = 30
    AND COALESCE(paid_amount, 0) = 0
    AND COALESCE(bonus_amount, 0) = 30
    AND description = '新用户注册赠送 30 榜金';

  IF welcome_transaction_count <> 1
     OR (SELECT count(*) FROM public.lc_transactions WHERE profile_id = p_source_profile_id) <> 1 THEN
    RAISE EXCEPTION 'MINIAPP_ACCOUNT_WALLET_CHANGED';
  END IF;

  FOR activity_ref IN
    SELECT value->>'table' AS table_name, value->>'column' AS column_name
    FROM jsonb_array_elements(
      '[
        {"table":"lc_availability","column":"creator_id"},
        {"table":"lc_carpool_applications","column":"applicant_id"},
        {"table":"lc_carpools","column":"poster_id"},
        {"table":"lc_certifications","column":"profile_id"},
        {"table":"lc_claims","column":"claimant_id"},
        {"table":"lc_comment_votes","column":"voter_id"},
        {"table":"lc_comments","column":"author_id"},
        {"table":"lc_commission_applications","column":"applicant_id"},
        {"table":"lc_commissions","column":"poster_id"},
        {"table":"lc_contact_requests","column":"creator_id"},
        {"table":"lc_creator_income_entries","column":"creator_id"},
        {"table":"lc_creator_income_entries","column":"payer_id"},
        {"table":"lc_creator_withdrawals","column":"creator_id"},
        {"table":"lc_dm_dossier_claims","column":"claimant_id"},
        {"table":"lc_dm_dossiers","column":"submitted_by"},
        {"table":"lc_dm_dossiers","column":"claimed_by"},
        {"table":"lc_dm_gifts","column":"sender_id"},
        {"table":"lc_dm_gifts","column":"receiver_id"},
        {"table":"lc_dm_identity_withdrawals","column":"profile_id"},
        {"table":"lc_dm_ratings","column":"profile_id"},
        {"table":"lc_dm_store_affiliations","column":"dm_profile_id"},
        {"table":"lc_dm_store_affiliations","column":"requested_by_profile_id"},
        {"table":"lc_dm_store_affiliations","column":"ended_by_profile_id"},
        {"table":"lc_entity_ratings","column":"profile_id"},
        {"table":"lc_entity_tags","column":"creator_id"},
        {"table":"lc_entity_tag_votes","column":"voter_id"},
        {"table":"lc_guide_gifts","column":"sender_id"},
        {"table":"lc_guide_gifts","column":"receiver_id"},
        {"table":"lc_guide_purchases","column":"buyer_id"},
        {"table":"lc_guide_purchases","column":"seller_id"},
        {"table":"lc_guides","column":"author_id"},
        {"table":"lc_player_script_records","column":"profile_id"},
        {"table":"lc_portfolio","column":"creator_id"},
        {"table":"lc_profile_role_preferences","column":"profile_id"},
        {"table":"lc_profiles","column":"referred_by"},
        {"table":"lc_public_reviews","column":"profile_id"},
        {"table":"lc_ranking_edit_requests","column":"author_id"},
        {"table":"lc_ranking_versions","column":"actor_id"},
        {"table":"lc_rankings","column":"poster_id"},
        {"table":"lc_rating_discussion_nodes","column":"profile_id"},
        {"table":"lc_rating_reaction_votes","column":"profile_id"},
        {"table":"lc_referrals","column":"referrer_id"},
        {"table":"lc_referrals","column":"invitee_id"},
        {"table":"lc_reports","column":"reporter_id"},
        {"table":"lc_script_contributions","column":"profile_id"},
        {"table":"lc_script_ratings","column":"profile_id"},
        {"table":"lc_services","column":"creator_id"},
        {"table":"lc_site_messages","column":"sender_id"},
        {"table":"lc_store_ratings","column":"profile_id"},
        {"table":"lc_votes","column":"voter_id"},
        {"table":"lc_alipay_orders","column":"profile_id"},
        {"table":"lc_wechat_pay_orders","column":"profile_id"},
        {"table":"schedule_lingqi_commissions","column":"lc_profile_id"}
      ]'::jsonb
    )
  LOOP
    IF to_regclass(format('public.%I', activity_ref.table_name)) IS NOT NULL THEN
      EXECUTE format(
        'SELECT EXISTS (SELECT 1 FROM public.%I WHERE %I = $1)',
        activity_ref.table_name,
        activity_ref.column_name
      ) INTO has_activity USING p_source_profile_id;
      IF has_activity THEN
        RAISE EXCEPTION 'MINIAPP_ACCOUNT_HAS_ACTIVITY';
      END IF;
    END IF;
  END LOOP;

  UPDATE public.lc_profiles
  SET wechat_mini_openid = NULL,
      wechat_unionid = NULL,
      balance = 0,
      bonus_balance = 0,
      is_visible = false,
      is_banned = true,
      ban_reason = '账号已合并至原网站账号',
      banned_at = now(),
      merged_into = p_target_profile_id,
      merged_at = now(),
      updated_at = now()
  WHERE id = p_source_profile_id;

  -- 唯一微信标识必须先从临时账号释放，再写入主账号；整个函数仍在同一事务中。
  UPDATE public.lc_profiles
  SET wechat_mini_openid = source_profile.wechat_mini_openid,
      wechat_unionid = COALESCE(wechat_unionid, source_profile.wechat_unionid),
      wechat_bound_at = now(),
      updated_at = now()
  WHERE id = p_target_profile_id;

  INSERT INTO public.lc_transactions (
    profile_id, type, amount, paid_amount, bonus_amount, description, status,
    balance_before, balance_after, paid_balance_before, paid_balance_after,
    bonus_balance_before, bonus_balance_after, idempotency_key, metadata
  ) VALUES (
    p_source_profile_id, 'spend', -30, 0, -30,
    '微信临时账号合并，首次赠送不重复保留', 'approved',
    30, 0, 0, 0, 30, 0,
    'miniapp-account-merge:' || p_source_profile_id::text,
    jsonb_build_object('merged_into', p_target_profile_id, 'reason', 'duplicate_signup_bonus_removed')
  );

  RETURN QUERY SELECT p_target_profile_id, p_source_profile_id, true;
END;
$$;

REVOKE ALL ON FUNCTION public.lc_merge_pristine_miniapp_profile(uuid, uuid, text) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lingqi_app') THEN
    GRANT EXECUTE ON FUNCTION public.lc_merge_pristine_miniapp_profile(uuid, uuid, text) TO lingqi_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.lc_merge_pristine_miniapp_profile(uuid, uuid, text) TO service_role;
  END IF;
END;
$$;
