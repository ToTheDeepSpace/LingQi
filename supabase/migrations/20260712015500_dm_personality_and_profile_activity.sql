alter table public.lc_dm_dossiers
  add column if not exists mbti text,
  add column if not exists zodiac text;

alter table public.lc_profiles
  add column if not exists last_seen_at timestamptz;

alter table public.lc_dm_dossiers
  drop constraint if exists lc_dm_dossiers_mbti_check,
  drop constraint if exists lc_dm_dossiers_zodiac_check;

alter table public.lc_dm_dossiers
  add constraint lc_dm_dossiers_mbti_check
    check (mbti is null or mbti in (
      'INTJ', 'INTP', 'ENTJ', 'ENTP',
      'INFJ', 'INFP', 'ENFJ', 'ENFP',
      'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
      'ISTP', 'ISFP', 'ESTP', 'ESFP'
    )),
  add constraint lc_dm_dossiers_zodiac_check
    check (zodiac is null or zodiac in (
      '白羊座', '金牛座', '双子座', '巨蟹座',
      '狮子座', '处女座', '天秤座', '天蝎座',
      '射手座', '摩羯座', '水瓶座', '双鱼座'
    ));

create index if not exists idx_lc_profiles_last_seen_at
  on public.lc_profiles(last_seen_at desc);

grant select, insert, update, delete on table public.lc_dm_dossiers to lingqi_app;
grant select, update on table public.lc_profiles to lingqi_app;
