update public.lc_profiles as profile
set verified_dm = true,
    identity_roles = case
      when 'dm' = any(profile.identity_roles) then profile.identity_roles
      else array_append(profile.identity_roles, 'dm')
    end,
    updated_at = now()
where exists (
  select 1
  from public.lc_dm_dossier_claims as claim
  where claim.claimant_id = profile.id
    and claim.entity_type = 'dm'
    and claim.status = 'approved'
)
and (
  not profile.verified_dm
  or not ('dm' = any(profile.identity_roles))
);
