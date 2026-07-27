export const WECHAT_IMAGE_CALLBACK_STALE_MS = 35 * 60 * 1000;
export type WechatSafetyFilter = 'attention' | 'pending' | 'pass' | 'all';
export type WechatSafetySummaryItem = {
  status: 'pending' | 'pass' | 'review' | 'risky' | 'error';
  check_type: 'text' | 'image';
  created_at?: string | null;
  checked_at?: string | null;
  updated_at?: string | null;
};

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

export function wechatSafetyMatchesFilter(
  status: 'pending' | 'pass' | 'review' | 'risky' | 'error',
  checkType: 'text' | 'image',
  createdAt: string | null | undefined,
  filter: WechatSafetyFilter,
  nowMs = Date.now(),
) {
  if (filter === 'all') return true;
  if (filter === 'pass') return status === 'pass';
  const presentation = wechatSafetyStatusPresentation(status, checkType, createdAt, nowMs);
  if (filter === 'pending') return presentation.label === '检查中';
  return presentation.label === '回调超时'
    || status === 'review'
    || status === 'risky'
    || status === 'error';
}

export function summarizeWechatSafety(
  items: WechatSafetySummaryItem[],
  nowMs = Date.now(),
) {
  let latestAt: string | null = null;
  let latestAtMs = Number.NEGATIVE_INFINITY;
  let textPassed = 0;
  let imagePassed = 0;
  let pending = 0;
  let attention = 0;

  for (const item of items) {
    if (item.status === 'pass' && item.check_type === 'text') textPassed += 1;
    if (item.status === 'pass' && item.check_type === 'image') imagePassed += 1;
    if (wechatSafetyMatchesFilter(item.status, item.check_type, item.created_at, 'pending', nowMs)) pending += 1;
    if (wechatSafetyMatchesFilter(item.status, item.check_type, item.created_at, 'attention', nowMs)) attention += 1;
    const activityAt = item.checked_at || item.updated_at || item.created_at || null;
    const activityAtMs = Date.parse(String(activityAt || ''));
    if (Number.isFinite(activityAtMs) && activityAtMs > latestAtMs) {
      latestAtMs = activityAtMs;
      latestAt = activityAt;
    }
  }

  return {
    total: items.length,
    textPassed,
    imagePassed,
    pending,
    attention,
    latestAt,
  };
}
