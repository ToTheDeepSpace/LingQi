-- Store admin rewrite reasons for red/black/white ranking submissions.

alter table if exists lc_rankings
  add column if not exists reject_reason text;
