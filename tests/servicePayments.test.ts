import assert from 'node:assert/strict';
import { generateKeyPairSync, verify } from 'node:crypto';
import test from 'node:test';
import {
  SERVICE_FEE_FEN,
  assertServicePaymentEnvelope,
  assertServicePaymentOwnership,
  createMiniappPaymentParams,
  normalizeServiceProductType,
  servicePurchaseGrantsAccess,
} from '../api/servicePayments.js';

test('service payment amount and product types are server controlled', () => {
  assert.equal(SERVICE_FEE_FEN, 900);
  assert.equal(normalizeServiceProductType('dossier_claim'), 'dossier_claim');
  assert.equal(normalizeServiceProductType('provider_listing'), 'provider_listing');
  assert.equal(normalizeServiceProductType('provider_contact'), 'provider_contact');
  assert.equal(normalizeServiceProductType('wallet_recharge'), null);
});

test('only paid purchases grant durable access', () => {
  assert.equal(servicePurchaseGrantsAccess('paid'), true);
  assert.equal(servicePurchaseGrantsAccess('unpaid'), false);
  assert.equal(servicePurchaseGrantsAccess('refunded'), false);
});

test('service payment envelope must match the configured miniapp merchant', () => {
  assert.doesNotThrow(() => assertServicePaymentEnvelope({
    appId: 'wx-app',
    mchId: 'merchant',
    currency: 'CNY',
    payerOpenid: 'payer',
    expectedAppId: 'wx-app',
    expectedMchId: 'merchant',
  }));
  assert.throws(() => assertServicePaymentEnvelope({
    appId: 'wx-other',
    mchId: 'merchant',
    currency: 'CNY',
    payerOpenid: 'payer',
    expectedAppId: 'wx-app',
    expectedMchId: 'merchant',
  }), /商户信息不匹配/);
});

test('service payment ownership rejects wrong amount and another payer', () => {
  assert.doesNotThrow(() => assertServicePaymentOwnership({
    totalFee: 900,
    attemptAmountFen: 900,
    payerOpenid: 'payer-a',
    expectedPayerOpenid: 'payer-a',
  }));
  assert.throws(() => assertServicePaymentOwnership({
    totalFee: 1,
    attemptAmountFen: 900,
    payerOpenid: 'payer-a',
    expectedPayerOpenid: 'payer-a',
  }), /金额不匹配/);
  assert.throws(() => assertServicePaymentOwnership({
    totalFee: 900,
    attemptAmountFen: 900,
    payerOpenid: 'payer-b',
    expectedPayerOpenid: 'payer-a',
  }), /付款人不匹配/);
});

test('miniapp payment params use the official appid prepay signature string', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const params = createMiniappPaymentParams({
    appId: 'wx-test-app',
    prepayId: 'wx-prepay-test',
    privateKey: privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
    timestamp: '1720000000',
    nonceStr: 'fixed-nonce',
  });
  assert.equal(params.package, 'prepay_id=wx-prepay-test');
  assert.equal(params.signType, 'RSA');
  assert.equal(verify(
    'RSA-SHA256',
    Buffer.from('wx-test-app\n1720000000\nfixed-nonce\nprepay_id=wx-prepay-test\n'),
    publicKey,
    Buffer.from(params.paySign, 'base64'),
  ), true);
});
