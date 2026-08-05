import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  WECHAT_VIRTUAL_GOODS,
  assertWechatVirtualDelivery,
  createWechatVirtualPaySig,
  createWechatVirtualPaymentParams,
  createWechatVirtualPaymentSignData,
  normalizeWechatVirtualDeliverEvent,
  requestWechatXpay,
  wechatVirtualOrderStatus,
} from '../api/wechatVirtualPayment.js';

test('virtual goods use stable ids and the existing 8.88 price', () => {
  for (const good of Object.values(WECHAT_VIRTUAL_GOODS)) {
    assert.match(good.id, /^[A-Za-z0-9_-]{1,20}$/);
    assert.equal(good.price, 888);
    assert.ok(good.name.length > 0);
  }
});

test('client signature data follows the documented field order', () => {
  const signData = createWechatVirtualPaymentSignData({
    offerId: 'offer-1',
    env: 0,
    productId: 'dossier_claim',
    goodsPrice: 888,
    outTradeNo: 'JMLS1',
    attach: 'purchase-1',
  });
  assert.equal(
    signData,
    '{"offerId":"offer-1","buyQuantity":1,"env":0,"currencyType":"CNY","productId":"dossier_claim","goodsPrice":888,"outTradeNo":"JMLS1","attach":"purchase-1"}',
  );
});

test('virtual payment client and server HMAC signatures are exact', () => {
  const params = createWechatVirtualPaymentParams({
    offerId: 'offer-1',
    appKey: 'app-key',
    sessionKey: 'session-key',
    env: 0,
    productType: 'dossier_claim',
    outTradeNo: 'JMLS1',
    attach: 'purchase-1',
  });
  assert.equal(
    params.paySig,
    createHmac('sha256', 'app-key').update(`requestVirtualPayment&${params.signData}`).digest('hex'),
  );
  assert.equal(
    params.signature,
    createHmac('sha256', 'session-key').update(params.signData).digest('hex'),
  );
  const body = JSON.stringify({ openid: 'openid', env: 0, order_id: 'JMLS1' });
  assert.equal(
    createWechatVirtualPaySig('app-key', '/xpay/query_order', body),
    createHmac('sha256', 'app-key').update(`/xpay/query_order&${body}`).digest('hex'),
  );
});

test('delivery acknowledgement omits pay_sig as required by the dedicated API', async () => {
  let requestedUrl = '';
  const fetcher = (async (input: string | URL | Request) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({ errcode: 0, errmsg: '' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  await requestWechatXpay({
    accessToken: 'access-token',
    appKey: 'app-key',
    uri: '/xpay/notify_provide_goods',
    body: { order_id: 'JMLS1', env: 0 },
    requiresPaySig: false,
    fetcher,
  });
  const url = new URL(requestedUrl);
  assert.equal(url.searchParams.get('access_token'), 'access-token');
  assert.equal(url.searchParams.has('pay_sig'), false);
});

test('delivery callback validates payer, product, amount and attach', () => {
  const callback = normalizeWechatVirtualDeliverEvent({
    Event: 'xpay_goods_deliver_notify',
    OpenId: 'openid-1',
    OutTradeNo: 'JMLS1',
    Env: 0,
    WeChatPayInfo: { TransactionId: 'wx-order-1' },
    GoodsInfo: {
      ProductId: 'provider_listing',
      Quantity: 1,
      OrigPrice: 888,
      ActualPrice: 888,
      Attach: 'purchase-1',
    },
  });
  assert.doesNotThrow(() => assertWechatVirtualDelivery({
    callback,
    expectedEnv: 0,
    expectedProductType: 'provider_listing',
    expectedOpenid: 'openid-1',
    expectedAmountFen: 888,
    expectedAttach: 'purchase-1',
  }));
  assert.throws(() => assertWechatVirtualDelivery({
    callback,
    expectedEnv: 0,
    expectedProductType: 'provider_listing',
    expectedOpenid: 'openid-2',
    expectedAmountFen: 888,
    expectedAttach: 'purchase-1',
  }), /付款人不匹配/);
});

test('query status treats paid, delivered, closed and refunded distinctly', () => {
  assert.equal(wechatVirtualOrderStatus(2).paid, true);
  assert.equal(wechatVirtualOrderStatus(4).delivered, true);
  assert.equal(wechatVirtualOrderStatus(5).refunded, true);
  assert.equal(wechatVirtualOrderStatus(6).closed, true);
});

test('miniapp service payment uses requestVirtualPayment instead of requestPayment', () => {
  const source = readFileSync('miniapp/jumulu/src/utils/api.ts', 'utf8');
  assert.match(source, /requestVirtualPayment/);
  const paymentFunction = source.slice(source.indexOf('export async function requestServicePayment'));
  assert.doesNotMatch(paymentFunction, /uni\.requestPayment/);
});

test('goods synchronization batches upload and publish requests', () => {
  const source = readFileSync('api/syncWechatVirtualGoods.ts', 'utf8');
  assert.match(source, /const goods = Object\.values\(WECHAT_VIRTUAL_GOODS\)/);
  assert.match(source, /upload_item: goods\.map/);
  assert.match(source, /publish_item: goods\.map/);
  assert.doesNotMatch(source, /for \(const good of Object\.values\(WECHAT_VIRTUAL_GOODS\)\)/);
});
