alter table public.lc_profiles
  add column if not exists wechat_mini_openid text;

create unique index if not exists lc_profiles_wechat_mini_openid_key
  on public.lc_profiles(wechat_mini_openid)
  where wechat_mini_openid is not null;
