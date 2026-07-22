begin;

alter table public.lc_commissions
  add column if not exists accept_expedition boolean not null default false;

create index if not exists lc_commissions_city_expedition_status_idx
  on public.lc_commissions (city, accept_expedition, status, created_at desc);

comment on column public.lc_commissions.accept_expedition is
  'Whether the poster accepts applicants whose resident city differs but whose available_cities includes the commission city.';

commit;
