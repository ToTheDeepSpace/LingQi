import { createHmac } from 'node:crypto';
import {
  SERVICE_FEE_FEN,
  type ServiceProductType,
} from './servicePayments.js';

export type WechatVirtualPayEnv = 0 | 1;

export type WechatVirtualGood = {
  id: string;
  name: string;
  price: number;
  remark: string;
};

export const WECHAT_VIRTUAL_SANDBOX_GOOD: Readonly<WechatVirtualGood> = {
  id: 'jumulu_sandbox_test',
  name: '支付链路测试',
  price: 1,
  remark: '剧幕录沙箱支付链路测试，不开通正式权益',
};

export const WECHAT_VIRTUAL_GOODS: Readonly<Record<ServiceProductType, WechatVirtualGood>> = {
  dossier_claim: {
    id: 'dossier_claim',
    name: '档案认领',
    price: SERVICE_FEE_FEN,
    remark: '剧幕录档案认领审核服务',
  },
  provider_listing: {
    id: 'provider_listing',
    name: '委托条上架',
    price: SERVICE_FEE_FEN,
    remark: '剧幕录委托条上架服务',
  },
  provider_contact: {
    id: 'provider_contact',
    name: '联系服务者',
    price: SERVICE_FEE_FEN,
    remark: '剧幕录服务者联系方式解锁',
  },
};

export function normalizeWechatVirtualPayEnv(value: unknown): WechatVirtualPayEnv {
  return Number(value) === 1 ? 1 : 0;
}

export function virtualGood(productType: ServiceProductType): WechatVirtualGood {
  return WECHAT_VIRTUAL_GOODS[productType];
}

export function virtualGoodForEnv(
  productType: ServiceProductType,
  env: WechatVirtualPayEnv,
): WechatVirtualGood {
  return env === 1 ? WECHAT_VIRTUAL_SANDBOX_GOOD : virtualGood(productType);
}

export function hmacSha256Hex(key: string, message: string): string {
  return createHmac('sha256', key).update(message, 'utf8').digest('hex');
}

export function createWechatVirtualPaySig(appKey: string, uri: string, exactJsonBody: string): string {
  if (!appKey) throw new Error('微信虚拟支付 AppKey 未配置');
  if (!uri.startsWith('/xpay/')) throw new Error('微信虚拟支付接口路径不正确');
  return hmacSha256Hex(appKey, `${uri}&${exactJsonBody}`);
}

export function createWechatVirtualPaymentSignData(input: {
  offerId: string;
  env: WechatVirtualPayEnv;
  productId: string;
  goodsPrice: number;
  outTradeNo: string;
  attach: string;
}): string {
  return JSON.stringify({
    offerId: input.offerId,
    buyQuantity: 1,
    env: input.env,
    currencyType: 'CNY',
    productId: input.productId,
    goodsPrice: input.goodsPrice,
    outTradeNo: input.outTradeNo,
    attach: input.attach,
  });
}

export function createWechatVirtualPaymentParams(input: {
  offerId: string;
  appKey: string;
  sessionKey: string;
  env: WechatVirtualPayEnv;
  productType: ServiceProductType;
  outTradeNo: string;
  attach: string;
}) {
  if (!input.offerId) throw new Error('微信虚拟支付 OfferId 未配置');
  if (!input.sessionKey) throw new Error('微信登录会话已失效，请重新发起支付');
  const good = virtualGoodForEnv(input.productType, input.env);
  const signData = createWechatVirtualPaymentSignData({
    offerId: input.offerId,
    env: input.env,
    productId: good.id,
    goodsPrice: good.price,
    outTradeNo: input.outTradeNo,
    attach: input.attach,
  });
  return {
    mode: 'short_series_goods' as const,
    signData,
    paySig: hmacSha256Hex(input.appKey, `requestVirtualPayment&${signData}`),
    signature: hmacSha256Hex(input.sessionKey, signData),
  };
}

export type WechatXpayResponse = {
  errcode?: number;
  errmsg?: string;
  [key: string]: unknown;
};

