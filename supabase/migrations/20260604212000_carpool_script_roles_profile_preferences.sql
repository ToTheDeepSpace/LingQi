alter table if exists public.lc_profiles
  add column if not exists gender text,
  add column if not exists sexual_orientation text,
  add column if not exists preferred_story_lines text[] not null default '{}'::text[];

alter table if exists public.lc_carpools
  add column if not exists script_id uuid references public.scripts(id) on delete set null,
  add column if not exists script_roles jsonb not null default '[]'::jsonb,
  add column if not exists seated_roles jsonb not null default '[]'::jsonb;

create index if not exists idx_lc_carpools_script_id
  on public.lc_carpools(script_id);

alter table if exists public.lc_carpool_applications
  add column if not exists applicant_avatar text,
  add column if not exists applicant_gender text,
  add column if not exists role_gender text;
