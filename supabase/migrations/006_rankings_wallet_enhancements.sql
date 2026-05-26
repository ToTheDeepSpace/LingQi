-- 006: 红黑榜增强 — 过期机制 + 文件上传 + 钱包系统

-- 红黑榜过期
ALTER TABLE lc_rankings ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE lc_rankings ADD COLUMN IF NOT EXISTS expiry_override text;
ALTER TABLE lc_rankings ADD COLUMN IF NOT EXISTS files jsonb DEFAULT '[]'::jsonb;
UPDATE lc_rankings SET expires_at = created_at + INTERVAL '30 days' WHERE type = 'black' AND expires_at IS NULL;

-- 钱包余额
ALTER TABLE lc_profiles ADD COLUMN IF NOT EXISTS balance int DEFAULT 0;

-- 交易记录
CREATE TABLE IF NOT EXISTS lc_transactions (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id    uuid REFERENCES lc_profiles(id),
  type          text NOT NULL,
  amount        int NOT NULL,
  description   text,
  payment_proof text,
  status        text DEFAULT 'pending',
  created_at    timestamptz DEFAULT now()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_lc_transactions_profile ON lc_transactions(profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lc_rankings_expires ON lc_rankings(expires_at) WHERE type = 'black';