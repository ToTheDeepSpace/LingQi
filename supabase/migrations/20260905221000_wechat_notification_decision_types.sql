begin;
-- Existing decision routes emit these types. Widen, never narrow, an existing allowlist.
-- Preserve any extra production types and all existing notification rows.
do $$
declare existing_check text;
begin
  select pg_get_expr(conbin,conrelid) into existing_check from pg_constraint
    where conrelid='public.lc_account_notifications'::regclass
      and conname='lc_account_notifications_type_check' and contype='c';
  -- No constraint means these values are already allowed; do not impose a new restriction.
  if existing_check is null then return; end if;
  if position(quote_literal('provider_inquiry_accepted') in existing_check)>0
    and position(quote_literal('provider_inquiry_rejected') in existing_check)>0
    and position(quote_literal('commission_application_accepted') in existing_check)>0
    and position(quote_literal('commission_application_rejected') in existing_check)>0 then return; end if;
  alter table public.lc_account_notifications drop constraint lc_account_notifications_type_check;
  execute format('alter table public.lc_account_notifications add constraint lc_account_notifications_type_check
    check ((%s) or type in (%L,%L,%L,%L))',existing_check,
    'provider_inquiry_accepted','provider_inquiry_rejected','commission_application_accepted','commission_application_rejected');
  comment on constraint lc_account_notifications_type_check on public.lc_account_notifications is
    'Preserves the existing notification allowlist and adds commission/provider decision outcomes.';
end $$;
commit;
