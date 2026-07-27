export type WechatContentCheckPayload = {
  errcode?: number;
  errmsg?: string;
  result?: {
    suggest?: string;
    label?: number;
  };
  trace_id?: string;
};

export const WECHAT_EVENT_SIGNATURE_MAX_AGE_MS = 10 * 60 * 1000;

export function isWechatAccessTokenInvalid(errcode: unknown) {
  return [40001, 40014, 42001].includes(Number(errcode));
}

export function isWechatEventTimestampFresh(
  timestamp: string,
  nowMs = Date.now(),
  maxAgeMs = WECHAT_EVENT_SIGNATURE_MAX_AGE_MS,
) {
  const timestampSeconds = Number(timestamp);
  if (!Number.isInteger(timestampSeconds) || timestampSeconds <= 0) return false;
  return Math.abs(nowMs - timestampSeconds * 1000) <= maxAgeMs;
}

export type WechatContentSuggest = 'pass' | 'review' | 'risky' | 'unknown';

export type WechatContentVerdict = {
  allowed: boolean;
  retryable: boolean;
  reason: string;
  label: number | null;
  suggest: WechatContentSuggest;
  traceId: string | null;
  errcode: number;
};

export function interpretWechatContentCheck(payload: WechatContentCheckPayload): WechatContentVerdict {
  if (payload.errcode && payload.errcode !== 0) {
    return {
      allowed: false,
      retryable: true,
      reason: payload.errmsg || '微信内容安全服务暂时不可用',
      label: null,
      suggest: 'unknown',
      traceId: payload.trace_id || null,
      errcode: payload.errcode,
    };
  }

  const rawSuggest = String(payload.result?.suggest || '').toLowerCase();
  const suggest: WechatContentSuggest = rawSuggest === 'pass' || rawSuggest === 'review' || rawSuggest === 'risky'
    ? rawSuggest
    : 'unknown';
  const label = Number.isFinite(payload.result?.label) ? Number(payload.result?.label) : null;
  const common = {
    label,
    suggest,
    traceId: payload.trace_id || null,
    errcode: Number(payload.errcode || 0),
  };
  if (suggest === 'pass') return { ...common, allowed: true, retryable: false, reason: '' };
  if (suggest === 'risky') return { ...common, allowed: false, retryable: false, reason: '内容安全检查未通过，请修改后重试' };
  if (suggest === 'review') return { ...common, allowed: false, retryable: false, reason: '内容需要进一步核验，请修改后重试' };
  return { ...common, allowed: false, retryable: true, reason: '微信内容安全服务返回异常，请稍后重试' };
}

export type WechatMediaCheckSubmissionPayload = {
  errcode?: number;
  errmsg?: string;
  trace_id?: string;
};

export type WechatMediaSubmission = {
  accepted: boolean;
  retryable: boolean;
  reason: string;
  traceId: string | null;
  errcode: number;
};

export function interpretWechatMediaSubmission(payload: WechatMediaCheckSubmissionPayload): WechatMediaSubmission {
  const errcode = Number(payload.errcode || 0);
  const traceId = payload.trace_id || null;
  if (errcode !== 0 || !traceId) {
    return {
      accepted: false,
      retryable: true,
      reason: payload.errmsg || '微信图片内容安全任务提交失败',
      traceId,
      errcode,
    };
  }
  return { accepted: true, retryable: false, reason: '', traceId, errcode };
}

export type WechatMediaCallbackPayload = {
  Event?: string;
  event?: string;
  appid?: string;
  trace_id?: string;
  errcode?: number;
  errmsg?: string;
  result?: {
    suggest?: string;
    label?: number;
  };
};

export type WechatMediaVerdict = {
  valid: boolean;
  retryable: boolean;
  status: 'pass' | 'review' | 'risky' | 'error';
  reason: string;
  suggest: WechatContentSuggest;
  label: number | null;
  traceId: string | null;
  errcode: number;
};

export function interpretWechatMediaCallback(payload: WechatMediaCallbackPayload): WechatMediaVerdict {
  const event = String(payload.Event || payload.event || '').toLowerCase();
  const traceId = payload.trace_id || null;
  const errcode = Number(payload.errcode || 0);
  if (event !== 'wxa_media_check' || !traceId) {
    return {
      valid: false,
      retryable: false,
      status: 'error',
      reason: '不是有效的微信多媒体安全回调',
      suggest: 'unknown',
      label: null,
      traceId,
      errcode,
    };
  }
  if (errcode !== 0) {
    return {
      valid: true,
      retryable: true,
      status: 'error',
      reason: payload.errmsg || '微信多媒体内容安全检查失败',
      suggest: 'unknown',
      label: null,
      traceId,
      errcode,
    };
  }
  const rawSuggest = String(payload.result?.suggest || '').toLowerCase();
  const suggest: WechatContentSuggest = rawSuggest === 'pass' || rawSuggest === 'review' || rawSuggest === 'risky'
    ? rawSuggest
    : 'unknown';
  const label = Number.isFinite(payload.result?.label) ? Number(payload.result?.label) : null;
  if (suggest === 'pass') {
    return { valid: true, retryable: false, status: 'pass', reason: '', suggest, label, traceId, errcode };
  }
  if (suggest === 'review' || suggest === 'risky') {
    return {
      valid: true,
      retryable: false,
      status: suggest,
      reason: suggest === 'risky' ? '图片内容安全检查未通过' : '图片内容需要进一步核验',
      suggest,
      label,
      traceId,
      errcode,
    };
  }
  return {
    valid: true,
    retryable: true,
    status: 'error',
    reason: '微信多媒体内容安全服务返回异常',
    suggest,
    label,
    traceId,
    errcode,
  };
}

export function wechatSafetySceneNumber(scene: string): 1 | 2 | 3 | 4 {
  const normalized = scene.toLowerCase();
  if (/(profile|dossier|listing|identity|nickname|avatar)/.test(normalized)) return 1;
  if (/(comment|rating|review|reply|application|appeal|report|feedback)/.test(normalized)) return 2;
  if (/(ranking|carpool|commission|forum|post|submit)/.test(normalized)) return 3;
  return 3;
}

export function joinWechatSafetyText(values: unknown[], maxLength = 2500) {
  const combined = values
    .flatMap(value => Array.isArray(value) ? value : [value])
    .map(value => typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '')
    .filter(Boolean)
    .join('\n')
  return Array.from(combined).slice(0, Math.max(0, maxLength)).join('');
}

export function splitWechatSafetyText(values: unknown[], maxLength = 2500) {
  const combined = joinWechatSafetyText(values, Number.MAX_SAFE_INTEGER);
  if (!combined) return [];
  const safeLength = Number.isSafeInteger(maxLength) && maxLength > 0 ? maxLength : 2500;
  const characters = Array.from(combined);
  const chunks: string[] = [];
  for (let offset = 0; offset < characters.length; offset += safeLength) {
    chunks.push(characters.slice(offset, offset + safeLength).join(''));
  }
  return chunks;
}
