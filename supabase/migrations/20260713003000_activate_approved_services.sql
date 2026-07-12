begin;

alter table public.lc_services
  alter column is_active set default true;

update public.lc_services as service
set is_active = true
where service.is_active is null
  and exists (
    select 1
    from public.lc_public_reviews as review
    where review.target_type = 'service_create'
      and review.status = 'approved'
      and review.profile_id = service.creator_id
  );

commit;
