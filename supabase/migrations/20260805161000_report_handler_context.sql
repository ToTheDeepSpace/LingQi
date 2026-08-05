-- Preserve the exact target revision used by an admin report decision so a later
-- reopen can avoid restoring content that has changed since moderation.

alter table public.lc_reports
  add column if not exists handler_context jsonb not null default '{}'::jsonb;
