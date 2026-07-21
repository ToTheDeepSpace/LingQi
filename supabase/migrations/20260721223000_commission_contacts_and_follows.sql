-- 委托联系闭环、关注城市与关注店家。

begin;

alter table if exists lc_commissions
  add column if not exists private_contact text;

alter table if exists lc_commission_applications
  add column if not exists private_contact text,
  add column if not exists decided_at timestamptz,
  add column if not exists decided_by uuid references lc_profiles(id),
  add column if not exists contact_unlocked_at timestamptz;

create index if not exists lc_commission_applications_status_created_idx
  on lc_commission_applications(status, created_at desc);

create table if not exists lc_profile_city_follows (
  profile_id uuid not null references lc_profiles(id) on delete cascade,
  city text not null,
  created_at timestamptz not null default now(),
  primary key (profile_id, city)
);

create index if not exists lc_profile_city_follows_city_idx
  on lc_profile_city_follows(city, created_at desc);

alter table lc_profile_city_follows enable row level security;

create table if not exists lc_store_follows (
  profile_id uuid not null references lc_profiles(id) on delete cascade,
  store_dossier_id uuid not null references lc_dm_dossiers(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, store_dossier_id)
);

create index if not exists lc_store_follows_store_idx
  on lc_store_follows(store_dossier_id, created_at desc);

alter table lc_store_follows enable row level security;

commit;
