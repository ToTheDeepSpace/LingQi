-- 档期来源追踪：手动、剧司辰同步、截图导入。

alter table if exists lc_availability
  add column if not exists source text default 'manual',
  add column if not exists source_id text,
  add column if not exists source_payload jsonb default '{}'::jsonb;

create index if not exists lc_availability_creator_source_idx
  on lc_availability(creator_id, source, source_id)
  where source_id is not null;

create index if not exists lc_availability_creator_date_idx
  on lc_availability(creator_id, date);
