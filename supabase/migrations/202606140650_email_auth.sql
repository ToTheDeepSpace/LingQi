-- LingQi email verification login.
-- Additive only: does not delete or rewrite existing business data.

alter table public.lc_profiles
  add column if not exists email text,
  add column if not exists email_verified_at timestamptz;

create unique index if not exists lc_profiles_email_unique
  on public.lc_profiles (lower(email))
  where email is not null;

create index if not exists lc_profiles_email_verified_idx
  on public.lc_profiles (email_verified_at desc)
  where email_verified_at is not null;

alter table public.lc_auth_verification_codes
  add column if not exists email_hash text,
  add column if not exists email_mask text,
  add column if not exists email_domain text;

create index if not exists lc_auth_codes_email_lookup_idx
  on public.lc_auth_verification_codes (project, purpose, email_hash, created_at desc)
  where email_hash is not null;
