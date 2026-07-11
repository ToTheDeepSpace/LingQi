-- Add structured, reviewable wiki fields to DM dossiers without changing existing public data.

alter table if exists public.lc_dm_dossiers
  add column if not exists dm_started_month date,
  add column if not exists birth_year integer,
  add column if not exists height_cm integer,
  add column if not exists weight_kg numeric(5, 1),
  add column if not exists bio text,
  add column if not exists common_scripts jsonb not null default '[]'::jsonb,
  add column if not exists career_history jsonb not null default '[]'::jsonb,
  add column if not exists related_profiles jsonb not null default '[]'::jsonb,
  add column if not exists related_stores jsonb not null default '[]'::jsonb;

alter table if exists public.lc_dm_ratings
  add column if not exists store_dossier_id uuid references public.lc_dm_dossiers(id) on delete set null;

create index if not exists idx_lc_dm_ratings_store_dossier
  on public.lc_dm_ratings(store_dossier_id, status, played_on desc)
  where store_dossier_id is not null;

alter table if exists public.lc_dm_dossiers
  drop constraint if exists lc_dm_dossiers_birth_year_check,
  drop constraint if exists lc_dm_dossiers_height_cm_check,
  drop constraint if exists lc_dm_dossiers_weight_kg_check,
  drop constraint if exists lc_dm_dossiers_bio_check,
  drop constraint if exists lc_dm_dossiers_common_scripts_array_check,
  drop constraint if exists lc_dm_dossiers_career_history_array_check,
  drop constraint if exists lc_dm_dossiers_related_profiles_array_check,
  drop constraint if exists lc_dm_dossiers_related_stores_array_check;

alter table if exists public.lc_dm_dossiers
  add constraint lc_dm_dossiers_birth_year_check
    check (birth_year is null or birth_year between 1900 and 2100),
  add constraint lc_dm_dossiers_height_cm_check
    check (height_cm is null or height_cm between 100 and 250),
  add constraint lc_dm_dossiers_weight_kg_check
    check (weight_kg is null or weight_kg between 25 and 300),
  add constraint lc_dm_dossiers_bio_check
    check (bio is null or char_length(bio) <= 3000),
  add constraint lc_dm_dossiers_common_scripts_array_check
    check (jsonb_typeof(common_scripts) = 'array'),
  add constraint lc_dm_dossiers_career_history_array_check
    check (jsonb_typeof(career_history) = 'array'),
  add constraint lc_dm_dossiers_related_profiles_array_check
    check (jsonb_typeof(related_profiles) = 'array'),
  add constraint lc_dm_dossiers_related_stores_array_check
    check (jsonb_typeof(related_stores) = 'array');
