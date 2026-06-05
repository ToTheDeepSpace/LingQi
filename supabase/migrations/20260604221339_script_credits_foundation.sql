-- 剧本作品资料基础字段：先沉淀公开 credits，不在本迁移里处理权属认领。

ALTER TABLE public.scripts
  ADD COLUMN IF NOT EXISTS credits jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.lc_script_contributions
  ADD COLUMN IF NOT EXISTS credits_patch jsonb NOT NULL DEFAULT '{}'::jsonb;
