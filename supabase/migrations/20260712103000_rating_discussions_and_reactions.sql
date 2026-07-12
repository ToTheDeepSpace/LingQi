create table if not exists public.lc_rating_discussion_nodes (
  id uuid primary key default gen_random_uuid(),
  rating_type text not null check (rating_type in ('dm', 'store')),
  rating_id uuid not null,
  node_type text not null check (node_type in ('official_response', 'reviewer_followup')),
  parent_id uuid references public.lc_rating_discussion_nodes(id) on delete cascade,
  profile_id uuid references public.lc_profiles(id) on delete set null,
  profile_name text not null default '',
  is_anonymous boolean not null default false,
  content text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'hidden')),
  moderation_precheck jsonb,
  reviewed_by uuid references public.lc_profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lc_rating_discussion_parent_shape check (
    (node_type = 'official_response' and parent_id is null)
    or (node_type = 'reviewer_followup' and parent_id is not null)
  )
);

create unique index if not exists lc_rating_discussion_one_official_active
  on public.lc_rating_discussion_nodes(rating_type, rating_id)
  where node_type = 'official_response' and status <> 'rejected';

create unique index if not exists lc_rating_discussion_one_followup_active
  on public.lc_rating_discussion_nodes(parent_id)
  where node_type = 'reviewer_followup' and status <> 'rejected';

create index if not exists lc_rating_discussion_public_lookup
  on public.lc_rating_discussion_nodes(rating_type, rating_id, status, created_at);

create table if not exists public.lc_rating_reaction_votes (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('dm_rating', 'store_rating', 'discussion_node')),
  target_id uuid not null,
  profile_id uuid not null references public.lc_profiles(id) on delete cascade,
  vote_type text not null check (vote_type in ('like', 'dislike')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (target_type, target_id, profile_id)
);

create index if not exists lc_rating_reaction_target_lookup
  on public.lc_rating_reaction_votes(target_type, target_id, vote_type);

alter table public.lc_rating_discussion_nodes enable row level security;
alter table public.lc_rating_reaction_votes enable row level security;

grant select, insert, update on public.lc_rating_discussion_nodes to service_role;
grant select, insert, update, delete on public.lc_rating_reaction_votes to service_role;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'lingqi_app') then
    grant select, insert, update on public.lc_rating_discussion_nodes to lingqi_app;
    grant select, insert, update, delete on public.lc_rating_reaction_votes to lingqi_app;
  end if;
end $$;
