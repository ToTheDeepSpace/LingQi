alter table public.lc_profiles
  drop constraint if exists lc_profiles_role_check;

alter table public.lc_profiles
  add constraint lc_profiles_role_check
  check (role = any (array['player'::text, 'shop'::text, 'admin'::text]));