export async function requestWechatXpay<T extends WechatXpayResponse>(input: {
  accessToken: string;
  appKey: string;
  uri: `/xpay/${string}`;
  body: Record<string, unknown>;
  timeoutMs?: number;
  requiresPaySig?: boolean;
  fetcher?: typeof fetch;
}): Promise<T> {
  const exactJsonBody = JSON.stringify(input.body);
  const requiresPaySig = input.requiresPaySig !== false;
  const url = new URL(`https://api.weixin.qq.com${input.uri}`);
  const query = new URLSearchParams({ access_token: input.accessToken });
  if (requiresPaySig) {
    query.set('pay_sig', createWechatVirtualPaySig(input.appKey, input.uri, exactJsonBody));
  }
  url.search = query.toString();
  const fetcher = input.fetcher || fetch;
  const response = await fetcher(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: exactJsonBody,
    signal: AbortSignal.timeout(input.timeoutMs || 8_000),
  });
  const payload = await response.json() as T;
  if (!response.ok || Number(payload.errcode || 0) !== 0) {
    const error = new Error(String(payload.errmsg || `微信虚拟支付接口失败(${response.status})`));
    Object.assign(error, { errcode: Number(payload.errcode || response.status), payload });
    throw error;
  }
  return payload;
}

export function wechatVirtualOrderStatus(value: unknown) {
  const status = Number(value);
  return {
    status,
    paid: status === 2 || status === 3 || status === 4,
    delivered: status === 4,
    refunded: status === 5 || status === 8,
    closed: status === 6,
    refundFailed: status === 7,
  };
}

export type WechatVirtualGoodsDeliverEvent = {
  Event?: string;
  event?: string;
  OpenId?: string;
  openid?: string;
  OutTradeNo?: string;
  out_trade_no?: string;
  Env?: number;
  env?: number;
  WeChatPayInfo?: {
    MchOrderNo?: string;
    TransactionId?: string;
    PaidTime?: string;
  };
  GoodsInfo?: {
    ProductId?: string;
    Quantity?: number;
    OrigPrice?: number;
    ActualPrice?: number;
    Attach?: string;
  };
};

export function normalizeWechatVirtualDeliverEvent(payload: WechatVirtualGoodsDeliverEvent) {
  const payInfo = payload.WeChatPayInfo || {};
  const goodsInfo = payload.GoodsInfo || {};
  return {
    event: String(payload.Event || payload.event || '').toLowerCase(),
    openid: String(payload.OpenId || payload.openid || ''),
    outTradeNo: String(payload.OutTradeNo || payload.out_trade_no || payInfo.MchOrderNo || ''),
    transactionId: String(payInfo.TransactionId || ''),
    paidTime: String(payInfo.PaidTime || ''),
    env: normalizeWechatVirtualPayEnv(payload.Env ?? payload.env),
    productId: String(goodsInfo.ProductId || ''),
    quantity: Number(goodsInfo.Quantity || 0),
    originalPrice: Number(goodsInfo.OrigPrice),
    actualPrice: Number(goodsInfo.ActualPrice),
    attach: String(goodsInfo.Attach || ''),
  };
}

export function assertWechatVirtualDelivery(input: {
  callback: ReturnType<typeof normalizeWechatVirtualDeliverEvent>;
  expectedEnv: WechatVirtualPayEnv;
  expectedProductId: string;
  expectedOpenid: string | null;
  expectedAmountFen: number;
  expectedAttach: string;
}) {
  const { callback } = input;
  if (callback.event !== 'xpay_goods_deliver_notify') throw new Error('微信虚拟支付回调类型不正确');
  if (!callback.outTradeNo || !callback.transactionId) throw new Error('微信虚拟支付回调缺少订单号');
  if (callback.env !== input.expectedEnv) throw new Error('微信虚拟支付环境不匹配');
  if (callback.productId !== input.expectedProductId) throw new Error('微信虚拟支付道具不匹配');
  if (callback.quantity !== 1) throw new Error('微信虚拟支付购买数量不匹配');
  if (
    callback.originalPrice !== input.expectedAmountFen
    || callback.actualPrice !== input.expectedAmountFen
  ) {
    throw new Error('微信虚拟支付金额不匹配');
  }
  if (!input.expectedOpenid || callback.openid !== input.expectedOpenid) {
    throw new Error('微信虚拟支付付款人不匹配');
  }
  if (callback.attach !== input.expectedAttach) throw new Error('微信虚拟支付订单附加信息不匹配');
}
