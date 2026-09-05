begin;
-- Preferences filter one shared template, not independent WeChat grants per module.
alter table public.lc_wechat_notification_subscriptions add column if not exists scopes text[] not null
  default array['commission','account','service']::text[]
  check(cardinality(scopes) between 1 and 3 and array_position(scopes,null) is null
    and scopes <@ array['commission','account','service']::text[]);
alter table public.lc_wechat_notification_requests add column if not exists scopes text[] not null
  default array['commission','account','service']::text[]
  check(cardinality(scopes) between 1 and 3 and array_position(scopes,null) is null
    and scopes <@ array['commission','account','service']::text[]);

create or replace function public.lc_enqueue_wechat_notification() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  sub public.lc_wechat_notification_subscriptions%rowtype;
  module_scope text;
  skip_reason text;
begin
  select * into sub from public.lc_wechat_notification_subscriptions where profile_id=new.profile_id;
  module_scope := case when new.type ~ '^(commission_|provider_)' then 'commission'
    when new.type ~ '^(restriction_|appeal_)' then 'account'
    when new.type in ('service_payment_succeeded','site_message_resolved') then 'service' else null end;
  skip_reason := case when sub.state is distinct from 'accepted' or sub.authorized_at is null
      or new.created_at<sub.authorized_at then 'no_subscription'
    when module_scope is null or not (module_scope=any(sub.scopes)) then 'module_disabled' else null end;
  insert into public.lc_wechat_notification_deliveries(notification_id,profile_id,template_id,recipient_hash,subscription_version,state,reason)
  values(new.id,new.profile_id,sub.template_id,sub.recipient_hash,sub.version,
    case when skip_reason is null then 'pending' else 'skipped' end,skip_reason)
  on conflict(notification_id) do nothing;
  return new;
end $$;
revoke all on function public.lc_enqueue_wechat_notification() from public;
comment on column public.lc_wechat_notification_subscriptions.scopes is 'Selected business modules share a single one-time template quota; excluded notices remain in-app.';
comment on column public.lc_wechat_notification_requests.scopes is 'Immutable selected scope snapshot used on confirmation; client confirm cannot replace it.';
commit;
