alter table if exists public.lc_rankings
  add column if not exists display_files jsonb not null default '[]'::jsonb,
  add column if not exists private_evidence_files jsonb not null default '[]'::jsonb;

comment on column public.lc_rankings.display_files is '审核通过后随正文公开展示的图片；最多6张';
comment on column public.lc_rankings.private_evidence_files is '仅管理员鉴权读取的审核证据元数据，文件存放于私密目录；最多8张';
