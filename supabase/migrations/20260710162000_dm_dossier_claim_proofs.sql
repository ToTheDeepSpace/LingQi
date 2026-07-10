create table if not exists public.lc_dm_dossier_claims (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.lc_dm_dossiers(id) on delete cascade,
  claimant_id uuid references public.lc_profiles(id) on delete set null,
  entity_type text not null default 'dm',
  proof_type text not null,
  claim_note text not null,
  proof_files jsonb not null default '[]'::jsonb,
  status text not null default 'pending',
  reviewed_by uuid references public.lc_profiles(id) on delete set null,
  reviewed_at timestamptz,
  reject_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lc_dm_dossier_claims_entity_type_check
    check (entity_type in ('dm', 'store')),
  constraint lc_dm_dossier_claims_proof_type_check
    check (proof_type in ('social_account', 'employment', 'business_license', 'store_backend', 'other')),
  constraint lc_dm_dossier_claims_status_check
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  constraint lc_dm_dossier_claims_note_check
    check (char_length(trim(claim_note)) between 6 and 600),
  constraint lc_dm_dossier_claims_proof_files_check
    check (jsonb_typeof(proof_files) = 'array' and jsonb_array_length(proof_files) between 1 and 3)
);

create unique index if not exists lc_dm_dossier_claims_one_pending_idx
  on public.lc_dm_dossier_claims(dossier_id)
  where status = 'pending';

create index if not exists lc_dm_dossier_claims_claimant_idx
  on public.lc_dm_dossier_claims(claimant_id, created_at desc)
  where claimant_id is not null;

create index if not exists lc_dm_dossier_claims_review_queue_idx
  on public.lc_dm_dossier_claims(status, created_at desc);

alter table public.lc_dm_dossier_claims enable row level security;

revoke all on table public.lc_dm_dossier_claims from anon, authenticated, service_role;
grant select, insert, update, delete on table public.lc_dm_dossier_claims to service_role;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'lingqi_app') then
    execute 'grant select, insert, update, delete on table public.lc_dm_dossier_claims to lingqi_app';
  end if;
end
$$;
