begin;
create table if not exists public.lc_wechat_notification_subscriptions (
  profile_id uuid primary key references public.lc_profiles(id),
  template_id text not null,
  recipient_hash text not null check(recipient_hash ~ '^[a-f0-9]{64}$'),
  state text not null check(state in ('accepted','rejected','off','exhausted')),
  version bigint not null default 1,
  authorized_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists lc_wechat_notification_recipient_idx on public.lc_wechat_notification_subscriptions(recipient_hash,template_id);
create table if not exists public.lc_wechat_notification_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.lc_profiles(id),
  template_id text not null,
  recipient_hash text not null check(recipient_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '10 minutes',
  consumed_at timestamptz,
  result text check(result in ('accept','reject','ban'))
);
create index if not exists lc_wechat_notification_requests_profile_idx on public.lc_wechat_notification_requests(profile_id,created_at desc);
create table if not exists public.lc_wechat_notification_deliveries (
  notification_id uuid primary key references public.lc_account_notifications(id),
  profile_id uuid not null references public.lc_profiles(id),
  template_id text,
  recipient_hash text,
  subscription_version bigint,
  state text not null check(state in ('pending','processing','api_accepted','failed','unknown','skipped')),
  reason text,
  error_code integer,
  attempts integer not null default 0 check(attempts between 0 and 3),
  available_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists lc_wechat_notification_queue_idx on public.lc_wechat_notification_deliveries(available_at,created_at) where state='pending';
create index if not exists lc_wechat_notification_delivery_profile_idx on public.lc_wechat_notification_deliveries(profile_id,created_at desc);
alter table public.lc_wechat_notification_subscriptions enable row level security;
alter table public.lc_wechat_notification_requests enable row level security;
alter table public.lc_wechat_notification_deliveries enable row level security;
revoke all on public.lc_wechat_notification_subscriptions,public.lc_wechat_notification_requests,public.lc_wechat_notification_deliveries from public;
do $$
declare role_name text;
begin
  foreach role_name in array array['anon','authenticated','jusichen_app','lingqi_app','service_role'] loop
    if exists(select 1 from pg_roles where rolname=role_name) then
      execute format('revoke all on public.lc_wechat_notification_subscriptions,public.lc_wechat_notification_requests,public.lc_wechat_notification_deliveries from %I',role_name);
    end if;
  end loop;
  foreach role_name in array array['lingqi_app','service_role'] loop
    if exists(select 1 from pg_roles where rolname=role_name) then
      execute format('grant select,insert,update on public.lc_wechat_notification_subscriptions,public.lc_wechat_notification_requests,public.lc_wechat_notification_deliveries to %I',role_name);
    end if;
  end loop;
end $$;

create or replace function public.lc_enqueue_wechat_notification() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare sub public.lc_wechat_notification_subscriptions%rowtype;
begin
  select * into sub from public.lc_wechat_notification_subscriptions where profile_id=new.profile_id;
  insert into public.lc_wechat_notification_deliveries(notification_id,profile_id,template_id,recipient_hash,subscription_version,state,reason)
  values(new.id,new.profile_id,sub.template_id,sub.recipient_hash,sub.version,
    case when sub.state='accepted' and new.created_at>=sub.authorized_at then 'pending' else 'skipped' end,
    case when sub.state='accepted' and new.created_at>=sub.authorized_at then null else 'no_subscription' end)
  on conflict(notification_id) do nothing;
  return new;
end $$;
revoke all on function public.lc_enqueue_wechat_notification() from public;
drop trigger if exists enqueue_wechat_notification on public.lc_account_notifications;
create trigger enqueue_wechat_notification after insert on public.lc_account_notifications
for each row execute function public.lc_enqueue_wechat_notification();
comment on table public.lc_wechat_notification_subscriptions is 'Client subscription result is a hint, not proof of unlimited permission or remaining quota. WeChat validates every send.';
comment on table public.lc_wechat_notification_deliveries is 'No backfill. API accepted is not proof of device display. Ambiguous sends are not automatically retried.';
commit;
