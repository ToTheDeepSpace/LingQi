-- Store visit ratings: one record per visit, weighted by unique player in summaries.

create table if not exists public.lc_store_ratings (
  id uuid primary key default gen_random_uuid(),
  store_dossier_id uuid not null references public.lc_dm_dossiers(id) on delete restrict,
  profile_id uuid references public.lc_profiles(id) on delete set null,
  profile_name text not null default '',
  script_id text,
  script_name text not null,
  script_key text not null,
  visited_on date not null,
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

create unique index if not exists idx_lc_store_ratings_unique_visit
  on public.lc_store_ratings(profile_id, store_dossier_id, script_key, visited_on)
  where profile_id is not null and status <> 'rejected';

create index if not exists idx_lc_store_ratings_public_feed
  on public.lc_store_ratings(store_dossier_id, status, visited_on desc, created_at desc);

create index if not exists idx_lc_store_ratings_pending
  on public.lc_store_ratings(status, created_at desc)
  where status = 'pending';

create index if not exists idx_lc_store_ratings_player
  on public.lc_store_ratings(profile_id, created_at desc)
  where profile_id is not null;

create index if not exists idx_lc_store_ratings_ip_rate
  on public.lc_store_ratings(submit_ip_hash, created_at desc)
  where submit_ip_hash is not null;

create index if not exists idx_lc_store_ratings_content_fingerprint
  on public.lc_store_ratings(content_fingerprint, created_at desc)
  where content_fingerprint is not null;

alter table public.lc_store_ratings enable row level security;

revoke all on table public.lc_store_ratings from anon, authenticated, service_role;
grant select, insert, update, delete on table public.lc_store_ratings to service_role;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'lingqi_app') then
    execute 'grant select, insert, update, delete on table public.lc_store_ratings to lingqi_app';
  end if;
end
$$;
