-- Extend unclaimed dossier wall from DM only to DM + stores.
alter table public.lc_dm_dossiers
  add column if not exists entity_type text not null default 'dm';

alter table public.lc_dm_dossiers
  drop constraint if exists lc_dm_dossiers_entity_type_check;

alter table public.lc_dm_dossiers
  add constraint lc_dm_dossiers_entity_type_check
  check (entity_type in ('dm', 'store'));

create index if not exists idx_lc_dm_dossiers_entity_status_city
  on public.lc_dm_dossiers(entity_type, status, city);
