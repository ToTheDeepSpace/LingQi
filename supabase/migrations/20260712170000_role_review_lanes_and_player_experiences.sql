-- Role reviews have two independent lanes. Player script experience records are
-- structured and can be combined with approved activity at read time.

alter table if exists public.lc_entity_ratings
  add column if not exists review_lane text;

update public.lc_entity_ratings
set review_lane = case when spoiler_level = 'spoiler' then 'deep_spoiler' else 'experience' end
where review_lane is null;

alter table if exists public.lc_entity_ratings
  alter column review_lane set default 'experience',
  alter column review_lane set not null;

alter table if exists public.lc_entity_ratings
  drop constraint if exists lc_entity_ratings_review_lane_check;

alter table if exists public.lc_entity_ratings
  add constraint lc_entity_ratings_review_lane_check
  check (review_lane in ('experience', 'deep_spoiler'));

drop index if exists public.lc_entity_ratings_once_unique;

create unique index if not exists lc_entity_ratings_lane_unique
  on public.lc_entity_ratings(target_type, target_id, profile_id, review_lane);

create index if not exists lc_entity_ratings_lane_feed_idx
  on public.lc_entity_ratings(target_type, target_id, review_lane, status, created_at desc);

create table if not exists public.lc_player_script_records (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.lc_profiles(id) on delete cascade,
  script_id text not null,
  script_name text not null,
  is_manual boolean not null default true,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists lc_player_script_records_profile_script_unique
  on public.lc_player_script_records(profile_id, script_id);

create index if not exists lc_player_script_records_public_idx
  on public.lc_player_script_records(profile_id, is_hidden, updated_at desc);

alter table public.lc_player_script_records enable row level security;
revoke all on table public.lc_player_script_records from anon, authenticated, service_role;
grant select, insert, update, delete on table public.lc_player_script_records to service_role;
