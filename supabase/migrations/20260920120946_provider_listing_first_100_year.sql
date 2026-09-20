begin;

-- Additive Tencent PostgreSQL migration: no historical listing or payment is rewritten.
alter table public.lc_provider_listings add column if not exists free_listing_expires_at timestamptz;
create table if not exists public.lc_provider_listing_free_grants (
  profile_id uuid primary key references public.lc_profiles(id),
  identity_keys text[] not null check(cardinality(identity_keys)>0),
  slot integer not null unique check(slot between 1 and 100),
  review_id uuid not null references public.lc_public_reviews(id),
  started_at timestamptz not null,
  expires_at timestamptz not null check(expires_at=started_at+interval '365 days')
);
comment on table public.lc_provider_listing_free_grants is 'First 100 approved providers: one listing per identity, 365 days; immutable grant, no automatic charge, no slot recycling.';
alter table public.lc_provider_listing_free_grants enable row level security;
revoke all on public.lc_provider_listing_free_grants from public;
do $$ begin
  if exists(select 1 from pg_roles where rolname='lingqi_app') then
    -- Production may have broad DEFAULT PRIVILEGES; override them for immutable grants.
    revoke all on public.lc_provider_listing_free_grants from lingqi_app;
    grant select, insert on public.lc_provider_listing_free_grants to lingqi_app;
    if not exists(select 1 from pg_policies where schemaname='public' and tablename='lc_provider_listing_free_grants' and policyname='listing_grants_backend') then
      create policy listing_grants_backend on public.lc_provider_listing_free_grants to lingqi_app using(true) with check(true);
    end if;
  end if;
end $$;
commit;
