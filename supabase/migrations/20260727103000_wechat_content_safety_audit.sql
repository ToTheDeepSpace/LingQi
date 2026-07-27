-- WeChat mini-program UGC content safety audit.
-- Additive only: does not alter or rewrite existing business records.

create table if not exists public.lc_wechat_content_checks (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.lc_profiles(id) on delete set null,
  check_type text not null check (check_type in ('text', 'image')),
  business_scene text not null,
  target_type text,
  target_id text,
  resource_hash text not null,
  provider text not null default 'wechat',
  status text not null check (status in ('pending', 'pass', 'review', 'risky', 'error')),
  suggest text,
  label integer,
  trace_id text,
  errcode integer not null default 0,
  error_message text,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists lc_wechat_content_checks_trace_id_unique
  on public.lc_wechat_content_checks (trace_id)
  where trace_id is not null;

create index if not exists lc_wechat_content_checks_profile_created_idx
  on public.lc_wechat_content_checks (profile_id, created_at desc);

create index if not exists lc_wechat_content_checks_target_idx
  on public.lc_wechat_content_checks (target_type, target_id, created_at desc);

create index if not exists lc_wechat_content_checks_resource_idx
  on public.lc_wechat_content_checks (resource_hash, created_at desc);

create index if not exists lc_wechat_content_checks_pending_idx
  on public.lc_wechat_content_checks (status, created_at)
  where status in ('pending', 'error');

alter table public.lc_wechat_content_checks enable row level security;

grant all on table public.lc_wechat_content_checks to service_role;
