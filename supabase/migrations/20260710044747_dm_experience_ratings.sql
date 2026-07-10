-- LingQi DM experience ratings: one review per play, weighted by unique player in summaries.

alter table if exists public.lc_dm_dossiers
  add column if not exists merged_into uuid references public.lc_dm_dossiers(id) on delete set null,
  add column if not exists moderation_precheck jsonb not null default '{}'::jsonb;

create index if not exists idx_lc_dm_dossiers_merged_into
  on public.lc_dm_dossiers(merged_into)
  where merged_into is not null;

create table if not exists public.lc_dm_aliases (
  id uuid primary key default gen_random_uuid(),
  dm_dossier_id uuid not null references public.lc_dm_dossiers(id) on delete cascade,
  alias_name text not null,
  city text,
  workplace text,
  source_dossier_id uuid references public.lc_dm_dossiers(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_lc_dm_aliases_unique
  on public.lc_dm_aliases(dm_dossier_id, lower(alias_name));

create index if not exists idx_lc_dm_aliases_lookup
  on public.lc_dm_aliases(lower(alias_name), city);

create table if not exists public.lc_dm_ratings (
  id uuid primary key default gen_random_uuid(),
  dm_dossier_id uuid not null references public.lc_dm_dossiers(id) on delete restrict,
  profile_id uuid references public.lc_profiles(id) on delete set null,
  profile_name text not null default '',
  script_id text,
  script_name text not null,
  script_key text not null,
  store_id text,
  store_name text not null,
  played_on date not null,
  replay_number integer not null check (replay_number between 1 and 99),
  rating integer not null check (rating between 1 and 5),
  content text not null,
  tags text[] not null default '{}'::text[],
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'hidden')),
  moderation_precheck jsonb not null default '{}'::jsonb,
  anti_abuse jsonb not null default '{}'::jsonb,
  content_fingerprint text,
  submit_ip_hash text,
  reviewed_by uuid references public.lc_profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_lc_dm_ratings_unique_experience
  on public.lc_dm_ratings(profile_id, dm_dossier_id, script_key, played_on, replay_number)
  where profile_id is not null and status <> 'rejected';

create index if not exists idx_lc_dm_ratings_public_feed
  on public.lc_dm_ratings(dm_dossier_id, status, played_on desc, created_at desc);

create index if not exists idx_lc_dm_ratings_player
  on public.lc_dm_ratings(profile_id, created_at desc)
  where profile_id is not null;

create index if not exists idx_lc_dm_ratings_ip_rate
  on public.lc_dm_ratings(submit_ip_hash, created_at desc)
  where submit_ip_hash is not null;

create index if not exists idx_lc_dm_ratings_content_fingerprint
  on public.lc_dm_ratings(content_fingerprint, created_at desc)
  where content_fingerprint is not null;

alter table if exists public.lc_site_messages
  add column if not exists category text not null default 'general',
  add column if not exists moderation_precheck jsonb not null default '{}'::jsonb;

alter table public.lc_dm_aliases enable row level security;
alter table public.lc_dm_ratings enable row level security;

revoke all on table public.lc_dm_aliases from anon, authenticated, service_role;
revoke all on table public.lc_dm_ratings from anon, authenticated, service_role;

grant select, insert, update, delete on table public.lc_dm_aliases to service_role;
grant select, insert, update, delete on table public.lc_dm_ratings to service_role;
