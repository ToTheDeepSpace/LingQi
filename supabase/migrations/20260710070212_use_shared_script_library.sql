CREATE TABLE IF NOT EXISTS public.lc_script_library_legacy_map (
  legacy_script_id uuid PRIMARY KEY,
  shared_script_id uuid NOT NULL,
  script_name text NOT NULL,
  mapped_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.lc_script_library_legacy_map (legacy_script_id, shared_script_id, script_name)
VALUES
  ('76c8af22-7007-4aef-9739-4d36ddc2f29e', '0faace61-a3a9-4dcb-8db8-cc954c3eb88a', '坏孩子'),
  ('e9522339-a9e8-49e7-8936-f5fd763d004f', '8dce5b84-35e2-46f4-9a2e-ba7913725f0f', '归途七万里'),
  ('d469f40d-7e0f-4552-98ee-cf51314ef27a', '595ecd09-5253-4b17-9cda-32ea45c8818f', '暗夜将至'),
  ('6901e550-85f4-43cd-b696-c8f1a45c4450', '0b2a1027-5254-45bd-965f-d9b34b51c0e5', '流氓叙事')
ON CONFLICT (legacy_script_id) DO UPDATE
SET shared_script_id = EXCLUDED.shared_script_id,
    script_name = EXCLUDED.script_name,
    mapped_at = now();

ALTER TABLE public.lc_carpools DROP CONSTRAINT IF EXISTS lc_carpools_script_id_fkey;
ALTER TABLE public.lc_commissions DROP CONSTRAINT IF EXISTS lc_commissions_script_id_fkey;
ALTER TABLE public.lc_profile_role_preferences DROP CONSTRAINT IF EXISTS lc_profile_role_preferences_script_id_fkey;
ALTER TABLE public.lc_script_contributions DROP CONSTRAINT IF EXISTS lc_script_contributions_script_id_fkey;

UPDATE public.lc_carpools target
SET script_id = map.shared_script_id
FROM public.lc_script_library_legacy_map map
WHERE target.script_id = map.legacy_script_id;

UPDATE public.lc_commissions target
SET script_id = map.shared_script_id
FROM public.lc_script_library_legacy_map map
WHERE target.script_id = map.legacy_script_id;

UPDATE public.lc_profile_role_preferences target
SET script_id = map.shared_script_id
FROM public.lc_script_library_legacy_map map
WHERE target.script_id = map.legacy_script_id;

UPDATE public.lc_script_contributions target
SET script_id = map.shared_script_id
FROM public.lc_script_library_legacy_map map
WHERE target.script_id = map.legacy_script_id;

UPDATE public.lc_script_ratings target
SET script_id = map.shared_script_id::text
FROM public.lc_script_library_legacy_map map
WHERE target.script_id = map.legacy_script_id::text;

UPDATE public.lc_dm_ratings target
SET script_id = map.shared_script_id::text
FROM public.lc_script_library_legacy_map map
WHERE target.script_id = map.legacy_script_id::text;

WITH role_map AS (
  SELECT
    'player:' || role.id::text AS legacy_target_id,
    'shared:' || map.shared_script_id::text || ':player:' || md5(
      lower(regexp_replace(trim(role.role_name), '[[:space:]·•・._—–/\\|,，、()（）【】\[\]-]+', '', 'g'))
    ) AS shared_target_id
  FROM public.script_player_roles role
  JOIN public.lc_script_library_legacy_map map ON map.legacy_script_id = role.script_id
  UNION ALL
  SELECT
    'actor:' || role.id::text AS legacy_target_id,
    'shared:' || map.shared_script_id::text || ':actor:' || md5(
      lower(regexp_replace(trim(role.role_name), '[[:space:]·•・._—–/\\|,，、()（）【】\[\]-]+', '', 'g'))
    ) AS shared_target_id
  FROM public.script_actor_roles role
  JOIN public.lc_script_library_legacy_map map ON map.legacy_script_id = role.script_id
)
UPDATE public.lc_entity_tags target
SET target_id = role_map.shared_target_id,
    updated_at = now()
FROM role_map
WHERE target.target_type = 'script_role'
  AND target.target_id = role_map.legacy_target_id;

WITH role_map AS (
  SELECT
    'player:' || role.id::text AS legacy_target_id,
    'shared:' || map.shared_script_id::text || ':player:' || md5(
      lower(regexp_replace(trim(role.role_name), '[[:space:]·•・._—–/\\|,，、()（）【】\[\]-]+', '', 'g'))
    ) AS shared_target_id
  FROM public.script_player_roles role
  JOIN public.lc_script_library_legacy_map map ON map.legacy_script_id = role.script_id
  UNION ALL
  SELECT
    'actor:' || role.id::text AS legacy_target_id,
    'shared:' || map.shared_script_id::text || ':actor:' || md5(
      lower(regexp_replace(trim(role.role_name), '[[:space:]·•・._—–/\\|,，、()（）【】\[\]-]+', '', 'g'))
    ) AS shared_target_id
  FROM public.script_actor_roles role
  JOIN public.lc_script_library_legacy_map map ON map.legacy_script_id = role.script_id
)
UPDATE public.lc_entity_ratings target
SET target_id = role_map.shared_target_id,
    updated_at = now()
FROM role_map
WHERE target.target_type = 'script_role'
  AND target.target_id = role_map.legacy_target_id;

WITH role_map AS (
  SELECT
    'player:' || role.id::text AS legacy_target_id,
    'shared:' || map.shared_script_id::text || ':player:' || md5(
      lower(regexp_replace(trim(role.role_name), '[[:space:]·•・._—–/\\|,，、()（）【】\[\]-]+', '', 'g'))
    ) AS shared_target_id
  FROM public.script_player_roles role
  JOIN public.lc_script_library_legacy_map map ON map.legacy_script_id = role.script_id
  UNION ALL
  SELECT
    'actor:' || role.id::text AS legacy_target_id,
    'shared:' || map.shared_script_id::text || ':actor:' || md5(
      lower(regexp_replace(trim(role.role_name), '[[:space:]·•・._—–/\\|,，、()（）【】\[\]-]+', '', 'g'))
    ) AS shared_target_id
  FROM public.script_actor_roles role
  JOIN public.lc_script_library_legacy_map map ON map.legacy_script_id = role.script_id
)
UPDATE public.lc_public_reviews target
SET payload = jsonb_set(target.payload, '{target_id}', to_jsonb(role_map.shared_target_id), false),
    updated_at = now()
FROM role_map
WHERE target.payload->>'target_id' = role_map.legacy_target_id;

CREATE INDEX IF NOT EXISTS lc_script_library_legacy_map_shared_idx
  ON public.lc_script_library_legacy_map(shared_script_id);
