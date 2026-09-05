begin;

-- Production default privileges may grant DELETE/TRUNCATE and cross-app access.
-- Normalize only these new private tables; preserve all unrelated privileges.
revoke all on public.lc_store_certifications,public.lc_store_certification_code_batches,public.lc_store_certification_codes from public;
do $$
declare role_name text;
begin
  foreach role_name in array array['anon','authenticated','jusichen_app','lingqi_app','service_role'] loop
    if exists(select 1 from pg_roles where rolname=role_name) then
      execute format('revoke all on public.lc_store_certifications,public.lc_store_certification_code_batches,public.lc_store_certification_codes from %I',role_name);
    end if;
  end loop;
  foreach role_name in array array['lingqi_app','service_role'] loop
    if exists(select 1 from pg_roles where rolname=role_name) then
      execute format('grant select,insert,update on public.lc_store_certifications,public.lc_store_certification_code_batches,public.lc_store_certification_codes to %I',role_name);
    end if;
  end loop;
end $$;

commit;
