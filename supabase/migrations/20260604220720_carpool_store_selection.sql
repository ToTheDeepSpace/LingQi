-- 拼车可关联剧司辰已有店家；手动填写店家仍保留为待核验线索。

ALTER TABLE public.lc_carpools
  ADD COLUMN IF NOT EXISTS store_id uuid;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'jzg_stores'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lc_carpools_store_id_fkey'
  ) THEN
    ALTER TABLE public.lc_carpools
      ADD CONSTRAINT lc_carpools_store_id_fkey
      FOREIGN KEY (store_id) REFERENCES public.jzg_stores(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS lc_carpools_store_id_idx
  ON public.lc_carpools(store_id, event_date DESC);
