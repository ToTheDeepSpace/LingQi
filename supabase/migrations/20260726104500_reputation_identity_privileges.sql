-- The Tencent PostgreSQL runtime currently uses the shared jusichen_app role.
-- Identity credential hashes stay private; the application may only resolve
-- them through the SECURITY DEFINER function.

BEGIN;

REVOKE ALL ON TABLE public.lc_reputation_identities FROM PUBLIC;
REVOKE ALL ON TABLE public.lc_reputation_identity_credentials FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'jusichen_app') THEN
    REVOKE ALL ON TABLE public.lc_reputation_identities FROM jusichen_app;
    REVOKE ALL ON TABLE public.lc_reputation_identity_credentials FROM jusichen_app;
    GRANT EXECUTE ON FUNCTION public.lc_resolve_reputation_identity(uuid) TO jusichen_app;
    GRANT EXECUTE ON FUNCTION public.lc_apply_ranking_vote(uuid, uuid, text, text, text, boolean) TO jusichen_app;
    GRANT EXECUTE ON FUNCTION public.lc_cancel_ranking_vote(uuid, uuid, text) TO jusichen_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lingqi_app') THEN
    REVOKE ALL ON TABLE public.lc_reputation_identities FROM lingqi_app;
    REVOKE ALL ON TABLE public.lc_reputation_identity_credentials FROM lingqi_app;
    GRANT EXECUTE ON FUNCTION public.lc_resolve_reputation_identity(uuid) TO lingqi_app;
    GRANT EXECUTE ON FUNCTION public.lc_apply_ranking_vote(uuid, uuid, text, text, text, boolean) TO lingqi_app;
    GRANT EXECUTE ON FUNCTION public.lc_cancel_ranking_vote(uuid, uuid, text) TO lingqi_app;
  END IF;
END;
$$;

COMMIT;
