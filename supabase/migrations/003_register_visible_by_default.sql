-- 账号注册不需要审核；红黑榜内容仍由人工审核。

alter table if exists lc_profiles
  alter column is_visible set default true;
