-- 剧幕录账号会话版本：密码、角色或封禁状态变化后旧 JWT 立即失效。
-- Additive only: 不改写业务字段，已有账号从版本 1 开始。

ALTER TABLE public.lc_profiles
  ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 1;

ALTER TABLE public.lc_profiles
  DROP CONSTRAINT IF EXISTS lc_profiles_session_version_positive;

ALTER TABLE public.lc_profiles
  ADD CONSTRAINT lc_profiles_session_version_positive
  CHECK (session_version > 0);

CREATE OR REPLACE FUNCTION public.lc_bump_profile_session_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.password_hash IS DISTINCT FROM OLD.password_hash
     OR NEW.role IS DISTINCT FROM OLD.role
     OR NEW.is_banned IS DISTINCT FROM OLD.is_banned THEN
    NEW.session_version := OLD.session_version + 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lc_profiles_bump_session_version
  ON public.lc_profiles;

CREATE TRIGGER lc_profiles_bump_session_version
BEFORE UPDATE OF password_hash, role, is_banned
ON public.lc_profiles
FOR EACH ROW
EXECUTE FUNCTION public.lc_bump_profile_session_version();
