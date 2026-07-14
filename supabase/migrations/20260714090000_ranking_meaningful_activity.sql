alter table public.lc_rankings
  add column if not exists last_activity_at timestamptz;

update public.lc_rankings
set last_activity_at = created_at
where last_activity_at is null;

alter table public.lc_rankings
  alter column last_activity_at set default now();

create index if not exists lc_rankings_public_activity_idx
  on public.lc_rankings(status, type, last_activity_at desc);

comment on column public.lc_rankings.last_activity_at is
  'Only changes for approved event progress, related-party responses, evidence publication, or admin corrections. Votes and ordinary comments do not bump the feed.';
