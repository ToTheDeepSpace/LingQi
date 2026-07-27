export const WECHAT_IMAGE_CALLBACK_STALE_MS = 35 * 60 * 1000;

export function wechatSafetyStatusPresentation(
  status: 'pending' | 'pass' | 'review' | 'risky' | 'error',
  checkType: 'text' | 'image',
  createdAt?: string | null,
  nowMs = Date.now(),
) {
  const createdAtMs = Date.parse(String(createdAt || ''));
  const callbackStale = status === 'pending'
    && checkType === 'image'
    && Number.isFinite(createdAtMs)
    && nowMs - createdAtMs >= WECHAT_IMAGE_CALLBACK_STALE_MS;
  if (callbackStale) {
    return {
      label: '回调超时',
      accent: '#b91c1c',
      note: '超过 35 分钟未收到微信图片结果。请检查公众平台消息推送配置，或让用户重新提交图片。',
    };
  }
  if (status === 'pass') return { label: '通过', accent: '#15803d', note: '' };
  if (status === 'pending') return { label: '检查中', accent: '#d97706', note: '' };
  if (status === 'review') return { label: '需复核', accent: '#b91c1c', note: '' };
  if (status === 'risky') return { label: '风险', accent: '#b91c1c', note: '' };
  return { label: '调用异常', accent: '#b91c1c', note: '' };
}
