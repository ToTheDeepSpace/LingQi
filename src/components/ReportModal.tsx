import { useEffect, useMemo, useRef, useState } from 'react';
import DraftAutosaveNotice from './DraftAutosaveNotice';
import { useDraftAutosave } from '../hooks/useDraftAutosave';

export type ReportTargetType =
  | 'carpool' | 'ranking' | 'comment' | 'commission' | 'profile'
  | 'dossier' | 'dossier_image' | 'dm_rating' | 'store_rating'
  | 'role_rating' | 'rating_reply' | 'provider_listing' | 'guide'
  | 'service' | 'portfolio' | 'portfolio_image';

const API = '/api';
const INK = '#1f2937';
const MUTED = 'rgba(71,85,105,0.76)';

const REPORT_REASONS = [
  '侵犯隐私',
  '虚假信息',
  '辱骂攻击',
  '诈骗或导流',
  '色情或未成年人',
  '侵权或盗图',
  '其他问题',
];

type ReportDraft = {
  reason: string;
  description: string;
};

export default function ReportModal({
  targetType,
  targetId,
  targetTitle,
  targetSubId,
  authToken,
  onClose,
}: {
  targetType: ReportTargetType;
  targetId: string;
  targetTitle: string;
  targetSubId?: string;
  authToken: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadWarning, setUploadWarning] = useState('');
  const [evidenceFiles, setEvidenceFiles] = useState<Array<{ file: File; preview: string }>>([]);
  const evidencePreviewUrls = useRef<string[]>([]);
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

  useEffect(() => () => {
    evidencePreviewUrls.current.forEach(url => URL.revokeObjectURL(url));
  }, []);

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
          targetSubId: targetSubId || null,
          reason: reason.trim(),
          description: description.trim(),
        }),
      });
      const d = await r.json();
      if (d.success) {
        const reportId = String(d.data?.id || '');
        if (reportId && evidenceFiles.length > 0) {
          setUploading(true);
          try {
            for (const item of evidenceFiles) {
              const body = new FormData();
              body.set('file', item.file);
              const uploadResponse = await fetch(`${API}/lc/reports/${encodeURIComponent(reportId)}/evidence`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${authToken}` },
                body,
              });
              const uploadPayload = await uploadResponse.json();
              if (!uploadResponse.ok || !uploadPayload.success) {
                throw new Error(uploadPayload.error?.message || uploadPayload.error || '证据图片上传失败');
              }
            }
          } catch (uploadError) {
            setUploadWarning(`举报文字已提交，但部分证据图片上传失败：${uploadError instanceof Error ? uploadError.message : '请稍后重新提交补充'}`);
          } finally {
            setUploading(false);
          }
        }
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

  const uploadEvidence = async (files: FileList | null) => {
    if (!files || evidenceFiles.length >= 3) return;
    setError('');
    const nextFiles = Array.from(files).slice(0, 3 - evidenceFiles.length).map(file => {
      const preview = URL.createObjectURL(file);
      evidencePreviewUrls.current.push(preview);
      return { file, preview };
    });
    setEvidenceFiles(current => [...current, ...nextFiles]);
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
            {uploadWarning && <p style={{ color: '#991b1b', lineHeight: 1.65, margin: '0 0 14px', fontSize: '0.82rem' }}>{uploadWarning}</p>}
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
            <div style={{ marginTop: 12 }}>
              <Label>证据图片（选填，最多 3 张）</Label>
              <input type="file" accept="image/*" multiple disabled={uploading || evidenceFiles.length >= 3} onChange={event => void uploadEvidence(event.target.files)} />
              {evidenceFiles.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 8 }}>
                  {evidenceFiles.map((item, index) => (
                    <div key={item.preview} style={{ position: 'relative' }}>
                      <img src={item.preview} alt={`举报材料 ${index + 1}`} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 7 }} />
                      <button type="button" aria-label="移除图片" onClick={() => {
                        URL.revokeObjectURL(item.preview);
                        evidencePreviewUrls.current = evidencePreviewUrls.current.filter(url => url !== item.preview);
                        setEvidenceFiles(current => current.filter(candidate => candidate.preview !== item.preview));
                      }} style={{ position: 'absolute', top: 4, right: 4, width: 25, height: 25, padding: 0, border: 0, borderRadius: '50%', background: 'rgba(31,41,55,.78)', color: '#fff', cursor: 'pointer' }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <p style={{ marginTop: 12, color: '#7c2d12', background: 'rgba(255,247,237,0.9)', border: '1px solid rgba(220,38,38,0.14)', borderRadius: 10, padding: '10px 12px', lineHeight: 1.7, fontSize: '0.8rem' }}>
              举报会记录你的账号并进入管理员队列，不会因单次举报自动删除内容。请勿上传未遮挡的身份证、手机号或无关聊天隐私。
            </p>
            {error && <p style={{ color: '#b91c1c', fontSize: '0.82rem', marginTop: 10 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button onClick={onClose} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid rgba(217,168,87,0.28)', background: 'transparent', color: MUTED, cursor: 'pointer', fontWeight: 700 }}>取消</button>
              <button onClick={submit} disabled={submitting || uploading} style={{ flex: 2, padding: '11px', borderRadius: 10, border: 'none', background: '#b91c1c', color: '#fff', fontWeight: 900, cursor: submitting || uploading ? 'not-allowed' : 'pointer', opacity: submitting || uploading ? 0.6 : 1 }}>
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
