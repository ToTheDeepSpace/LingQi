-- 灵契防篡改审计链
-- 说明：原型期先做站内 hash chain，不直接上公开链。
-- 每次公开内容被审核通过时，API 写入 canonical payload 的 sha256、
-- 前一条 entry_hash，以及当前 entry_hash。日终 root hash 可后续锚定到
-- 可信时间戳服务或公链。

CREATE TABLE IF NOT EXISTS lc_audit_chain_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL CHECK (target_type IN ('ranking', 'comment', 'commission', 'carpool')),
  target_id uuid NOT NULL,
  event_type text NOT NULL,
  content_hash text NOT NULL CHECK (length(content_hash) = 64),
  previous_hash text CHECK (previous_hash IS NULL OR length(previous_hash) = 64),
  entry_hash text NOT NULL UNIQUE CHECK (length(entry_hash) = 64),
  canonical_payload jsonb NOT NULL,
  actor_id text,
  actor_role text NOT NULL DEFAULT 'system',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  chain_date date NOT NULL DEFAULT ((now() AT TIME ZONE 'utc')::date),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lc_audit_chain_target_idx
  ON lc_audit_chain_entries(target_type, target_id, created_at DESC);

CREATE INDEX IF NOT EXISTS lc_audit_chain_date_idx
  ON lc_audit_chain_entries(chain_date, created_at);

CREATE INDEX IF NOT EXISTS lc_audit_chain_previous_hash_idx
  ON lc_audit_chain_entries(previous_hash);

CREATE TABLE IF NOT EXISTS lc_audit_daily_roots (
  audit_date date PRIMARY KEY,
  root_hash text NOT NULL CHECK (length(root_hash) = 64),
  entry_count integer NOT NULL DEFAULT 0 CHECK (entry_count >= 0),
  first_entry_hash text CHECK (first_entry_hash IS NULL OR length(first_entry_hash) = 64),
  last_entry_hash text CHECK (last_entry_hash IS NULL OR length(last_entry_hash) = 64),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE lc_audit_chain_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE lc_audit_daily_roots ENABLE ROW LEVEL SECURITY;
