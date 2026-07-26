import type React from 'react';
import InfoTip from './InfoTip';

const GOLD = '#a66a1f';
const MUTED = 'rgba(71,85,105,0.70)';

export default function DraftAutosaveNotice({
  savedAt,
  restoredAt,
  error,
  note = '未提交内容会自动保存到当前浏览器，提交成功后自动清除。',
}: {
  savedAt: number | null;
  restoredAt: number | null;
  error?: string;
  note?: string;
}) {
  if (error) {
    return (
      <div style={noticeStyle('rgba(254,242,242,0.92)', 'rgba(220,38,38,0.22)', '#b91c1c')}>
        {error}
      </div>
    );
  }

  const timestamp = restoredAt ?? savedAt;

  if (!timestamp) {
    return (
      <span style={statusStyle('rgba(239,246,255,0.72)', 'rgba(39,83,137,0.14)', MUTED)}>
        自动保存 <InfoTip label="查看草稿保存说明">{note}</InfoTip>
      </span>
    );
  }

  const time = new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <span style={statusStyle('rgba(255,250,242,0.92)', 'rgba(217,168,87,0.28)', GOLD)}>
      {restoredAt ? `已恢复 ${time}` : `已保存 ${time}`} <InfoTip label="查看草稿保存说明">{note}</InfoTip>
    </span>
  );
}

function noticeStyle(background: string, border: string, color: string): React.CSSProperties {
  return {
    borderRadius: 12,
    border: `1px solid ${border}`,
    background,
    color,
    padding: '9px 12px',
    fontSize: '0.78rem',
    fontWeight: 800,
    lineHeight: 1.6,
  };
}

function statusStyle(background: string, border: string, color: string): React.CSSProperties {
  return {
    minHeight: 26,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    borderRadius: 6,
    border: `1px solid ${border}`,
    background,
    color,
    padding: '0 8px',
    fontSize: 11,
    fontWeight: 800,
    lineHeight: 1.2,
  };
}
