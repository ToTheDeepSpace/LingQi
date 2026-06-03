-- Security assessment support for UGC compliance.
-- Additive only: records future operations and allows admin-side account restriction.

alter table public.lc_profiles
  add column if not exists is_banned boolean not null default false,
  add column if not exists ban_reason text,
  add column if not exists banned_at timestamptz;

create index if not exists lc_profiles_is_banned_idx
  on public.lc_profiles (is_banned)
  where is_banned = true;

create table if not exists public.lc_security_events (
  id uuid primary key default gen_random_uuid(),
  actor_id text,
  actor_role text not null default 'anonymous',
  action text not null,
  target_type text,
  target_id text,
  ip_address text,
  user_agent text,
  request_path text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists lc_security_events_created_at_idx
  on public.lc_security_events (created_at desc);

create index if not exists lc_security_events_actor_idx
  on public.lc_security_events (actor_id, created_at desc);

create index if not exists lc_security_events_target_idx
  on public.lc_security_events (target_type, target_id, created_at desc);

create index if not exists lc_security_events_action_idx
  on public.lc_security_events (action, created_at desc);

alter table public.lc_security_events enable row level security;

grant all on table public.lc_security_events to service_role;
