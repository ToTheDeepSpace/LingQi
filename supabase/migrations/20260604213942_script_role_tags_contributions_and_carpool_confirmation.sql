alter table if exists public.script_player_roles
  add column if not exists tags text[] not null default '{}'::text[];

alter table if exists public.lc_carpool_applications
  add column if not exists review_message text,
  add column if not exists reviewed_at timestamptz;

create table if not exists public.lc_script_contributions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.lc_profiles(id) on delete set null,
  profile_name text not null default '',
  script_id uuid references public.scripts(id) on delete set null,
  script_name text not null,
  player_roles jsonb not null default '[]'::jsonb,
  note text,
  status text not null default 'pending',
  reward_amount integer not null default 0,
  reviewed_by uuid references public.lc_profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lc_script_contributions_status_check
    check (status in ('pending', 'approved', 'rejected'))
);

alter table if exists public.lc_script_contributions enable row level security;

revoke all on table public.lc_script_contributions from anon, authenticated, service_role;
grant select, insert, update on table public.lc_script_contributions to service_role;

create index if not exists idx_lc_script_contributions_profile
  on public.lc_script_contributions(profile_id);

create index if not exists idx_lc_script_contributions_status
  on public.lc_script_contributions(status, created_at desc);
