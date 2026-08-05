import { createSign, randomBytes } from 'node:crypto';

export const SERVICE_FEE_FEN = 900;
export const SERVICE_FEE_YUAN = '9.00';

export const SERVICE_PRODUCT_TYPES = [
  'dossier_claim',
  'provider_listing',
  'provider_contact',
] as const;

export type ServiceProductType = typeof SERVICE_PRODUCT_TYPES[number];

const PRODUCT_DESCRIPTIONS: Record<ServiceProductType, string> = {
  dossier_claim: '剧幕录档案认领审核服务',
  provider_listing: '剧幕录委托条上架服务',
  provider_contact: '剧幕录委托师联系方式解锁',
};

function normalizePemBlock(raw: string) {
  const value = String(raw || '').trim().replace(/\\n/g, '\n');
  if (value.includes('-----BEGIN')) return value;
  return `-----BEGIN PRIVATE KEY-----\n${value.match(/.{1,64}/g)?.join('\n') || value}\n-----END PRIVATE KEY-----`;
}

export function normalizeServiceProductType(value: unknown): ServiceProductType | null {
  const type = String(value || '').trim() as ServiceProductType;
  return SERVICE_PRODUCT_TYPES.includes(type) ? type : null;
}

export function serviceProductDescription(productType: ServiceProductType) {
  return PRODUCT_DESCRIPTIONS[productType];
}

export function servicePurchaseGrantsAccess(status: unknown) {
  return status === 'paid';
}

export function assertServicePaymentEnvelope(input: {
  appId: string;
  mchId: string;
  currency: string;
  payerOpenid: string;
  expectedAppId: string;
  expectedMchId: string;
}) {
  if (input.appId !== input.expectedAppId || input.mchId !== input.expectedMchId) {
    throw new Error('付费服务通知商户信息不匹配');
  }
  if (input.currency !== 'CNY') throw new Error('付费服务通知币种不匹配');
  if (!input.payerOpenid) throw new Error('付费服务通知缺少付款人身份');
}

export function assertServicePaymentOwnership(input: {
  totalFee: number;
  attemptAmountFen: number;
  payerOpenid: string;
  expectedPayerOpenid: string | null;
}) {
  if (input.totalFee !== SERVICE_FEE_FEN || input.attemptAmountFen !== SERVICE_FEE_FEN) {
    throw new Error('付费服务通知金额不匹配');
  }
  if (!input.expectedPayerOpenid || input.expectedPayerOpenid !== input.payerOpenid) {
    throw new Error('付费服务通知付款人不匹配');
  }
}

export function createMiniappPaymentParams(input: {
  appId: string;
  prepayId: string;
  privateKey: string;
  timestamp?: string;
  nonceStr?: string;
}) {
  const timeStamp = input.timestamp || Math.floor(Date.now() / 1000).toString();
  const nonceStr = input.nonceStr || randomBytes(16).toString('hex');
  const packageValue = `prepay_id=${input.prepayId}`;
  const message = `${input.appId}\n${timeStamp}\n${nonceStr}\n${packageValue}\n`;
  const signer = createSign('RSA-SHA256');
  signer.update(message, 'utf8');
  signer.end();
  return {
    timeStamp,
    nonceStr,
    package: packageValue,
    signType: 'RSA' as const,
    paySign: signer.sign(normalizePemBlock(input.privateKey), 'base64'),
  };
}
