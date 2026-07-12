alter table public.lc_dm_store_affiliations
  drop constraint if exists lc_dm_store_affiliations_requested_by_role_check;

alter table public.lc_dm_store_affiliations
  add constraint lc_dm_store_affiliations_requested_by_role_check
  check (requested_by_role in ('dm', 'store', 'admin', 'legacy', 'community'));

alter table public.lc_reports
  drop constraint if exists lc_reports_target_type_check;

alter table public.lc_reports
  add constraint lc_reports_target_type_check
  check (target_type in ('carpool', 'ranking', 'comment', 'commission', 'profile', 'dm_affiliation'));

alter table public.lc_reports
  add column if not exists evidence_files jsonb not null default '[]'::jsonb;
