import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SELLER_DEPOSIT_TIERS_FEN,
  calculateBanxijianQuote,
  compareDepositTierPriority,
  evaluateDepositReturn,
  isSellerDepositTierFen,
  type DepositReturnSnapshot,
  type SellerDepositTierFen,
} from '../api/banxijianRules.js';

test('reservation is 20% of service price plus all separately itemized travel', () => {
  assert.deepEqual(calculateBanxijianQuote(100_000, 30_000), {
    status: 'ready', currency: 'CNY', servicePriceFen: 100_000,
    travelCostFen: 30_000, serviceAndTravelTotalFen: 130_000,
    reservationServiceFen: 20_000, reservationTravelFen: 30_000,
    reservationTotalFen: 50_000, meetingServiceBalanceFen: 80_000,
  });
});

test('travel never changes the service reservation or balance amounts', () => {
  for (const travelCostFen of [0, 1, 30_000, 99_999]) {
    const quote = calculateBanxijianQuote(25_000, travelCostFen);
    assert.equal(quote.status, 'ready');
    if (quote.status !== 'ready') throw new Error('Expected exact split');
    assert.equal(quote.reservationServiceFen, 5_000);
    assert.equal(quote.meetingServiceBalanceFen, 20_000);
    assert.equal(quote.reservationTotalFen + quote.meetingServiceBalanceFen, quote.serviceAndTravelTotalFen);
  }
});

test('does not silently round fractional-fen service reservations', () => {
  for (const servicePriceFen of [1, 2, 3, 4, 999]) {
    const quote = calculateBanxijianQuote(servicePriceFen, 100);
    assert.equal(quote.status, 'needs_rounding_policy');
    assert.equal('reservationTotalFen' in quote, false);
  }
  assert.equal(calculateBanxijianQuote(5, 0).status, 'ready');
});

test('rejects invalid money inputs and unsafe total arithmetic', () => {
  for (const value of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => calculateBanxijianQuote(value, 0), RangeError);
    assert.throws(() => calculateBanxijianQuote(1000, value), RangeError);
  }
  assert.throws(() => calculateBanxijianQuote(0, 0), RangeError);
  assert.throws(() => calculateBanxijianQuote(Number.MAX_SAFE_INTEGER, 1), RangeError);
  assert.throws(() => calculateBanxijianQuote('1000' as unknown as number, 0), RangeError);
});

test('all exact small quotes conserve every fen', () => {
  for (let servicePriceFen = 5; servicePriceFen <= 10_000; servicePriceFen += 5) {
    const quote = calculateBanxijianQuote(servicePriceFen, 137);
    if (quote.status !== 'ready') throw new Error('Expected exact split');
    assert.equal(quote.reservationServiceFen * 5, servicePriceFen);
    assert.equal(quote.reservationTotalFen + quote.meetingServiceBalanceFen, servicePriceFen + 137);
  }
});

test('zero means optional non-participation; only three paid tiers are defined', () => {
  assert.deepEqual(SELLER_DEPOSIT_TIERS_FEN, [10_000, 50_000, 100_000]);
  for (const value of [0, ...SELLER_DEPOSIT_TIERS_FEN]) assert.equal(isSellerDepositTierFen(value), true);
  for (const value of [null, undefined, '10000', 100, 9999, 20_000, 50_001, -1, NaN]) {
    assert.equal(isSellerDepositTierFen(value), false);
  }
});

test('deposit ranking factor strictly increases without inventing numeric weights', () => {
  const tiers: SellerDepositTierFen[] = [0, ...SELLER_DEPOSIT_TIERS_FEN];
  for (let left = 0; left < tiers.length; left++) {
    for (let right = 0; right < tiers.length; right++) {
      assert.equal(compareDepositTierPriority(tiers[left], tiers[right]), Math.sign(left - right));
    }
  }
  assert.throws(() => compareDepositTierPriority(20000 as SellerDepositTierFen, 0), RangeError);
});

const eligibleSnapshot: DepositReturnSnapshot = {
  acceptingOrders: false, openOrderCount: 0,
  unresolvedAftersalesCount: 0, availableDepositFen: 46_700,
};

test('returns only the verified remaining amount after orders and aftersales end', () => {
  assert.deepEqual(evaluateDepositReturn(eligibleSnapshot), {
    eligible: true, amountFen: 46_700, blockers: [],
  });
});

test('each confirmed return condition must independently be met', () => {
  const cases: Array<[Partial<DepositReturnSnapshot>, string]> = [
    [{ acceptingOrders: true }, 'still_accepting_orders'],
    [{ openOrderCount: 1 }, 'open_orders'],
    [{ unresolvedAftersalesCount: 1 }, 'unresolved_aftersales'],
    [{ availableDepositFen: 0 }, 'no_available_deposit'],
  ];
  for (const [change, blocker] of cases) {
    assert.deepEqual(evaluateDepositReturn({ ...eligibleSnapshot, ...change }), {
      eligible: false, amountFen: 0, blockers: [blocker],
    });
  }
});

test('returns all active blockers rather than hiding unresolved aftersales', () => {
  assert.deepEqual(evaluateDepositReturn({ ...eligibleSnapshot, acceptingOrders: true, openOrderCount: 2, unresolvedAftersalesCount: 1 }), {
    eligible: false, amountFen: 0,
    blockers: ['still_accepting_orders', 'open_orders', 'unresolved_aftersales'],
  });
});

test('unknown or invalid return state fails closed and never implies zero open cases', () => {
  for (const key of Object.keys(eligibleSnapshot)) {
    for (const value of [null, undefined, '0', NaN, -1, 0.1, Infinity]) {
      const snapshot = { ...eligibleSnapshot, [key]: value } as DepositReturnSnapshot;
      assert.deepEqual(evaluateDepositReturn(snapshot), {
        eligible: false, amountFen: 0, blockers: ['unverified_state'],
      });
    }
  }
});

test('eligibility check does not mutate the supplied state', () => {
  const snapshot = Object.freeze({ ...eligibleSnapshot });
  evaluateDepositReturn(snapshot);
  assert.deepEqual(snapshot, eligibleSnapshot);
});
