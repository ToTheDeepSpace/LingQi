begin;

create table if not exists public.lc_service_purchases (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.lc_profiles(id) on delete cascade,
  product_type text not null,
  target_id uuid not null,
  amount_fen integer not null default 888,
  currency text not null default 'CNY',
  status text not null default 'unpaid',
  paid_attempt_id uuid,
  paid_at timestamptz,
  refunded_at timestamptz,
  refund_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lc_service_purchases_product_type_check
    check (product_type in ('dossier_claim', 'provider_listing', 'provider_contact')),
  constraint lc_service_purchases_amount_check
    check (amount_fen = 888),
  constraint lc_service_purchases_currency_check
    check (currency = 'CNY'),
  constraint lc_service_purchases_status_check
    check (status in ('unpaid', 'paid', 'refunded'))
);

create unique index if not exists lc_service_purchases_entitlement_idx
  on public.lc_service_purchases (profile_id, product_type, target_id);

create index if not exists lc_service_purchases_profile_created_idx
  on public.lc_service_purchases (profile_id, created_at desc);

create table if not exists public.lc_service_payment_attempts (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.lc_service_purchases(id) on delete cascade,
  out_trade_no text not null unique,
  prepay_id text,
  wechat_transaction_id text,
  amount_fen integer not null default 888,
  status text not null default 'created',
  notify_payload jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lc_service_payment_attempts_amount_check
    check (amount_fen = 888),
  constraint lc_service_payment_attempts_status_check
    check (status in ('created', 'paid', 'failed', 'expired', 'duplicate_paid', 'refunded'))
);

create unique index if not exists lc_service_payment_attempts_wechat_transaction_idx
  on public.lc_service_payment_attempts (wechat_transaction_id)
  where wechat_transaction_id is not null;

create unique index if not exists lc_service_payment_attempts_one_active_idx
  on public.lc_service_payment_attempts (purchase_id)
  where status = 'created';

alter table public.lc_service_purchases
  drop constraint if exists lc_service_purchases_paid_attempt_fk;

alter table public.lc_service_purchases
  add constraint lc_service_purchases_paid_attempt_fk
  foreign key (paid_attempt_id)
  references public.lc_service_payment_attempts(id)
  on delete set null;

create table if not exists public.lc_provider_contacts (
  profile_id uuid primary key references public.lc_profiles(id) on delete cascade,
  business_contact text not null,
  is_available boolean not null default true,
  reviewed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lc_provider_contacts_value_check
    check (char_length(trim(business_contact)) between 2 and 300)
);

alter table public.lc_provider_listings
  add column if not exists initial_purchase_id uuid
    references public.lc_service_purchases(id) on delete set null;

alter table public.lc_dm_dossier_claims
  add column if not exists payment_purchase_id uuid
    references public.lc_service_purchases(id) on delete set null;

alter table public.lc_site_messages
  add column if not exists evidence_urls jsonb not null default '[]'::jsonb,
  add column if not exists evidence_files jsonb not null default '[]'::jsonb,
  add column if not exists payment_purchase_id uuid
    references public.lc_service_purchases(id) on delete set null,
  add column if not exists admin_reply text,
  add column if not exists replied_at timestamptz;

alter table public.lc_site_messages
  drop constraint if exists lc_site_messages_evidence_urls_check;

alter table public.lc_site_messages
  add constraint lc_site_messages_evidence_urls_check
  check (
    jsonb_typeof(evidence_urls) = 'array'
    and jsonb_array_length(evidence_urls) <= 3
  );

alter table public.lc_site_messages
  drop constraint if exists lc_site_messages_evidence_files_check;

alter table public.lc_site_messages
  add constraint lc_site_messages_evidence_files_check
  check (
    jsonb_typeof(evidence_files) = 'array'
    and jsonb_array_length(evidence_files) <= 3
  );

alter table public.lc_reports
  add column if not exists target_sub_id text not null default '';

alter table public.lc_reports
  drop constraint if exists lc_reports_target_type_check;

alter table public.lc_reports
  add constraint lc_reports_target_type_check
  check (target_type in (
    'carpool',
    'ranking',
    'comment',
    'commission',
    'profile',
    'dm_affiliation',
    'dossier',
    'dossier_image',
    'dm_rating',
    'store_rating',
    'role_rating',
    'rating_reply',
    'provider_listing',
    'guide',
    'service',
    'portfolio',
    'portfolio_image'
  ));

alter table public.lc_reports
  drop constraint if exists lc_reports_target_type_target_id_reporter_id_key;

create unique index if not exists lc_reports_target_reporter_sub_idx
  on public.lc_reports (target_type, target_id, target_sub_id, reporter_id);

alter table public.lc_service_purchases enable row level security;
alter table public.lc_service_payment_attempts enable row level security;
alter table public.lc_provider_contacts enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on public.lc_service_purchases from anon';
    execute 'revoke all on public.lc_service_payment_attempts from anon';
    execute 'revoke all on public.lc_provider_contacts from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on public.lc_service_purchases from authenticated';
    execute 'revoke all on public.lc_service_payment_attempts from authenticated';
    execute 'revoke all on public.lc_provider_contacts from authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant select, insert, update, delete on public.lc_service_purchases to service_role';
    execute 'grant select, insert, update, delete on public.lc_service_payment_attempts to service_role';
    execute 'grant select, insert, update, delete on public.lc_provider_contacts to service_role';
  end if;
  if exists (select 1 from pg_roles where rolname = 'lingqi_app') then
    execute 'grant select, insert, update, delete on public.lc_service_purchases to lingqi_app';
    execute 'grant select, insert, update, delete on public.lc_service_payment_attempts to lingqi_app';
    execute 'grant select, insert, update, delete on public.lc_provider_contacts to lingqi_app';
  end if;
end
$$;

insert into public.lc_service_purchases
  (profile_id, product_type, target_id, amount_fen, status, paid_at, created_at, updated_at)
select listing.profile_id,
       'provider_listing',
       listing.profile_id,
       888,
       'paid',
       coalesce(listing.created_at, now()),
       coalesce(listing.created_at, now()),
       now()
from public.lc_provider_listings listing
on conflict (profile_id, product_type, target_id) do nothing;

create or replace function public.lc_enforce_verified_service_purchase_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
      from public.lc_profiles profile
     where profile.id = new.profile_id
       and profile.phone_verified_at is not null
       and profile.wechat_mini_openid is not null
       and profile.merged_into is null
  ) then
    raise exception 'SERVICE_PURCHASE_REQUIRES_VERIFIED_MINIAPP_PROFILE';
  end if;
  return new;
end;
$$;

drop trigger if exists lc_service_purchases_verified_profile_guard on public.lc_service_purchases;
create trigger lc_service_purchases_verified_profile_guard
before insert or update of profile_id on public.lc_service_purchases
for each row execute function public.lc_enforce_verified_service_purchase_profile();

revoke all on function public.lc_enforce_verified_service_purchase_profile() from public;

comment on table public.lc_service_purchases is
  'One durable platform-service entitlement per verified miniapp account, product and target. Amount is fixed at RMB 8.88.';
comment on table public.lc_service_payment_attempts is
  'WeChat payment attempts for a durable platform-service purchase.';
comment on table public.lc_provider_contacts is
  'Reviewed provider business contact. Login phone, email and WeChat OpenID must never be copied here automatically.';
comment on column public.lc_site_messages.evidence_files is
  'Private feedback evidence metadata. Files are served only through authenticated moderation endpoints.';

commit;
