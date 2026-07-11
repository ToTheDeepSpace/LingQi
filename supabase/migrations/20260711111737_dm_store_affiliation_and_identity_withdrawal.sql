-- Separate verified DM identity from store-confirmed employment relationships.

alter table if exists public.lc_dm_dossiers
  drop constraint if exists lc_dm_dossiers_claim_status_check;

alter table if exists public.lc_dm_dossiers
  add constraint lc_dm_dossiers_claim_status_check
  check (claim_status in ('unclaimed', 'pending', 'approved', 'rejected', 'withdrawn'));

create table if not exists public.lc_dm_store_affiliations (
  id uuid primary key default gen_random_uuid(),
  dm_dossier_id uuid not null references public.lc_dm_dossiers(id) on delete cascade,
  store_dossier_id uuid not null references public.lc_dm_dossiers(id) on delete cascade,
  dm_profile_id uuid references public.lc_profiles(id) on delete set null,
  requested_by_profile_id uuid references public.lc_profiles(id) on delete set null,
  requested_by_role text not null default 'dm'
    check (requested_by_role in ('dm', 'store', 'admin', 'legacy')),
  request_kind text not null default 'join'
    check (request_kind in ('join', 'change', 'legacy')),
  request_note text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'ended', 'cancelled', 'legacy_unverified')),
  reviewed_by_profile_id uuid references public.lc_profiles(id) on delete set null,
  reviewed_at timestamptz,
  reject_reason text,
  started_at timestamptz,
  ended_at timestamptz,
  ended_by_profile_id uuid references public.lc_profiles(id) on delete set null,
  end_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists lc_dm_store_affiliations_one_pending_per_dm_idx
  on public.lc_dm_store_affiliations(dm_dossier_id)
  where status = 'pending';

create unique index if not exists lc_dm_store_affiliations_one_approved_per_dm_idx
  on public.lc_dm_store_affiliations(dm_dossier_id)
  where status = 'approved';

create unique index if not exists lc_dm_store_affiliations_legacy_pair_idx
  on public.lc_dm_store_affiliations(dm_dossier_id, store_dossier_id)
  where status = 'legacy_unverified';

create index if not exists lc_dm_store_affiliations_store_queue_idx
  on public.lc_dm_store_affiliations(store_dossier_id, status, created_at desc);

create index if not exists lc_dm_store_affiliations_dm_history_idx
  on public.lc_dm_store_affiliations(dm_dossier_id, created_at desc);

create table if not exists public.lc_dm_identity_withdrawals (
  id uuid primary key default gen_random_uuid(),
  dm_dossier_id uuid not null references public.lc_dm_dossiers(id) on delete cascade,
  profile_id uuid references public.lc_profiles(id) on delete set null,
  reason text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by uuid references public.lc_profiles(id) on delete set null,
  reviewed_at timestamptz,
  reject_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lc_dm_identity_withdrawals_reason_check
    check (char_length(trim(reason)) between 6 and 600)
);

create unique index if not exists lc_dm_identity_withdrawals_one_pending_idx
  on public.lc_dm_identity_withdrawals(dm_dossier_id)
  where status = 'pending';

create index if not exists lc_dm_identity_withdrawals_profile_history_idx
  on public.lc_dm_identity_withdrawals(profile_id, created_at desc)
  where profile_id is not null;

create index if not exists lc_dm_identity_withdrawals_review_queue_idx
  on public.lc_dm_identity_withdrawals(status, created_at desc);

insert into public.lc_dm_store_affiliations (
  dm_dossier_id,
  store_dossier_id,
  dm_profile_id,
  requested_by_profile_id,
  requested_by_role,
  request_kind,
  request_note,
  status,
  created_at,
  updated_at
)
select
  dm.id,
  dm.employer_store_id,
  dm.claimed_by,
  dm.claimed_by,
  'legacy',
  'legacy',
  '历史店家字段迁移，尚未经过店家确认',
  'legacy_unverified',
  coalesce(dm.approved_at, dm.created_at, now()),
  now()
from public.lc_dm_dossiers dm
where dm.entity_type = 'dm'
  and dm.status = 'approved'
  and dm.employer_store_id is not null
  and not exists (
    select 1
    from public.lc_dm_store_affiliations affiliation
    where affiliation.dm_dossier_id = dm.id
      and affiliation.store_dossier_id = dm.employer_store_id
      and affiliation.status = 'legacy_unverified'
  );

alter table public.lc_dm_store_affiliations enable row level security;
alter table public.lc_dm_identity_withdrawals enable row level security;

revoke all on table public.lc_dm_store_affiliations from anon, authenticated, service_role;
revoke all on table public.lc_dm_identity_withdrawals from anon, authenticated, service_role;

grant select, insert, update, delete on table public.lc_dm_store_affiliations to service_role;
grant select, insert, update, delete on table public.lc_dm_identity_withdrawals to service_role;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'lingqi_app') then
    execute 'revoke all on table public.lc_dm_store_affiliations from lingqi_app';
    execute 'revoke all on table public.lc_dm_identity_withdrawals from lingqi_app';
    execute 'grant select, insert, update, delete on table public.lc_dm_store_affiliations to lingqi_app';
    execute 'grant select, insert, update, delete on table public.lc_dm_identity_withdrawals to lingqi_app';
  end if;
end
$$;
