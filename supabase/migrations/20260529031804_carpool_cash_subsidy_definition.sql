-- 018: 拼车补贴口径修正
--
-- 补贴不是灵契契约币；它是车头/恋陪位给其他玩家位的现金补贴或票价折扣。
-- subsidy_amount 继续保存现金金额（元）；非纯金额折扣写入 subsidy_note。

ALTER TABLE lc_carpools
  ADD COLUMN IF NOT EXISTS subsidy_note text;
