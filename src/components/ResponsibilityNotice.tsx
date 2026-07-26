export const RESPONSIBILITY_TEXT = '互联网不是法外之地。请勿造谣传谣、泄露第三方隐私、冒用他人身份或发布违法违规内容；涉及侵权、诈骗、传谣等情形时，发布者可能承担民事、行政乃至刑事责任。平台会保留账号、IP、操作时间、操作类型等必要记录，并依法配合相关机构、权利人或监管单位处理。';

export default function ResponsibilityNotice({ compact = false }: { compact?: boolean }) {
  return (
    <details className={`responsibility-notice${compact ? ' is-compact' : ''}`}>
      <summary>
        <strong>发布即负责</strong>
        <span>查看责任说明 <i aria-hidden="true">?</i></span>
      </summary>
      <p>{RESPONSIBILITY_TEXT}</p>
    </details>
  );
}
