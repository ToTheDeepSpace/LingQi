const INK = '#1f2937';

export const RESPONSIBILITY_TEXT = '互联网不是法外之地。请勿造谣传谣、泄露第三方隐私、冒用他人身份或发布违法违规内容；涉及侵权、诈骗、传谣等情形时，发布者可能承担民事、行政乃至刑事责任。平台会保留必要记录，并依法配合相关机构、权利人或监管单位处理。';

export default function ResponsibilityNotice({ compact = false }: { compact?: boolean }) {
  return (
    <section style={{
      borderRadius: compact ? 12 : 16,
      border: '1px solid rgba(220,38,38,0.2)',
      background: 'rgba(255,247,237,0.86)',
      padding: compact ? '11px 13px' : 16,
      color: '#7c2d12',
      lineHeight: 1.8,
      fontSize: compact ? '0.8rem' : '0.84rem',
      boxShadow: compact ? 'none' : '0 10px 24px rgba(124,45,18,0.04)',
    }}>
      <strong style={{ color: compact ? '#9a3412' : INK }}>发布即负责。</strong>
      <br />
      {RESPONSIBILITY_TEXT}
    </section>
  );
}
