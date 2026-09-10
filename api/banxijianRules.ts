/**
 * Confirmed Banxijian product rules. Pure calculations only: no payment,
 * persistence, authorization, ranking weights or settlement side effects.
 * All money is CNY in integer fen. Callers must use verified server-side data.
 */
export const SELLER_DEPOSIT_TIERS_FEN = [10_000, 50_000, 100_000] as const;
export type SellerDepositTierFen = 0 | typeof SELLER_DEPOSIT_TIERS_FEN[number];

function requireFen(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${field} must be non-negative safe integer fen`);
  }
  return value;
}

export function calculateBanxijianQuote(servicePriceFen: number, travelCostFen: number) {
  requireFen(servicePriceFen, 'servicePriceFen');
  requireFen(travelCostFen, 'travelCostFen');
  if (servicePriceFen === 0) throw new RangeError('servicePriceFen must be positive');
  const serviceAndTravelTotalFen = requireFen(servicePriceFen + travelCostFen, 'serviceAndTravelTotalFen');
  const base = { currency: 'CNY' as const, servicePriceFen, travelCostFen, serviceAndTravelTotalFen };

  // Do not silently choose a rounding policy for unconfirmed fractional-fen cases.
  if (servicePriceFen % 5 !== 0) {
    return { ...base, status: 'needs_rounding_policy' as const };
  }

  const reservationServiceFen = servicePriceFen / 5;
  return {
    ...base,
    status: 'ready' as const,
    reservationServiceFen,
    reservationTravelFen: travelCostFen,
    reservationTotalFen: reservationServiceFen + travelCostFen,
    meetingServiceBalanceFen: servicePriceFen - reservationServiceFen,
  };
}

export function isSellerDepositTierFen(value: unknown): value is SellerDepositTierFen {
  return value === 0 || SELLER_DEPOSIT_TIERS_FEN.some(tier => tier === value);
}

/** Compare the deposit factor only, not the final ordering of providers. */
export function compareDepositTierPriority(left: SellerDepositTierFen, right: SellerDepositTierFen): -1 | 0 | 1 {
  if (!isSellerDepositTierFen(left) || !isSellerDepositTierFen(right)) {
    throw new RangeError('Unsupported seller deposit tier');
  }
  return left === right ? 0 : left > right ? 1 : -1;
}

export type DepositReturnSnapshot = {
  acceptingOrders: boolean | null;
  openOrderCount: number | null;
  unresolvedAftersalesCount: number | null;
  /** Verified remaining amount available for return, after holds and prior returns. */
  availableDepositFen: number | null;
};

export type DepositReturnBlocker =
  | 'unverified_state'
  | 'still_accepting_orders'
  | 'open_orders'
  | 'unresolved_aftersales'
  | 'no_available_deposit';

/**
 * Eligibility preview, not authority to send a refund. A future refund route
 * must recheck ownership, fresh order/aftersales state and ledger holds atomically.
 */
export function evaluateDepositReturn(snapshot: DepositReturnSnapshot):
  | { eligible: true; amountFen: number; blockers: [] }
  | { eligible: false; amountFen: 0; blockers: DepositReturnBlocker[] } {
  const verifiedCount = (value: number | null): value is number =>
    typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

  if (typeof snapshot.acceptingOrders !== 'boolean'
    || !verifiedCount(snapshot.openOrderCount)
    || !verifiedCount(snapshot.unresolvedAftersalesCount)
    || !verifiedCount(snapshot.availableDepositFen)) {
    return { eligible: false, amountFen: 0, blockers: ['unverified_state'] };
  }

  const blockers: DepositReturnBlocker[] = [];
  if (snapshot.acceptingOrders) blockers.push('still_accepting_orders');
  if (snapshot.openOrderCount > 0) blockers.push('open_orders');
  if (snapshot.unresolvedAftersalesCount > 0) blockers.push('unresolved_aftersales');
  if (snapshot.availableDepositFen === 0) blockers.push('no_available_deposit');
  return blockers.length > 0
    ? { eligible: false, amountFen: 0, blockers }
    : { eligible: true, amountFen: snapshot.availableDepositFen, blockers: [] };
}
