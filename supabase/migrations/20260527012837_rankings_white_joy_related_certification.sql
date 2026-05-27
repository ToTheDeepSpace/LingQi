-- 013: 白榜 + 免费欢乐投票 + 评论相关方认证

ALTER TABLE lc_rankings
  ADD COLUMN IF NOT EXISTS joys integer DEFAULT 0;

CREATE INDEX IF NOT EXISTS lc_rankings_type_joys_idx
  ON lc_rankings(type, joys DESC, created_at DESC);
