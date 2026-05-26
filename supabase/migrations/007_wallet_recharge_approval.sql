-- 007: 钱包充值审核闭环

ALTER TABLE lc_profiles
  ADD COLUMN IF NOT EXISTS balance int NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS lc_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES lc_profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('recharge', 'spend')),
  amount int NOT NULL,
  description text NOT NULL,
  payment_proof text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reject_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE lc_transactions
  ADD COLUMN IF NOT EXISTS reject_reason text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS lc_transactions_profile_created_idx
  ON lc_transactions(profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS lc_transactions_status_created_idx
  ON lc_transactions(status, created_at DESC);

ALTER TABLE lc_transactions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION approve_lc_recharge(p_transaction_id uuid)
RETURNS TABLE(profile_id uuid, balance integer)
LANGUAGE plpgsql
AS $$
DECLARE
  tx record;
  new_balance integer;
BEGIN
  SELECT id, profile_id, amount, status, type
    INTO tx
    FROM lc_transactions
    WHERE id = p_transaction_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '充值记录不存在';
  END IF;

  IF tx.type <> 'recharge' THEN
    RAISE EXCEPTION '不是充值记录';
  END IF;

  IF tx.status <> 'pending' THEN
    RAISE EXCEPTION '充值记录已处理';
  END IF;

  UPDATE lc_profiles
    SET balance = COALESCE(balance, 0) + tx.amount,
        updated_at = now()
    WHERE id = tx.profile_id
    RETURNING lc_profiles.balance INTO new_balance;

  UPDATE lc_transactions
    SET status = 'approved',
        updated_at = now()
    WHERE id = tx.id;

  RETURN QUERY SELECT tx.profile_id, new_balance;
END;
$$;
