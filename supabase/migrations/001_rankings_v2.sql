-- 红黑榜 v2：实名字段 + 评论表 + 认领表

ALTER TABLE lc_rankings ADD COLUMN IF NOT EXISTS is_realname boolean DEFAULT false;
ALTER TABLE lc_rankings ADD COLUMN IF NOT EXISTS real_name text;

CREATE TABLE IF NOT EXISTS lc_comments (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ranking_id   uuid REFERENCES lc_rankings(id) ON DELETE CASCADE,
  content      text NOT NULL,
  author_name  text NOT NULL,
  is_realname  boolean DEFAULT false,
  real_name    text,
  payment_proof text,
  likes        int DEFAULT 0,
  status       text DEFAULT 'pending',
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lc_claims (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ranking_id  uuid REFERENCES lc_rankings(id) ON DELETE CASCADE,
  contact     text NOT NULL,
  message     text,
  status      text DEFAULT 'pending',
  created_at  timestamptz DEFAULT now()
);
