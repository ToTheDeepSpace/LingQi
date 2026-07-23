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

-- The current Tencent PostgreSQL production schema still has the legacy
-- single-balance wallet. Add the split columns needed for bonus-only check-in
-- rewards while preserving every profile's existing total balance.
alter table public.lc_profiles
  add column if not exists paid_balance integer not null default 0,
  add column if not exists bonus_balance integer not null default 0;

alter table public.lc_transactions
  add column if not exists paid_amount integer not null default 0,
  add column if not exists bonus_amount integer not null default 0,
  add column if not exists balance_before integer,
  add column if not exists balance_after integer,
  add column if not exists paid_balance_before integer,
  add column if not exists paid_balance_after integer,
  add column if not exists bonus_balance_before integer,
  add column if not exists bonus_balance_after integer;

do $$
declare
  split_rows integer;
  tx record;
  paid_before integer;
  bonus_before integer;
  paid_delta integer;
  bonus_delta integer;
  paid_after integer;
  bonus_after integer;
  spend_amount integer;
begin
  select count(*)
    into split_rows
    from public.lc_transactions
    where paid_balance_after is not null
       or bonus_balance_after is not null
       or paid_amount <> 0
       or bonus_amount <> 0;

  if split_rows = 0 then
    update public.lc_profiles
      set paid_balance = 0,
          bonus_balance = 0;

    for tx in
      select *
        from public.lc_transactions
        where status = 'approved'
        order by created_at asc, id asc
    loop
      select coalesce(paid_balance, 0), coalesce(bonus_balance, 0)
        into paid_before, bonus_before
        from public.lc_profiles
        where id = tx.profile_id
        for update;

      paid_before := coalesce(paid_before, 0);
      bonus_before := coalesce(bonus_before, 0);

      if tx.amount >= 0 then
        if coalesce(tx.ref_type, '') in (
          'referral_invitee_bonus',
          'referral_stage1_bonus',
          'referral_stage2_bonus',
          'script_contribution_reward',
          'daily_checkin'
        ) or coalesce(tx.description, '') ilike any (array[
          '%赠送%',
          '%奖励%',
          '%邀请%',
          '%注册赠%',
          '%每日签到%'
        ]) then
          paid_delta := 0;
          bonus_delta := tx.amount;
        else
          paid_delta := tx.amount;
          bonus_delta := 0;
        end if;
      else
        spend_amount := abs(tx.amount);
        bonus_delta := -least(bonus_before, spend_amount);
        paid_delta := -(spend_amount - abs(bonus_delta));
      end if;

      paid_after := paid_before + paid_delta;
      bonus_after := bonus_before + bonus_delta;

      update public.lc_profiles
        set paid_balance = paid_after,
            bonus_balance = bonus_after
        where id = tx.profile_id;

      update public.lc_transactions
        set paid_amount = paid_delta,
            bonus_amount = bonus_delta,
            balance_before = coalesce(balance_before, paid_before + bonus_before),
            balance_after = coalesce(balance_after, paid_after + bonus_after),
            paid_balance_before = paid_before,
            paid_balance_after = paid_after,
            bonus_balance_before = bonus_before,
            bonus_balance_after = bonus_after,
            updated_at = now()
        where id = tx.id;
    end loop;

    -- Preserve legacy balances that do not have a complete transaction trail.
    update public.lc_profiles
      set paid_balance = paid_balance + (balance - paid_balance - bonus_balance)
      where balance <> paid_balance + bonus_balance;

    if exists (
      select 1
      from public.lc_profiles
      where paid_balance < 0
         or bonus_balance < 0
         or balance <> paid_balance + bonus_balance
    ) then
      raise exception '钱包拆分校验失败，迁移已回滚';
    end if;
  end if;
end $$;

create or replace function public.lc_apply_wallet_credit(
  p_profile_id uuid,
  p_amount integer,
  p_description text,
  p_ref_type text,
  p_ref_id uuid,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb
)
returns table(
  transaction_id uuid,
  balance integer,
  applied boolean
)
language plpgsql
set search_path = public
as $$
declare
  profile_row record;
  existing_tx record;
  next_paid integer;
  next_bonus integer;
  next_balance integer;
  inserted_tx_id uuid;
begin
  if p_amount <= 0 then
    raise exception '奖励金额必须大于 0';
  end if;

  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    raise exception '缺少幂等键';
  end if;

  select p.id,
         coalesce(p.balance, 0) as balance,
         coalesce(p.paid_balance, 0) as paid_balance,
         coalesce(p.bonus_balance, 0) as bonus_balance
    into profile_row
    from public.lc_profiles p
    where p.id = p_profile_id
    for update;

  if not found then
    raise exception '用户不存在';
  end if;

  select t.id
    into existing_tx
    from public.lc_transactions t
    where t.profile_id = p_profile_id
      and t.idempotency_key = p_idempotency_key
    limit 1;

  if found then
    return query select existing_tx.id, profile_row.balance, false;
    return;
  end if;

  next_paid := profile_row.paid_balance;
  next_bonus := profile_row.bonus_balance + p_amount;
  next_balance := next_paid + next_bonus;

  update public.lc_profiles p
    set paid_balance = next_paid,
        bonus_balance = next_bonus,
        balance = next_balance,
        updated_at = now()
    where p.id = p_profile_id;

  insert into public.lc_transactions(
    profile_id,
    type,
    amount,
    paid_amount,
    bonus_amount,
    description,
    status,
    ref_type,
    ref_id,
    idempotency_key,
    metadata,
    balance_before,
    balance_after,
    paid_balance_before,
    paid_balance_after,
    bonus_balance_before,
    bonus_balance_after,
    created_at,
    updated_at
  ) values (
    p_profile_id,
    'recharge',
    p_amount,
    0,
    p_amount,
    p_description,
    'approved',
    p_ref_type,
    p_ref_id,
    p_idempotency_key,
    coalesce(p_metadata, '{}'::jsonb),
    profile_row.balance,
    next_balance,
    profile_row.paid_balance,
    next_paid,
    profile_row.bonus_balance,
    next_bonus,
    now(),
    now()
  )
  returning id into inserted_tx_id;

  return query select inserted_tx_id, next_balance, true;
end;
$$;

grant execute on function public.lc_apply_wallet_credit(uuid, integer, text, text, uuid, text, jsonb) to service_role;

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
