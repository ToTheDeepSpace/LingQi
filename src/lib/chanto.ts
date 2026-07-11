export const CHANTO_MIN_AMOUNT = 1;
export const CHANTO_MAX_AMOUNT = 1000;
export const CHANTO_DAILY_LIMIT = 3000;
export const CHANTO_PLATFORM_FEE_RATE = 0.2;
export const CHANTO_FREEZE_DAYS = 3;

export function isValidChantoAmount(amount: number) {
  return Number.isInteger(amount) && amount >= CHANTO_MIN_AMOUNT && amount <= CHANTO_MAX_AMOUNT;
}

export function calculateChantoSplit(amount: number) {
  if (!isValidChantoAmount(amount)) throw new Error(`缠头须为 ${CHANTO_MIN_AMOUNT}-${CHANTO_MAX_AMOUNT} 的整数榜金`);
  const platformFee = Math.floor(amount * CHANTO_PLATFORM_FEE_RATE);
  return { grossAmount: amount, platformFee, receiverAmount: amount - platformFee };
}
