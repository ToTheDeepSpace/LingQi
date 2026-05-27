-- 014: 相关方认证资料

ALTER TABLE lc_comments
  ADD COLUMN IF NOT EXISTS related_note text,
  ADD COLUMN IF NOT EXISTS related_files jsonb DEFAULT '[]'::jsonb;
