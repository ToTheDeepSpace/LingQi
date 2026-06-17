-- 灵契：通用实体评分。第一批用于剧本角色（玩家角色、DM、场控、NPC、助演等）。

create table if not exists lc_entity_ratings (
  id uuid primary key default gen_random_uuid(),
  target_type text not null,
  target_id text not null,
  target_title text,
  profile_id uuid references lc_profiles(id) on delete set null,
  profile_name text,
  rating integer not null check (rating >= 1 and rating <= 5),
  content text not null default '',
  spoiler_level text not null default 'none',
  entity_metadata jsonb not null default '{}'::jsonb,
  status text not null default 'approved',
  moderation_precheck jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists lc_entity_ratings_once_unique
  on lc_entity_ratings(target_type, target_id, profile_id);

create index if not exists lc_entity_ratings_target_idx
  on lc_entity_ratings(target_type, target_id, status, created_at desc);

create index if not exists lc_entity_ratings_profile_idx
  on lc_entity_ratings(profile_id, created_at desc);
