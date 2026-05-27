-- 011: 修复 lc_rankings → lc_profiles 外键关系
-- PostgREST 需要用外键才能做联表查询

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lc_rankings_poster_id_fkey'
  ) THEN
    ALTER TABLE lc_rankings ADD CONSTRAINT lc_rankings_poster_id_fkey
      FOREIGN KEY (poster_id) REFERENCES lc_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;