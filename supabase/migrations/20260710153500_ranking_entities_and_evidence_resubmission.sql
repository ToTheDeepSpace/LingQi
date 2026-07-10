alter table if exists public.lc_dm_dossiers
  add column if not exists employment_status text not null default 'unknown',
  add column if not exists employer_store_id uuid references public.lc_dm_dossiers(id) on delete set null;

alter table if exists public.lc_dm_dossiers
  drop constraint if exists lc_dm_dossiers_employment_status_check;

alter table if exists public.lc_dm_dossiers
  add constraint lc_dm_dossiers_employment_status_check
  check (employment_status in ('unknown', 'store_affiliated', 'freelance'));

create index if not exists idx_lc_dm_dossiers_employer_store
  on public.lc_dm_dossiers(employer_store_id)
  where employer_store_id is not null;

alter table if exists public.lc_rankings
  add column if not exists subject_dossier_id uuid references public.lc_dm_dossiers(id) on delete set null,
  add column if not exists event_date date,
  add column if not exists event_script_id uuid,
  add column if not exists event_script_name text,
  add column if not exists event_store_dossier_id uuid references public.lc_dm_dossiers(id) on delete set null,
  add column if not exists event_store_name text,
  add column if not exists dm_employment_status_suggestion text,
  add column if not exists dm_employer_store_id_suggestion uuid references public.lc_dm_dossiers(id) on delete set null,
  add column if not exists evidence_required boolean not null default false,
  add column if not exists revision_kind text,
  add column if not exists revision_requested_at timestamptz,
  add column if not exists revision_count integer not null default 0;

alter table if exists public.lc_rankings
  drop constraint if exists lc_rankings_revision_kind_check;

alter table if exists public.lc_rankings
  drop constraint if exists lc_rankings_dm_employment_suggestion_check;

alter table if exists public.lc_rankings
  add constraint lc_rankings_revision_kind_check
  check (revision_kind is null or revision_kind in ('content', 'evidence'));

alter table if exists public.lc_rankings
  add constraint lc_rankings_dm_employment_suggestion_check
  check (dm_employment_status_suggestion is null or dm_employment_status_suggestion in ('store_affiliated', 'freelance'));

with exact_matches as (
  select
    ranking.id as ranking_id,
    min(dossier.id::text)::uuid as dossier_id,
    count(*) as match_count
  from public.lc_rankings ranking
  join public.lc_dm_dossiers dossier
    on dossier.entity_type = ranking.subject_type
   and dossier.status = 'approved'
   and lower(regexp_replace(trim(dossier.dm_name), '[[:space:]·•・._—–/\\|,，、()（）【】\[\]-]+', '', 'g'))
       = lower(regexp_replace(trim(ranking.subject_name), '[[:space:]·•・._—–/\\|,，、()（）【】\[\]-]+', '', 'g'))
   and (ranking.subject_city is null or dossier.city is null or dossier.city = ranking.subject_city)
  where ranking.subject_dossier_id is null
    and ranking.subject_type in ('dm', 'store')
  group by ranking.id
)
update public.lc_rankings ranking
set subject_dossier_id = exact_matches.dossier_id
from exact_matches
where ranking.id = exact_matches.ranking_id
  and exact_matches.match_count = 1;

with employer_matches as (
  select
    dm.id as dm_id,
    min(store.id::text)::uuid as store_id,
    count(*) as match_count
  from public.lc_dm_dossiers dm
  join public.lc_dm_dossiers store
    on store.entity_type = 'store'
   and store.status = 'approved'
   and lower(regexp_replace(trim(store.dm_name), '[[:space:]·•・._—–/\\|,，、()（）【】\[\]-]+', '', 'g'))
       = lower(regexp_replace(trim(dm.workplace), '[[:space:]·•・._—–/\\|,，、()（）【】\[\]-]+', '', 'g'))
   and (dm.city is null or store.city is null or dm.city = store.city)
  where dm.entity_type = 'dm'
    and dm.status = 'approved'
    and dm.employment_status = 'unknown'
    and dm.employer_store_id is null
    and nullif(trim(dm.workplace), '') is not null
  group by dm.id
)
update public.lc_dm_dossiers dm
set employment_status = 'store_affiliated',
    employer_store_id = employer_matches.store_id
from employer_matches
where dm.id = employer_matches.dm_id
  and employer_matches.match_count = 1;

create index if not exists idx_lc_rankings_subject_dossier
  on public.lc_rankings(subject_dossier_id, status, created_at desc)
  where subject_dossier_id is not null;

create index if not exists idx_lc_rankings_event_store_dossier
  on public.lc_rankings(event_store_dossier_id, created_at desc)
  where event_store_dossier_id is not null;

create index if not exists idx_lc_rankings_revision_required
  on public.lc_rankings(poster_id, status, revision_requested_at desc)
  where status = 'rejected';
