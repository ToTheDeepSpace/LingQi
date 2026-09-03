begin;

alter table public.lc_service_purchases drop constraint if exists lc_service_purchases_product_type_check;
alter table public.lc_service_purchases add constraint lc_service_purchases_product_type_check
  check(product_type in ('dossier_claim','provider_listing','provider_contact','store_certification','store_code_pack'));
alter table public.lc_service_purchases drop constraint if exists lc_service_purchases_amount_check;
alter table public.lc_service_purchases add constraint lc_service_purchases_amount_check check(
  (product_type in ('store_certification','store_code_pack') and amount_fen=9000)
  or (product_type in ('dossier_claim','provider_listing','provider_contact') and amount_fen in (888,900)));
alter table public.lc_service_payment_attempts drop constraint if exists lc_service_payment_attempts_amount_check;
alter table public.lc_service_payment_attempts add constraint lc_service_payment_attempts_amount_check check(amount_fen in (1,888,900,9000));
alter table public.lc_service_payment_attempts drop constraint if exists lc_service_payment_attempts_product_id_check;
alter table public.lc_service_payment_attempts add constraint lc_service_payment_attempts_product_id_check check(
  product_id is null or product_id in ('dossier_claim','provider_listing','provider_contact','jumulu_sandbox_test','store_certification','store_code_pack'));

create table if not exists public.lc_store_certifications(
  store_dossier_id uuid primary key references public.lc_dm_dossiers(id),
  id uuid generated always as (store_dossier_id) stored,
  profile_id uuid not null references public.lc_profiles(id),
  status text not null check(status in ('approved','revoked')),
  source text not null check(source in ('payment','legacy_credit')),
  nominal_amount_fen integer not null default 9000 check(nominal_amount_fen=9000),
  purchase_id uuid unique references public.lc_service_purchases(id),
  reviewed_by uuid references public.lc_profiles(id),
  approved_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoke_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(source='legacy_credit' or purchase_id is not null)
);
create index if not exists lc_store_certifications_profile_idx on public.lc_store_certifications(profile_id,status);

create table if not exists public.lc_store_certification_code_batches(
  id uuid primary key default gen_random_uuid(),
  store_dossier_id uuid not null references public.lc_store_certifications(store_dossier_id),
  profile_id uuid not null references public.lc_profiles(id),
  source text not null check(source in ('initial','addon','legacy_initial')),
  status text not null default 'pending' check(status in ('pending','issued','revoked')),
  purchase_id uuid unique references public.lc_service_purchases(id),
  entitlement_key text not null unique,
  revealed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lc_store_code_batches_store_idx on public.lc_store_certification_code_batches(store_dossier_id,created_at desc);
create index if not exists lc_store_code_batches_profile_idx on public.lc_store_certification_code_batches(profile_id);

create table if not exists public.lc_store_certification_codes(
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.lc_store_certification_code_batches(id),
  slot smallint not null check(slot between 1 and 11),
  code_hash text unique check(code_hash is null or code_hash ~ '^[a-f0-9]{64}$'),
  last_four text,
  status text not null default 'unused' check(status in ('unused','reserved','used','revoked')),
  claimant_id uuid references public.lc_profiles(id),
  dm_dossier_id uuid references public.lc_dm_dossiers(id),
  reserved_at timestamptz,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(batch_id,slot),
  check((code_hash is null) = (last_four is null)),
  check(status not in ('reserved','used') or (claimant_id is not null and dm_dossier_id is not null and code_hash is not null)),
  check(status <> 'used' or used_at is not null)
);
create unique index if not exists lc_store_codes_one_reservation_idx
  on public.lc_store_certification_codes(claimant_id,dm_dossier_id) where status='reserved';
create index if not exists lc_store_codes_dossier_idx on public.lc_store_certification_codes(dm_dossier_id);
alter table public.lc_dm_dossier_claims add column if not exists store_code_id uuid references public.lc_store_certification_codes(id);
create index if not exists lc_claims_store_code_idx on public.lc_dm_dossier_claims(store_code_id) where store_code_id is not null;

alter table public.lc_store_certifications enable row level security;
alter table public.lc_store_certification_code_batches enable row level security;
alter table public.lc_store_certification_codes enable row level security;
revoke all on public.lc_store_certifications,public.lc_store_certification_code_batches,public.lc_store_certification_codes from public;
do $$
declare role_name text; table_name text;
begin
  foreach role_name in array array['anon','authenticated'] loop
    if exists(select 1 from pg_roles where rolname=role_name) then
      execute format('revoke all on public.lc_store_certifications,public.lc_store_certification_code_batches,public.lc_store_certification_codes from %I',role_name);
    end if;
  end loop;
  foreach role_name in array array['lingqi_app','service_role'] loop
    if exists(select 1 from pg_roles where rolname=role_name) then
      execute format('grant select,insert,update on public.lc_store_certifications,public.lc_store_certification_code_batches,public.lc_store_certification_codes to %I',role_name);
    end if;
  end loop;
  -- Reuse the existing private transaction audit; no plaintext codes are stored.
  if to_regprocedure('public.lc_record_critical_change()') is not null then
    foreach table_name in array array['lc_store_certifications','lc_store_certification_code_batches','lc_store_certification_codes'] loop
      execute format('drop trigger if exists store_certification_audit on public.%I',table_name);
      execute format('create trigger store_certification_audit after insert or update on public.%I for each row execute function public.lc_record_critical_change()',table_name);
    end loop;
  end if;
end $$;

-- Explicit user-authorized legacy credit. This is NOT a payment or a WeChat order.
-- Guard identity and ownership, never find targets by a mutable display name.
insert into public.lc_store_certifications(store_dossier_id,profile_id,status,source)
select d.id,d.claimed_by,'approved','legacy_credit' from public.lc_dm_dossiers d
where d.id='64946687-714e-40f8-9c00-614f282e7221' and d.claimed_by='19577ab6-28ee-46c5-9b4b-9551d2702bef'
  and d.entity_type='store' and d.status='approved' and d.claim_status='approved'
on conflict(store_dossier_id) do nothing;
update public.lc_profiles p set verified_shop=true,
  identity_roles=array(select distinct unnest(coalesce(p.identity_roles,'{}'::text[]) || array['shop'])),updated_at=now()
where p.id='19577ab6-28ee-46c5-9b4b-9551d2702bef'
  and exists(select 1 from public.lc_store_certifications c where c.store_dossier_id='64946687-714e-40f8-9c00-614f282e7221'
    and c.profile_id=p.id and c.source='legacy_credit' and c.status='approved');
insert into public.lc_store_certification_code_batches(store_dossier_id,profile_id,source,status,entitlement_key)
select c.store_dossier_id,c.profile_id,'legacy_initial','issued','initial:' || c.store_dossier_id::text
from public.lc_store_certifications c where c.store_dossier_id='64946687-714e-40f8-9c00-614f282e7221'
  and c.source='legacy_credit' and c.status='approved'
on conflict(entitlement_key) do nothing;
insert into public.lc_store_certification_codes(batch_id,slot)
select b.id,n from public.lc_store_certification_code_batches b cross join generate_series(1,11) n
where b.store_dossier_id='64946687-714e-40f8-9c00-614f282e7221' and b.source='legacy_initial' and b.status='issued'
on conflict(batch_id,slot) do nothing;

comment on table public.lc_store_certifications is 'Permanent per-store certification. legacy_credit grants never represent actual cash receipts.';
comment on table public.lc_store_certification_codes is 'Eleven nonreturnable single-use slots per batch. Only SHA256 digests; plaintext revealed once or rotated while unused.';
commit;
