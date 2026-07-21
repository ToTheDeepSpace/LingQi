-- 关键内容的数据库事务级变更日志。
-- 与业务写入处于同一事务；日志写入失败时业务变更一并回滚。
-- 该日志仅供数据库运维审计，不向应用账号和公开接口授权。

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.lc_critical_change_journal (
  id bigserial PRIMARY KEY,
  table_name text NOT NULL,
  row_id text,
  operation text NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  database_actor text NOT NULL DEFAULT current_user,
  old_snapshot jsonb,
  new_snapshot jsonb,
  previous_hash text,
  entry_hash text NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS lc_critical_change_journal_target_idx
  ON public.lc_critical_change_journal(table_name, row_id, id DESC);

CREATE INDEX IF NOT EXISTS lc_critical_change_journal_changed_at_idx
  ON public.lc_critical_change_journal(changed_at DESC);

REVOKE ALL ON TABLE public.lc_critical_change_journal FROM PUBLIC;
REVOKE ALL ON SEQUENCE public.lc_critical_change_journal_id_seq FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lingqi_app') THEN
    REVOKE ALL ON TABLE public.lc_critical_change_journal FROM lingqi_app;
    REVOKE ALL ON SEQUENCE public.lc_critical_change_journal_id_seq FROM lingqi_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    REVOKE ALL ON TABLE public.lc_critical_change_journal FROM service_role;
    REVOKE ALL ON SEQUENCE public.lc_critical_change_journal_id_seq FROM service_role;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.lc_private_audit_snapshot(source jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT source - ARRAY[
    'password_hash',
    'phone',
    'email',
    'wechat_openid',
    'wechat_unionid',
    'wechat_mini_openid',
    'contact',
    'contact_note',
    'leader_contact',
    'private_evidence_files',
    'files',
    'evidence_files',
    'proof_files',
    'related_files',
    'payment_proof',
    'account_name',
    'account_identifier',
    'last_seen_at',
    'updated_at',
    'red_boost',
    'black_boost',
    'like_count',
    'dislike_count',
    'joy_count',
    'comment_count',
    'view_count',
    'meaningful_activity_at'
  ];
$$;

CREATE OR REPLACE FUNCTION public.lc_record_critical_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  old_value jsonb;
  new_value jsonb;
  target_id text;
  changed_at_value timestamptz := clock_timestamp();
  previous_hash_value text;
  entry_hash_value text;
BEGIN
  old_value := CASE WHEN TG_OP = 'INSERT' THEN NULL
                    ELSE public.lc_private_audit_snapshot(to_jsonb(OLD)) END;
  new_value := CASE WHEN TG_OP = 'DELETE' THEN NULL
                    ELSE public.lc_private_audit_snapshot(to_jsonb(NEW)) END;

  IF TG_OP = 'UPDATE' AND old_value = new_value THEN
    RETURN NEW;
  END IF;

  target_id := COALESCE(new_value ->> 'id', old_value ->> 'id');
  PERFORM pg_advisory_xact_lock(hashtext('lc_critical_change_journal'));

  SELECT journal.entry_hash
    INTO previous_hash_value
    FROM public.lc_critical_change_journal journal
    ORDER BY journal.id DESC
    LIMIT 1;

  entry_hash_value := encode(digest(convert_to(
    jsonb_build_object(
      'version', 'lc-critical-change-v1',
      'table_name', TG_TABLE_NAME,
      'row_id', target_id,
      'operation', TG_OP,
      'changed_at', changed_at_value,
      'database_actor', session_user,
      'old_snapshot', old_value,
      'new_snapshot', new_value,
      'previous_hash', previous_hash_value
    )::text,
    'UTF8'
  ), 'sha256'), 'hex');

  INSERT INTO public.lc_critical_change_journal (
    table_name,
    row_id,
    operation,
    changed_at,
    database_actor,
    old_snapshot,
    new_snapshot,
    previous_hash,
    entry_hash
  ) VALUES (
    TG_TABLE_NAME,
    target_id,
    TG_OP,
    changed_at_value,
    session_user,
    old_value,
    new_value,
    previous_hash_value,
    entry_hash_value
  );

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

REVOKE ALL ON FUNCTION public.lc_private_audit_snapshot(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lc_record_critical_change() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.lc_reject_critical_journal_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'lc_critical_change_journal is append-only';
END;
$$;

REVOKE ALL ON FUNCTION public.lc_reject_critical_journal_mutation() FROM PUBLIC;

DROP TRIGGER IF EXISTS lc_critical_change_journal_immutable
  ON public.lc_critical_change_journal;

CREATE TRIGGER lc_critical_change_journal_immutable
BEFORE UPDATE OR DELETE ON public.lc_critical_change_journal
FOR EACH ROW EXECUTE FUNCTION public.lc_reject_critical_journal_mutation();

DO $$
DECLARE
  target_table text;
  target_tables text[] := ARRAY[
    'lc_rankings',
    'lc_comments',
    'lc_commissions',
    'lc_carpools',
    'lc_dm_ratings',
    'lc_store_ratings',
    'lc_entity_ratings',
    'lc_script_ratings',
    'lc_dm_dossiers',
    'lc_dm_dossier_claims',
    'lc_dossier_edits',
    'lc_public_reviews',
    'lc_guides',
    'lc_creator_withdrawals',
    'lc_dm_identity_withdrawals',
    'lc_ranking_edit_requests',
    'lc_ranking_versions'
  ];
BEGIN
  FOREACH target_table IN ARRAY target_tables LOOP
    IF to_regclass('public.' || target_table) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS lc_critical_change_journal_row ON public.%I', target_table);
      EXECUTE format(
        'CREATE TRIGGER lc_critical_change_journal_row '
        'AFTER INSERT OR UPDATE OR DELETE ON public.%I '
        'FOR EACH ROW EXECUTE FUNCTION public.lc_record_critical_change()',
        target_table
      );
    END IF;
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS lc_critical_change_journal_profile_security
  ON public.lc_profiles;

CREATE TRIGGER lc_critical_change_journal_profile_security
AFTER UPDATE OF role, is_banned, ban_reason, is_realname, verified_dm, verified_shop
ON public.lc_profiles
FOR EACH ROW
EXECUTE FUNCTION public.lc_record_critical_change();
