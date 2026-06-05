-- 灵契师公开主页：可接本与角色清单。
-- 前端通过后端 API 读写，表本身不开给 anon/authenticated 直接访问。

create table if not exists public.lc_profile_role_preferences (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.lc_profiles(id) on delete cascade,
  script_id uuid references public.scripts(id) on delete set null,
  script_name text not null,
  role_name text not null,
  role_gender text,
  role_tags text[] not null default '{}'::text[],
  is_recommended boolean not null default false,
  note text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lc_profile_role_preferences_script_name_len check (char_length(script_name) between 1 and 120),
  constraint lc_profile_role_preferences_role_name_len check (char_length(role_name) between 1 and 80),
  constraint lc_profile_role_preferences_note_len check (char_length(note) <= 200)
);

alter table if exists public.lc_profile_role_preferences enable row level security;

revoke all on table public.lc_profile_role_preferences from anon, authenticated, service_role;
grant select, insert, update, delete on table public.lc_profile_role_preferences to service_role;

create index if not exists lc_profile_role_preferences_profile_idx
  on public.lc_profile_role_preferences(profile_id, sort_order, created_at);

create index if not exists lc_profile_role_preferences_script_idx
  on public.lc_profile_role_preferences(script_id);
