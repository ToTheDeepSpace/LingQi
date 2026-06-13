-- 灵契：万物可 tag 与剧本评分

create table if not exists lc_entity_tags (
  id uuid primary key default gen_random_uuid(),
  target_type text not null,
  target_id text not null,
  tag text not null,
  normalized_tag text not null,
  creator_id uuid references lc_profiles(id) on delete set null,
  creator_name text,
  status text not null default 'approved',
  likes integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists lc_entity_tags_target_normalized_unique
  on lc_entity_tags(target_type, target_id, normalized_tag);

create index if not exists lc_entity_tags_target_idx
  on lc_entity_tags(target_type, target_id, likes desc, created_at asc);

create table if not exists lc_entity_tag_votes (
  id uuid primary key default gen_random_uuid(),
  tag_id uuid not null references lc_entity_tags(id) on delete cascade,
  voter_id uuid not null references lc_profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists lc_entity_tag_votes_once_unique
  on lc_entity_tag_votes(tag_id, voter_id);

create table if not exists lc_script_ratings (
  id uuid primary key default gen_random_uuid(),
  script_id text not null,
  script_name text,
  profile_id uuid references lc_profiles(id) on delete set null,
  profile_name text,
  rating integer not null check (rating >= 1 and rating <= 5),
  content text,
  tags text[] not null default '{}',
  status text not null default 'approved',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists lc_script_ratings_script_profile_unique
  on lc_script_ratings(script_id, profile_id);

create index if not exists lc_script_ratings_script_idx
  on lc_script_ratings(script_id, status, created_at desc);
