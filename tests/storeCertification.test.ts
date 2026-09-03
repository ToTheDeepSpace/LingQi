import assert from 'node:assert/strict';
import test from 'node:test';
import { assertServicePaymentOwnership, normalizeServiceProductType, serviceProductPriceFen } from '../api/servicePayments.js';
import { WECHAT_VIRTUAL_GOODS } from '../api/wechatVirtualPayment.js';
import { createStoreCode, hashStoreCode, normalizeStoreCode, STORE_CODE_PACK_SIZE } from '../api/storeCertification.js';

test('store certification and each eleven-code pack cost ninety yuan; personal services remain nine', () => {
  for (const product of ['store_certification', 'store_code_pack'] as const) {
    assert.equal(normalizeServiceProductType(product), product);
    assert.equal(serviceProductPriceFen(product), 9000);
    assert.equal(WECHAT_VIRTUAL_GOODS[product].price, 9000);
  }
  for (const product of ['dossier_claim', 'provider_listing', 'provider_contact'] as const) {
    assert.equal(serviceProductPriceFen(product), 900);
  }
  assert.equal(STORE_CODE_PACK_SIZE, 11);
});

test('store payments reject nine yuan and legacy 8.88 yuan while personal legacy receipts remain valid', () => {
  for (const amount of [1,888,900]) assert.throws(() => assertServicePaymentOwnership({
    totalFee:amount,attemptAmountFen:amount,payerOpenid:'payer',expectedPayerOpenid:'payer',productType:'store_certification',
  }),/金额不匹配/);
  assert.doesNotThrow(() => assertServicePaymentOwnership({
    totalFee:9000,attemptAmountFen:9000,payerOpenid:'payer',expectedPayerOpenid:'payer',productType:'store_code_pack',
  }));
  assert.doesNotThrow(() => assertServicePaymentOwnership({
    totalFee:888,attemptAmountFen:888,payerOpenid:'payer',expectedPayerOpenid:'payer',productType:'dossier_claim',
  }));
});

test('codes are unpredictable, normalized, hashed and never accepted partially', () => {
  const codes = Array.from({ length: 1000 }, createStoreCode);
  assert.equal(new Set(codes.map(c => c.code)).size, 1000);
  for (const item of codes) {
    assert.match(item.code, /^JML-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    assert.equal(item.hash, hashStoreCode(item.code.toLowerCase()));
    assert.equal(item.lastFour, item.code.slice(-4));
    assert.equal(item.hash.length, 64);
  }
  assert.equal(normalizeStoreCode(' jml-abcd-2345 '), 'JML-ABCD-2345');
  assert.throws(() => hashStoreCode('1234'), /认证码/);
});
