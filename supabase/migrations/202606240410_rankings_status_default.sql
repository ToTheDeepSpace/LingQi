-- Ensure newly submitted red/black/white ranking posts always enter moderation.

alter table if exists lc_rankings
  alter column status set default 'pending';

update lc_rankings
set status = 'pending'
where status is null;

alter table if exists lc_rankings
  alter column status set not null;

alter table if exists lc_rankings
  alter column files set default '[]'::jsonb;

update lc_rankings
set files = '[]'::jsonb
where files is null;
