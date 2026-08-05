begin;

alter table public.lc_service_purchases
  alter column amount_fen set default 900;

alter table public.lc_service_purchases
  drop constraint if exists lc_service_purchases_amount_check;

alter table public.lc_service_purchases
  add constraint lc_service_purchases_amount_check
  check (amount_fen in (888, 900));

alter table public.lc_service_payment_attempts
  alter column amount_fen set default 900;

alter table public.lc_service_payment_attempts
  drop constraint if exists lc_service_payment_attempts_amount_check;

alter table public.lc_service_payment_attempts
  add constraint lc_service_payment_attempts_amount_check
  check (amount_fen in (1, 888, 900));

comment on table public.lc_service_purchases is
  'One durable platform-service entitlement per verified miniapp account, product and target. New purchases are RMB 9.00; legacy RMB 8.88 records remain immutable.';

comment on column public.lc_service_payment_attempts.amount_fen is
  'Payment amount in fen. Formal purchases use 900, legacy attempts retain 888, and sandbox tests use 1.';

commit;
