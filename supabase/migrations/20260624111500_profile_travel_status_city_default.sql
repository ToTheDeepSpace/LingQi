alter table public.lc_profiles
  alter column travel_status set default '常驻所在城市';

update public.lc_profiles
set travel_status = '常驻所在城市'
where travel_status = '常驻本地';
