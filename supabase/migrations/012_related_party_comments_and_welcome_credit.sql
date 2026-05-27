-- 012: 相关方置顶回应 + 新用户契约币赠送

ALTER TABLE lc_comments
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pin_label text;

CREATE INDEX IF NOT EXISTS lc_comments_ranking_pinned_idx
  ON lc_comments(ranking_id, is_pinned DESC, likes DESC, created_at ASC);

ALTER TABLE lc_profiles
  ALTER COLUMN balance SET DEFAULT 30;
