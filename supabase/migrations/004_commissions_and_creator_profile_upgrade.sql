-- 灵契委托需求墙 + 灵契师主页升级。

alter table if exists lc_profiles
  add column if not exists available_cities jsonb default '[]'::jsonb,
  add column if not exists travel_status text default '常驻本地',
  add column if not exists contact_unlock_enabled boolean default false,
  add column if not exists contact_intent_amount integer default 0,
  add column if not exists social_snapshots jsonb default '{}'::jsonb;

alter table if exists lc_availability
  add column if not exists city text,
  add column if not exists location text;

alter table if exists lc_contact_requests
  add column if not exists intent_amount integer default 0,
  add column if not exists payment_proof text;

create table if not exists lc_commissions (
  id uuid primary key default gen_random_uuid(),
  poster_id uuid references lc_profiles(id),
  poster_name text not null,
  poster_is_realname boolean default false,
  title text not null,
  content text not null,
  desired_role text,
  target_type text,
  needed_date date,
  city text,
  location text,
  budget text,
  contact_note text,
  ai_assist_context jsonb default '{}'::jsonb,
  status text default 'pending',
  reject_reason text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table lc_commissions enable row level security;

create index if not exists lc_commissions_status_created_idx
  on lc_commissions(status, created_at desc);

create index if not exists lc_commissions_city_date_idx
  on lc_commissions(city, needed_date);

create index if not exists lc_commissions_poster_id_idx
  on lc_commissions(poster_id);
