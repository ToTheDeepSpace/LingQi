-- 简略委托市场：
-- 1. 委托师维护一张人工前审的公开委托条。
-- 2. 用户私下发起联系申请，委托师同意后双方立即解锁联系方式。
-- 3. 当前不承接平台收款、担保或分账。

begin;

create table if not exists public.lc_provider_listings (
  profile_id uuid primary key references public.lc_profiles(id) on delete cascade,
  poster_url text not null,
  headline text,
  description text,
  height_cm smallint,
  weight_kg smallint,
  role_types text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lc_provider_listings_height_check
    check (height_cm is null or height_cm between 100 and 250),
  constraint lc_provider_listings_weight_check
    check (weight_kg is null or weight_kg between 30 and 300),
  constraint lc_provider_listings_role_types_check
    check (cardinality(role_types) <= 12)
);

create index if not exists lc_provider_listings_active_updated_idx
  on public.lc_provider_listings (is_active, updated_at desc);

create table if not exists public.lc_provider_inquiries (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.lc_profiles(id) on delete cascade,
  requester_id uuid not null references public.lc_profiles(id) on delete cascade,
  requester_name text not null,
  message text not null,
  requester_private_contact text not null,
  provider_private_contact text,
  status text not null default 'submitted',
  decided_at timestamptz,
  contact_unlocked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lc_provider_inquiries_not_self_check
    check (provider_id <> requester_id),
  constraint lc_provider_inquiries_status_check
    check (status in ('submitted', 'accepted', 'rejected'))
);

create unique index if not exists lc_provider_inquiries_one_open_idx
  on public.lc_provider_inquiries (provider_id, requester_id)
  where status = 'submitted';

create index if not exists lc_provider_inquiries_provider_status_idx
  on public.lc_provider_inquiries (provider_id, status, created_at desc);

create index if not exists lc_provider_inquiries_requester_status_idx
  on public.lc_provider_inquiries (requester_id, status, created_at desc);

alter table public.lc_provider_listings enable row level security;
alter table public.lc_provider_inquiries enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on public.lc_provider_listings from anon';
    execute 'revoke all on public.lc_provider_inquiries from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on public.lc_provider_listings from authenticated';
    execute 'revoke all on public.lc_provider_inquiries from authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant select, insert, update, delete on public.lc_provider_listings to service_role';
    execute 'grant select, insert, update, delete on public.lc_provider_inquiries to service_role';
  end if;
end
$$;

comment on table public.lc_provider_listings is
  'Approved public provider cards. Draft changes remain in lc_public_reviews until approved.';
comment on table public.lc_provider_inquiries is
  'Private provider inquiries. Contacts are returned only to both parties after provider acceptance.';

commit;
