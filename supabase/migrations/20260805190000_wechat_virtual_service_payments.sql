begin;

alter table public.lc_service_payment_attempts
  add column if not exists payment_provider text not null default 'wechat_pay',
  add column if not exists product_id text,
  add column if not exists wx_order_id text,
  add column if not exists xpay_env smallint,
  add column if not exists delivery_notified_at timestamptz;

alter table public.lc_service_payment_attempts
  drop constraint if exists lc_service_payment_attempts_payment_provider_check;

alter table public.lc_service_payment_attempts
  add constraint lc_service_payment_attempts_payment_provider_check
  check (payment_provider in ('wechat_pay', 'wechat_virtual_pay'));

alter table public.lc_service_payment_attempts
  drop constraint if exists lc_service_payment_attempts_product_id_check;

alter table public.lc_service_payment_attempts
  add constraint lc_service_payment_attempts_product_id_check
  check (
    product_id is null
    or product_id in ('dossier_claim', 'provider_listing', 'provider_contact')
  );

alter table public.lc_service_payment_attempts
  drop constraint if exists lc_service_payment_attempts_xpay_env_check;

alter table public.lc_service_payment_attempts
  add constraint lc_service_payment_attempts_xpay_env_check
  check (xpay_env is null or xpay_env in (0, 1));

create unique index if not exists lc_service_payment_attempts_wx_order_idx
  on public.lc_service_payment_attempts (wx_order_id)
  where wx_order_id is not null;

comment on column public.lc_service_payment_attempts.payment_provider is
  'Payment rail used by this attempt. Historical JSAPI orders remain wechat_pay; new miniapp virtual goods use wechat_virtual_pay.';
comment on column public.lc_service_payment_attempts.product_id is
  'Wechat virtual goods product id, equal to the durable platform service product type.';
comment on column public.lc_service_payment_attempts.wx_order_id is
  'Wechat virtual payment platform order id used for delivery notification and reconciliation.';
comment on column public.lc_service_payment_attempts.xpay_env is
  'Wechat virtual payment environment: 0 production, 1 sandbox.';
comment on column public.lc_service_payment_attempts.delivery_notified_at is
  'Time Wechat accepted the platform delivery acknowledgement, including successful callback responses.';

commit;
