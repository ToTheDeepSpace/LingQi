export type SocialPlatform = 'douyin' | 'xiaohongshu' | 'weibo' | 'dianping' | 'other';

const TRAILING_SHARE_PUNCTUATION = /[\s\u3000，。！？；;、）)】\]》>”’'"…]+$/g;
const EMBEDDED_HTTP_URL = /https?:\/\/[^\s\u3000<>“”‘’]+/i;
const BARE_DOMAIN_URL = /(?:^|[\s\u3000])((?:www\.)?[a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s\u3000<>“”‘’]*)?)/i;

export function extractSharedUrl(value: unknown, maxLength = 1000): string {
  if (typeof value !== 'string') return '';
  const raw = value.trim();
  if (!raw) return '';
  const embedded = raw.match(EMBEDDED_HTTP_URL)?.[0];
  const bare = raw.match(BARE_DOMAIN_URL)?.[1];
  const direct = /^(?:https?:\/\/|(?:www\.)?[a-z0-9.-]+\.[a-z]{2,}(?:\/|$))/i.test(raw) ? raw : '';
  const candidate = (embedded || bare || direct).replace(TRAILING_SHARE_PUNCTUATION, '');
  if (!candidate) return '';
  const withProtocol = /^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`;
  try {
    const parsed = new URL(withProtocol);
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    const normalized = parsed.toString();
    return normalized.length <= maxLength ? normalized : '';
  } catch {
    return '';
  }
}

export function detectSocialPlatform(value: string): SocialPlatform {
  const normalized = extractSharedUrl(value) || value;
  try {
    const host = new URL(normalized).hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'douyin.com' || host.endsWith('.douyin.com') || host === 'iesdouyin.com' || host.endsWith('.iesdouyin.com')) return 'douyin';
    if (host === 'xiaohongshu.com' || host.endsWith('.xiaohongshu.com') || host === 'xhslink.com' || host.endsWith('.xhslink.com')) return 'xiaohongshu';
    if (host === 'weibo.com' || host.endsWith('.weibo.com') || host === 'weibo.cn' || host.endsWith('.weibo.cn')) return 'weibo';
    if (host === 'dianping.com' || host.endsWith('.dianping.com')) return 'dianping';
  } catch {
    return 'other';
  }
  return 'other';
}

export function socialPlatformLabel(platform: SocialPlatform) {
  if (platform === 'douyin') return '抖音';
  if (platform === 'xiaohongshu') return '小红书';
  if (platform === 'weibo') return '微博';
  if (platform === 'dianping') return '大众点评';
  return '社交平台';
}
