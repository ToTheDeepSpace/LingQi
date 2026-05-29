-- 019: 拼车消息工作台
--
-- 精细保留车头消息里的补贴语义，避免把半价、免票、折扣、A补、减价
-- 全部压缩成旧的吃补/出补。

ALTER TABLE lc_carpools
  ADD COLUMN IF NOT EXISTS subsidy_type text NOT NULL DEFAULT 'none'
    CHECK (subsidy_type IN ('none', 'half_price', 'free_ticket', 'discount', 'a_subsidy', 'fixed_deduct', 'custom')),
  ADD COLUMN IF NOT EXISTS subsidy_discount numeric(4,1)
    CHECK (subsidy_discount IS NULL OR (subsidy_discount > 0 AND subsidy_discount <= 10));
