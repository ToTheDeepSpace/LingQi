alter table if exists lc_rankings
  add column if not exists moderation_precheck jsonb not null default '{}'::jsonb;

alter table if exists lc_comments
  add column if not exists moderation_precheck jsonb not null default '{}'::jsonb;

alter table if exists lc_commissions
  add column if not exists moderation_precheck jsonb not null default '{}'::jsonb;

alter table if exists lc_carpools
  add column if not exists moderation_precheck jsonb not null default '{}'::jsonb;

alter table if exists lc_reports
  add column if not exists moderation_precheck jsonb not null default '{}'::jsonb;

alter table if exists lc_script_ratings
  add column if not exists moderation_precheck jsonb not null default '{}'::jsonb;

alter table if exists lc_script_contributions
  add column if not exists moderation_precheck jsonb not null default '{}'::jsonb;
