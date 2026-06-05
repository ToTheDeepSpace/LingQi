ALTER TABLE public.lc_profiles
  ADD COLUMN IF NOT EXISTS role_type text DEFAULT 'player',
  ADD COLUMN IF NOT EXISTS identity_roles text[] NOT NULL DEFAULT '{}'::text[];

UPDATE public.lc_profiles
SET role_type = COALESCE(NULLIF(role_type, ''), NULLIF(role, ''), 'player')
WHERE COALESCE(role_type, '') = '';

UPDATE public.lc_profiles
SET identity_roles = COALESCE(
  (
    SELECT array_agg(DISTINCT role_item)
    FROM unnest(ARRAY[
      NULLIF(role_type, ''),
      NULLIF(role, ''),
      CASE WHEN verified_dm THEN 'dm' ELSE NULL END,
      CASE WHEN verified_shop THEN 'shop' ELSE NULL END
    ]::text[]) AS role_item
    WHERE role_item IS NOT NULL
  ),
  ARRAY['player']::text[]
)
WHERE identity_roles = '{}'::text[];

CREATE INDEX IF NOT EXISTS lc_profiles_identity_roles_gin_idx
  ON public.lc_profiles USING gin(identity_roles);

ALTER TABLE public.lc_carpools
  ADD COLUMN IF NOT EXISTS source_project text NOT NULL DEFAULT 'lingqi';

CREATE UNIQUE INDEX IF NOT EXISTS lc_carpools_juzhanggui_schedule_id_uidx
  ON public.lc_carpools(juzhanggui_schedule_id)
  WHERE juzhanggui_schedule_id IS NOT NULL;
