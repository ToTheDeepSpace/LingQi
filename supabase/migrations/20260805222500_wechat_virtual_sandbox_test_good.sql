begin;

alter table public.lc_service_payment_attempts
  drop constraint if exists lc_service_payment_attempts_product_id_check;

alter table public.lc_service_payment_attempts
  add constraint lc_service_payment_attempts_product_id_check
  check (
    product_id is null
    or product_id in (
      'dossier_claim',
      'provider_listing',
      'provider_contact',
      'jumulu_sandbox_test'
    )
  );

comment on column public.lc_service_payment_attempts.product_id is
  'Wechat virtual goods product id. Formal orders use the service product type; sandbox orders use jumulu_sandbox_test.';

commit;
