-- Creator cash income must only come from paid wallet balance.
-- Bonus balance can support non-cash platform actions but must never be
-- converted into a creator's withdrawable income through guide purchases.

begin;

create or replace function public.lc_spend_paid_wallet_balance(
  p_profile_id uuid,
  p_amount integer,
  p_description text,
  p_ref_type text default null,
  p_ref_id uuid default null,
  p_idempotency_key text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table(
  transaction_id uuid,
  balance integer,
  paid_balance integer,
  bonus_balance integer,
  paid_spent integer,
  bonus_spent integer,
  applied boolean
)
language plpgsql
set search_path = public
as $$
declare
  profile_row record;
  existing_tx record;
  next_paid integer;
  next_balance integer;
  inserted_tx_id uuid;
begin
  if p_amount <= 0 then
    raise exception '消费金额必须大于 0';
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

  if p_idempotency_key is not null and length(trim(p_idempotency_key)) > 0 then
    select t.id
      into existing_tx
      from public.lc_transactions t
      where t.profile_id = p_profile_id
        and t.idempotency_key = p_idempotency_key
      limit 1;

    if found then
      return query select
        existing_tx.id,
        profile_row.balance,
        profile_row.paid_balance,
        profile_row.bonus_balance,
        0,
        0,
        false;
      return;
    end if;
  end if;

  if profile_row.paid_balance < p_amount then
    raise exception '充值榜金不足，付费攻略不能使用赠送榜金';
  end if;

  next_paid := profile_row.paid_balance - p_amount;
  next_balance := next_paid + profile_row.bonus_balance;

  update public.lc_profiles p
    set paid_balance = next_paid,
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
    'spend',
    -p_amount,
    -p_amount,
    0,
    p_description,
    'approved',
    p_ref_type,
    p_ref_id,
    nullif(trim(coalesce(p_idempotency_key, '')), ''),
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('funding_source', 'paid_only'),
    profile_row.balance,
    next_balance,
    profile_row.paid_balance,
    next_paid,
    profile_row.bonus_balance,
    profile_row.bonus_balance,
    now(),
    now()
  )
  returning id into inserted_tx_id;

  return query select
    inserted_tx_id,
    next_balance,
    next_paid,
    profile_row.bonus_balance,
    p_amount,
    0,
    true;
end;
$$;

create or replace function public.lc_purchase_guide(
  p_buyer_id uuid,
  p_guide_id uuid
)
returns table(
  purchase_id uuid,
  guide_id uuid,
  transaction_id uuid,
  balance integer,
  creator_income_id uuid,
  already_purchased boolean
)
language plpgsql
set search_path = public
as $$
declare
  guide_row record;
  existing_purchase record;
  wallet_result record;
  inserted_purchase_id uuid;
  inserted_income_id uuid;
  fee_amount integer;
  creator_income_amount integer;
begin
  perform pg_advisory_xact_lock(hashtext('lc_purchase_guide:' || p_guide_id::text || ':' || p_buyer_id::text));

  select *
    into guide_row
    from public.lc_guides g
    where g.id = p_guide_id
    for update;

  if not found then
    raise exception '攻略不存在';
  end if;

  if guide_row.status <> 'approved' or guide_row.sale_status <> 'on_sale' then
    raise exception '攻略尚未上架';
  end if;

  if guide_row.author_id = p_buyer_id then
    raise exception '不能购买自己的攻略';
  end if;

  select *
    into existing_purchase
    from public.lc_guide_purchases p
    where p.guide_id = p_guide_id
      and p.buyer_id = p_buyer_id
      and p.status = 'approved'
    limit 1;

  if found then
    select coalesce(lp.balance, 0)
      into balance
      from public.lc_profiles lp
      where lp.id = p_buyer_id;

    purchase_id := existing_purchase.id;
    guide_id := p_guide_id;
    transaction_id := existing_purchase.transaction_id;
    creator_income_id := null;
    already_purchased := true;
    return next;
    return;
  end if;

  if coalesce(guide_row.price, 0) <= 0 then
    transaction_id := null;
    select coalesce(lp.balance, 0)
      into balance
      from public.lc_profiles lp
      where lp.id = p_buyer_id
      for update;
  else
    select *
      into wallet_result
      from public.lc_spend_paid_wallet_balance(
        p_buyer_id,
        guide_row.price,
        '购买攻略 · ' || left(guide_row.title, 60),
        'guide_purchase',
        p_guide_id,
        'guide_purchase:' || p_guide_id::text || ':' || p_buyer_id::text,
        jsonb_build_object('guide_title', guide_row.title, 'seller_id', guide_row.author_id)
      );
    transaction_id := wallet_result.transaction_id;
    balance := wallet_result.balance;
  end if;

  insert into public.lc_guide_purchases(
    guide_id,
    buyer_id,
    seller_id,
    amount,
    transaction_id,
    status,
    created_at,
    updated_at
  ) values (
    p_guide_id,
    p_buyer_id,
    guide_row.author_id,
    coalesce(guide_row.price, 0),
    transaction_id,
    'approved',
    now(),
    now()
  )
  returning id into inserted_purchase_id;

  fee_amount := floor(coalesce(guide_row.price, 0) * 0.2)::integer;
  creator_income_amount := coalesce(guide_row.price, 0) - fee_amount;

  if creator_income_amount > 0 then
    insert into public.lc_creator_income_entries(
      creator_id,
      payer_id,
      guide_id,
      source_type,
      source_id,
      gross_amount,
      platform_fee,
      creator_amount,
      status,
      available_at,
      metadata,
      created_at,
      updated_at
    ) values (
      guide_row.author_id,
      p_buyer_id,
      p_guide_id,
      'guide_purchase',
      inserted_purchase_id,
      coalesce(guide_row.price, 0),
      fee_amount,
      creator_income_amount,
      'frozen',
      now() + interval '7 days',
      jsonb_build_object(
        'purchase_id', inserted_purchase_id,
        'guide_title', guide_row.title,
        'funding_source', 'paid_only'
      ),
      now(),
      now()
    )
    returning id into inserted_income_id;
  end if;

  update public.lc_guides
    set purchase_count = purchase_count + 1,
        updated_at = now()
    where id = p_guide_id;

  purchase_id := inserted_purchase_id;
  guide_id := p_guide_id;
  creator_income_id := inserted_income_id;
  already_purchased := false;
  return next;
end;
$$;

grant execute on function public.lc_spend_paid_wallet_balance(uuid, integer, text, text, uuid, text, jsonb) to service_role;
grant execute on function public.lc_purchase_guide(uuid, uuid) to service_role;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'lingqi_app') then
    execute 'grant execute on function public.lc_spend_paid_wallet_balance(uuid, integer, text, text, uuid, text, jsonb) to lingqi_app';
    execute 'grant execute on function public.lc_purchase_guide(uuid, uuid) to lingqi_app';
  end if;
end
$$;

commit;
