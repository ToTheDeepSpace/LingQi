-- 剧幕录每日签到与委托时间段。
--
-- 1. 每日签到按北京时间计算，自带唯一约束和钱包幂等键。
-- 2. 签到奖励只进入 bonus_balance，不影响充值余额。
-- 3. 委托保留原 needed_date 作为开始日期，新增 needed_end_date 作为结束日期。

begin;

alter table public.lc_commissions
  add column if not exists needed_end_date date;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
      where conname = 'lc_commissions_needed_date_range_check'
  ) then
    alter table public.lc_commissions
      add constraint lc_commissions_needed_date_range_check
      check (
        needed_end_date is null
        or (needed_date is not null and needed_end_date >= needed_date)
      );
  end if;
end $$;

create index if not exists lc_commissions_needed_range_idx
  on public.lc_commissions (needed_date, needed_end_date, status);

comment on column public.lc_commissions.needed_date is 'Commission service window start date.';
comment on column public.lc_commissions.needed_end_date is 'Commission service window end date; null means a single-day or unscheduled request.';

create table if not exists public.lc_daily_checkins (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.lc_profiles(id) on delete cascade,
  checkin_date date not null,
  streak integer not null check (streak > 0),
  daily_reward integer not null default 10 check (daily_reward > 0),
  streak_bonus integer not null default 0 check (streak_bonus >= 0),
  reward integer not null check (reward = daily_reward + streak_bonus),
  transaction_id uuid references public.lc_transactions(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (profile_id, checkin_date)
);

create index if not exists lc_daily_checkins_profile_date_idx
  on public.lc_daily_checkins (profile_id, checkin_date desc);

alter table public.lc_daily_checkins enable row level security;

create or replace function public.lc_claim_daily_checkin(
  p_profile_id uuid
)
returns table(
  checkin_id uuid,
  checkin_date date,
  streak integer,
  daily_reward integer,
  streak_bonus integer,
  reward integer,
  balance integer,
  bonus_balance integer,
  applied boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  claim_date date := timezone('Asia/Shanghai', now())::date;
  existing_checkin record;
  profile_row record;
  previous_streak integer := 0;
  next_streak integer := 1;
  base_reward integer := 10;
  consecutive_bonus integer := 0;
  total_reward integer := 10;
  inserted_checkin_id uuid;
  wallet_result record;
begin
  perform pg_advisory_xact_lock(hashtext(p_profile_id::text || ':' || claim_date::text));

  select p.balance, p.bonus_balance
    into profile_row
    from public.lc_profiles p
    where p.id = p_profile_id
    for update;

  if not found then
    raise exception '用户不存在';
  end if;

  select c.id, c.checkin_date, c.streak, c.daily_reward, c.streak_bonus, c.reward
    into existing_checkin
    from public.lc_daily_checkins c
    where c.profile_id = p_profile_id
      and c.checkin_date = claim_date;

  if found then
    return query select
      existing_checkin.id,
      existing_checkin.checkin_date,
      existing_checkin.streak,
      existing_checkin.daily_reward,
      existing_checkin.streak_bonus,
      existing_checkin.reward,
      coalesce(profile_row.balance, 0),
      coalesce(profile_row.bonus_balance, 0),
      false;
    return;
  end if;

  select c.streak
    into previous_streak
    from public.lc_daily_checkins c
    where c.profile_id = p_profile_id
      and c.checkin_date = claim_date - 1;

  next_streak := case when found then coalesce(previous_streak, 0) + 1 else 1 end;
  consecutive_bonus := case when next_streak % 7 = 0 then 5 else 0 end;
  total_reward := base_reward + consecutive_bonus;

  insert into public.lc_daily_checkins(
    profile_id,
    checkin_date,
    streak,
    daily_reward,
    streak_bonus,
    reward
  ) values (
    p_profile_id,
    claim_date,
    next_streak,
    base_reward,
    consecutive_bonus,
    total_reward
  )
  returning id into inserted_checkin_id;

  select *
    into wallet_result
    from public.lc_apply_wallet_credit(
      p_profile_id,
      total_reward,
      case
        when consecutive_bonus > 0 then '每日签到（含连续签到奖励）'
        else '每日签到'
      end,
      'daily_checkin',
      inserted_checkin_id,
      'daily-checkin:' || claim_date::text,
      jsonb_build_object(
        'checkin_date', claim_date,
        'streak', next_streak,
        'daily_reward', base_reward,
        'streak_bonus', consecutive_bonus
      )
    );

  update public.lc_daily_checkins
    set transaction_id = wallet_result.transaction_id
    where id = inserted_checkin_id;

  select p.balance, p.bonus_balance
    into profile_row
    from public.lc_profiles p
    where p.id = p_profile_id;

  return query select
    inserted_checkin_id,
    claim_date,
    next_streak,
    base_reward,
    consecutive_bonus,
    total_reward,
    coalesce(profile_row.balance, 0),
    coalesce(profile_row.bonus_balance, 0),
    coalesce(wallet_result.applied, true);
end;
$$;

grant execute on function public.lc_claim_daily_checkin(uuid) to service_role;

commit;
