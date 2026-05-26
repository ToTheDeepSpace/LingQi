-- 红黑榜身份、公开口碑与审核流补丁。
-- 已在 2026-05-26 通过 Supabase 管理接口应用到生产库。

alter table if exists lc_profiles
  add column if not exists is_realname boolean default false;

alter table if exists lc_rankings
  add column if not exists subject_url text,
  add column if not exists poster_id uuid references lc_profiles(id);

alter table if exists lc_votes
  add column if not exists voter_id uuid references lc_profiles(id),
  add column if not exists voter_name text,
  add column if not exists voter_is_realname boolean default false;

alter table if exists lc_comments
  add column if not exists author_id uuid references lc_profiles(id);

alter table if exists lc_claims
  add column if not exists claimant_id uuid references lc_profiles(id),
  add column if not exists claimant_name text;

create table if not exists lc_comment_votes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid references lc_comments(id) on delete cascade,
  voter_id uuid references lc_profiles(id),
  created_at timestamptz default now()
);

create unique index if not exists lc_votes_one_per_user_per_ranking
  on lc_votes(ranking_id, voter_id)
  where voter_id is not null;

create unique index if not exists lc_comment_votes_one_per_user_per_comment
  on lc_comment_votes(comment_id, voter_id)
  where voter_id is not null;
