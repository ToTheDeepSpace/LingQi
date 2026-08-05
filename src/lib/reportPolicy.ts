export const PRIVACY_REPORT_REASON = '侵犯隐私';
export const PRIVACY_REPORT_DETAIL_MIN_LENGTH = 10;

export function privacyReportDetailError(reason: unknown, description: unknown) {
  if (String(reason || '').trim() !== PRIVACY_REPORT_REASON) return '';
  if (String(description || '').trim().length >= PRIVACY_REPORT_DETAIL_MIN_LENGTH) return '';
  return `请选择具体隐私项，并说明它出现在页面、正文或图片的什么位置（至少 ${PRIVACY_REPORT_DETAIL_MIN_LENGTH} 个字）`;
}
