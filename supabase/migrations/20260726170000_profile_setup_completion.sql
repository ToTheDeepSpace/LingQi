ALTER TABLE public.lc_profiles
  ADD COLUMN IF NOT EXISTS profile_setup_completed boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.lc_profiles.profile_setup_completed IS
  'Whether the account has an approved initial public profile. Existing accounts remain complete; new miniapp accounts start incomplete.';
