import { useMemo, useState } from 'react';
import DraftAutosaveNotice from './DraftAutosaveNotice';
import { useDraftAutosave } from '../hooks/useDraftAutosave';

export type ReportTargetType = 'carpool' | 'ranking' | 'comment' | 'commission' | 'profile';

const API = '/api';
const INK = '#1f2937';
const MUTED = 'rgba(71,85,105,0.76)';

const REPORT_REASONS = [
  '信息不实/疑似造谣',
  '泄露隐私/未打码',
  '冒用身份',
  '诈骗或违法违规',
  '垃圾广告',
  '其他',
];

type ReportDraft = {
  reason: string;
  description: string;
};

type ReportModerationResult = {
  auto_action?: 'none' | 'temporary_hidden' | 'queued_priority';
  auto_action_reason?: string | null;
  report_group_count?: number;
};

export default function ReportModal({
  targetType,
  targetId,
  targetTitle,
  authToken,
  onClose,
}: {
  targetType: ReportTargetType;
  targetId: string;
  targetTitle: string;
  authToken: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [moderation, setModeration] = useState<ReportModerationResult | null>(null);
  const draftValue = useMemo<ReportDraft>(() => ({ reason, description }), [description, reason]);
  const reportDraft = useDraftAutosave<ReportDraft>({
    key: `lc:draft:report:${targetType}:${targetId}`,
    version: 1,
    enabled: !done,
    value: draftValue,
    shouldSave: data => data.reason !== REPORT_REASONS[0] || !!data.description.trim(),
    onRestore: data => {
      if (REPORT_REASONS.includes(data.reason)) setReason(data.reason);
      setDescription(data.description || '');
    },
  });

  const submit = async () => {
    if (!reason.trim()) return setError('请选择举报原因');
    setSubmitting(true);
    setError('');
    try {
      const r = await fetch(`${API}/lc/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          targetType,
          targetId,
          reason: reason.trim(),
          description: description.trim(),
        }),
      });
      const d = await r.json();
      if (d.success) {
        setModeration(d.data?.moderation || null);
        reportDraft.clearDraft();
        setDone(true);
      }
      else setError(d.error || '举报提交失败');
    } catch {
      setError('网络错误，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(31,41,55,0.48)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 520, borderRadius: 18, border: '1px solid rgba(220,38,38,0.22)', background: '#fffdf8', boxShadow: '0 24px 70px rgba(31,41,55,0.24)', padding: 26 }}>
        {done ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 42, marginBottom: 12 }}>✓</div>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: '1.2rem', marginBottom: 8, color: INK }}>举报已提交</h3>
            <p style={{ color: MUTED, lineHeight: 1.8, marginBottom: 14 }}>
              管理员会按后置治理规则处理。恶意举报也会留下记录。
            </p>
            {moderation?.auto_action === 'temporary_hidden' && (
              <p style={{ color: '#7c2d12', lineHeight: 1.75, margin: '0 0 18px', background: 'rgba(255,247,237,0.92)', border: '1px solid rgba(217,119,6,0.2)', borderRadius: 12, padding: '10px 12px', fontSize: '0.82rem' }}>
                这条内容已因举报进入临时折叠复核。复核期间暂不公开展示，管理员确认后会恢复展示或正式处理。
              </p>
            )}
            {moderation?.auto_action === 'queued_priority' && (
              <p style={{ color: '#854d0e', lineHeight: 1.75, margin: '0 0 18px', background: 'rgba(254,252,232,0.9)', border: '1px solid rgba(202,138,4,0.18)', borderRadius: 12, padding: '10px 12px', fontSize: '0.82rem' }}>
                这条内容已进入优先复核队列，管理员会结合举报理由、证据和历史记录判断。
              </p>
            )}
            <button onClick={onClose} className="btn-gold" style={{ padding: '10px 24px' }}>关闭</button>
          </div>
        ) : (
          <>
            <p style={{ color: '#b91c1c', fontSize: '0.78rem', fontWeight: 900, letterSpacing: '0.04em', marginBottom: 8 }}>举报内容</p>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: '1.18rem', marginBottom: 12, color: INK }}>{targetTitle}</h3>
            <div style={{ marginBottom: 12 }}>
              <DraftAutosaveNotice
                savedAt={reportDraft.savedAt}
                restoredAt={reportDraft.restoredAt}
                error={reportDraft.error}
                note="未提交的举报说明会自动保存到当前浏览器。"
              />
            </div>
            <Label>举报原因 *</Label>
            <select value={reason} onChange={e => setReason(e.target.value)} style={inputStyle}>
              {REPORT_REASONS.map(item => <option key={item}>{item}</option>)}
            </select>
            <div style={{ marginTop: 12 }}>
              <Label>补充说明</Label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={5}
                placeholder="可写清楚哪里不实、涉及谁、有什么证据。"
                style={{ ...inputStyle, resize: 'none', lineHeight: 1.7 }} />
            </div>
            <p style={{ marginTop: 12, color: '#7c2d12', background: 'rgba(255,247,237,0.9)', border: '1px solid rgba(220,38,38,0.14)', borderRadius: 10, padding: '10px 12px', lineHeight: 1.7, fontSize: '0.8rem' }}>
              举报会记录你的账号。请基于事实提交，勿恶意举报或捏造材料。
            </p>
            {error && <p style={{ color: '#b91c1c', fontSize: '0.82rem', marginTop: 10 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button onClick={onClose} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid rgba(217,168,87,0.28)', background: 'transparent', color: MUTED, cursor: 'pointer', fontWeight: 700 }}>取消</button>
              <button onClick={submit} disabled={submitting} style={{ flex: 2, padding: '11px', borderRadius: 10, border: 'none', background: '#b91c1c', color: '#fff', fontWeight: 900, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1 }}>
                {submitting ? '提交中...' : '提交举报'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: '0.78rem', fontWeight: 800, marginBottom: 7, color: 'rgba(71,85,105,0.74)' }}>{children}</p>;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  borderRadius: 11,
  border: '1px solid rgba(217,168,87,0.25)',
  background: '#fff',
  color: INK,
  padding: '10px 12px',
  outline: 'none',
};
