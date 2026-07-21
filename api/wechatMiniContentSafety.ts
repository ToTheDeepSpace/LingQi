export type WechatContentCheckPayload = {
  errcode?: number;
  errmsg?: string;
  result?: {
    suggest?: string;
    label?: number;
  };
  trace_id?: string;
};

export type WechatContentVerdict = {
  allowed: boolean;
  retryable: boolean;
  reason: string;
  label: number | null;
};

export function interpretWechatContentCheck(payload: WechatContentCheckPayload): WechatContentVerdict {
  if (payload.errcode && payload.errcode !== 0) {
    return {
      allowed: false,
      retryable: true,
      reason: payload.errmsg || '微信内容安全服务暂时不可用',
      label: null,
    };
  }

  const suggest = String(payload.result?.suggest || '').toLowerCase();
  const label = Number.isFinite(payload.result?.label) ? Number(payload.result?.label) : null;
  if (suggest === 'pass') return { allowed: true, retryable: false, reason: '', label };
  if (suggest === 'risky') return { allowed: false, retryable: false, reason: '内容安全检查未通过，请修改后重试', label };
  if (suggest === 'review') return { allowed: false, retryable: false, reason: '内容需要进一步核验，请修改后重试', label };
  return { allowed: false, retryable: true, reason: '微信内容安全服务返回异常，请稍后重试', label };
}
