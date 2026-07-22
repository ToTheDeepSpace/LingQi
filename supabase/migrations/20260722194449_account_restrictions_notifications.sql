-- Separate merged account tombstones from moderation restrictions, and add
-- durable appeals and user-facing account notifications.

begin;

alter table if exists public.lc_profiles
  add column if not exists restriction_scope text,
  add column if not exists restriction_ends_at timestamptz;

alter table if exists public.lc_profiles
  drop constraint if exists lc_profiles_restriction_scope_check;

alter table if exists public.lc_profiles
  add constraint lc_profiles_restriction_scope_check
  check (restriction_scope is null or restriction_scope in ('publish', 'account'));

create table if not exists public.lc_account_restrictions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.lc_profiles(id) on delete cascade,
  scope text not null check (scope in ('publish', 'account')),
  reason text not null,
  status text not null default 'active'
    check (status in ('active', 'lifted', 'expired')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  profile_was_visible boolean not null default true,
  created_by uuid references public.lc_profiles(id) on delete set null,
  lifted_by uuid references public.lc_profiles(id) on delete set null,
  lifted_at timestamptz,
  admin_note text,
  restore_profile_on_lift boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lc_account_restrictions_reason_check
    check (char_length(trim(reason)) between 2 and 600),
  constraint lc_account_restrictions_time_check
    check (ends_at is null or ends_at > starts_at)
);

create unique index if not exists lc_account_restrictions_one_active_idx
  on public.lc_account_restrictions(profile_id)
  where status = 'active';

create index if not exists lc_account_restrictions_profile_history_idx
  on public.lc_account_restrictions(profile_id, created_at desc);

create index if not exists lc_account_restrictions_expiry_idx
  on public.lc_account_restrictions(ends_at)
  where status = 'active' and ends_at is not null;

create table if not exists public.lc_account_appeals (
  id uuid primary key default gen_random_uuid(),
  restriction_id uuid not null references public.lc_account_restrictions(id) on delete cascade,
  profile_id uuid not null references public.lc_profiles(id) on delete cascade,
  content text not null,
  evidence_urls text[] not null default '{}',
  status text not null default 'pending'
    check (status in ('pending', 'needs_info', 'approved', 'rejected', 'withdrawn')),
  admin_reply text,
  reviewed_by uuid references public.lc_profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lc_account_appeals_content_check
    check (char_length(trim(content)) between 10 and 2000),
  constraint lc_account_appeals_evidence_count_check
    check (cardinality(evidence_urls) <= 6)
);

create unique index if not exists lc_account_appeals_one_open_idx
  on public.lc_account_appeals(profile_id)
  where status in ('pending', 'needs_info');

create index if not exists lc_account_appeals_review_queue_idx
  on public.lc_account_appeals(status, created_at desc);

create table if not exists public.lc_account_notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.lc_profiles(id) on delete cascade,
  type text not null check (type in (
    'restriction_started',
    'restriction_changed',
    'restriction_lifted',
    'restriction_expired',
    'appeal_submitted',
    'appeal_needs_info',
    'appeal_approved',
    'appeal_rejected'
  )),
  title text not null,
  content text not null,
  action_url text,
  related_type text,
  related_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint lc_account_notifications_title_check
    check (char_length(trim(title)) between 2 and 120),
  constraint lc_account_notifications_content_check
    check (char_length(trim(content)) between 2 and 1200)
);

create index if not exists lc_account_notifications_profile_idx
  on public.lc_account_notifications(profile_id, created_at desc);

create index if not exists lc_account_notifications_unread_idx
  on public.lc_account_notifications(profile_id, created_at desc)
  where read_at is null;

-- Preserve historical bans as full-account restrictions. Merged source
-- accounts remain tombstones and are intentionally excluded.
insert into public.lc_account_restrictions (
  profile_id,
  scope,
  reason,
  status,
  starts_at,
  profile_was_visible,
  created_at,
  updated_at
)
select
  profile.id,
  'account',
  case
    when char_length(trim(coalesce(profile.ban_reason, ''))) >= 2 then trim(profile.ban_reason)
    else '历史账号限制'
  end,
  'active',
  coalesce(profile.banned_at, profile.updated_at, profile.created_at, now()),
  coalesce(profile.is_visible, false),
  coalesce(profile.banned_at, profile.updated_at, profile.created_at, now()),
  now()
from public.lc_profiles profile
where coalesce(profile.is_banned, false)
  and profile.merged_into is null
  and not exists (
    select 1
    from public.lc_account_restrictions restriction
    where restriction.profile_id = profile.id
      and restriction.status = 'active'
  );

update public.lc_profiles
set restriction_scope = 'account'
where coalesce(is_banned, false)
  and merged_into is null
  and restriction_scope is null;

update public.lc_profiles
set restriction_scope = null,
    restriction_ends_at = null
where merged_into is not null;

alter table public.lc_account_restrictions enable row level security;
alter table public.lc_account_appeals enable row level security;
alter table public.lc_account_notifications enable row level security;

revoke all on table public.lc_account_restrictions from anon, authenticated, service_role;
revoke all on table public.lc_account_appeals from anon, authenticated, service_role;
revoke all on table public.lc_account_notifications from anon, authenticated, service_role;

grant select, insert, update, delete on table public.lc_account_restrictions to service_role;
grant select, insert, update, delete on table public.lc_account_appeals to service_role;
grant select, insert, update, delete on table public.lc_account_notifications to service_role;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'lingqi_app') then
    execute 'revoke all on table public.lc_account_restrictions from lingqi_app';
    execute 'revoke all on table public.lc_account_appeals from lingqi_app';
    execute 'revoke all on table public.lc_account_notifications from lingqi_app';
    execute 'grant select, insert, update, delete on table public.lc_account_restrictions to lingqi_app';
    execute 'grant select, insert, update, delete on table public.lc_account_appeals to lingqi_app';
    execute 'grant select, insert, update, delete on table public.lc_account_notifications to lingqi_app';
  end if;
end
$$;

commit;
