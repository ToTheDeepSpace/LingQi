import { useEffect, useRef, useState } from 'react';
import type React from 'react';

const API = '/api';
const MAX_FILES = 3;
const MAX_SIZE = 8 * 1024 * 1024;

type SelectedFile = { file: File; previewUrl: string };

export default function AffiliationDisputeModal({
  affiliationId,
  title,
  token,
  onClose,
  onSubmitted,
}: {
  affiliationId: string;
  title: string;
  token: string;
  onClose: () => void;
  onSubmitted: (message: string) => void;
}) {
  const [reason, setReason] = useState('');
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrls = useRef(new Set<string>());

  useEffect(() => {
    const urls = previewUrls.current;
    return () => urls.forEach(url => URL.revokeObjectURL(url));
  }, []);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const incoming = Array.from(list);
    if (incoming.some(file => !file.type.startsWith('image/'))) return setError('证据只支持图片截图');
    if (incoming.some(file => file.size > MAX_SIZE)) return setError('每张图片不能超过 8MB');
    const accepted = incoming.slice(0, Math.max(0, MAX_FILES - files.length)).map(file => {
      const previewUrl = URL.createObjectURL(file);
      previewUrls.current.add(previewUrl);
      return { file, previewUrl };
    });
    setFiles(current => [...current, ...accepted]);
    setError('');
    if (inputRef.current) inputRef.current.value = '';
  }

  function removeFile(index: number) {
    setFiles(current => {
      const removed = current[index];
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl);
        previewUrls.current.delete(removed.previewUrl);
      }
      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  }

  async function submit() {
    if (reason.trim().length < 6) return setError('请至少写6个字说明哪里不准确');
    if (files.length < 1) return setError('发起异议必须上传至少1张证据截图');
    if (!confirmed) return setError('请确认异议和证据真实');
    setBusy(true);
    setError('');
    try {
      const body = new FormData();
      body.set('reason', reason.trim());
      body.set('truthConfirmed', 'true');
      files.forEach(item => body.append('evidenceFiles', item.file));
      const response = await fetch(`${API}/lc/dm-affiliations/${encodeURIComponent(affiliationId)}/disputes`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(typeof payload.error === 'string' ? payload.error : payload.error?.message || '异议提交失败');
      onSubmitted(payload.data?.message || '异议和证据已提交');
    } catch (reasonValue) {
      setError(reasonValue instanceof Error ? reasonValue.message : '异议提交失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={overlayStyle} onMouseDown={event => event.target === event.currentTarget && !busy && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby="affiliation-dispute-title" style={modalStyle}>
        <header style={headerStyle}>
          <div><p style={kickerStyle}>任职关系异议</p><h2 id="affiliation-dispute-title" style={{ margin: 0, fontSize: 20 }}>{title}</h2></div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="关闭" style={closeStyle}>×</button>
        </header>
        <div style={{ padding: 18 }}>
          <label style={labelStyle}>异议说明 *</label>
          <textarea value={reason} onChange={event => setReason(event.target.value.slice(0, 800))} rows={4} placeholder="请说明哪部分不准确，以及证据能够证明什么" style={inputStyle} />
          <div style={{ marginTop: 14 }}>
            <label style={labelStyle}>证据截图 *（1–3张，仅管理员可见）</label>
            <input ref={inputRef} type="file" accept="image/*" multiple onChange={event => addFiles(event.target.files)} />
            {files.length > 0 && <div style={previewGridStyle}>{files.map((item, index) => <div key={item.previewUrl} style={{ position: 'relative' }}><img src={item.previewUrl} alt="" style={previewStyle} /><button type="button" onClick={() => removeFile(index)} aria-label="删除证据" style={removeStyle}>×</button></div>)}</div>}
          </div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 14, color: '#475569', fontSize: 13, lineHeight: 1.55 }}>
            <input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} style={{ marginTop: 3 }} />
            我确认异议基于真实情况，提交的证据有权提供；恶意异议会留下账号记录。
          </label>
          {error && <p style={{ margin: '10px 0 0', color: '#b91c1c', fontSize: 13 }}>{error}</p>}
        </div>
        <footer style={footerStyle}><button type="button" onClick={onClose} disabled={busy} style={secondaryStyle}>取消</button><button type="button" onClick={submit} disabled={busy} style={primaryStyle}>{busy ? '提交中…' : '提交异议'}</button></footer>
      </section>
    </div>
  );
}

const overlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18, background: 'rgba(31,41,55,0.48)' };
const modalStyle: React.CSSProperties = { width: 'min(100%, 560px)', maxHeight: '92dvh', overflow: 'auto', borderRadius: 8, background: '#fffdf8', border: '1px solid rgba(31,41,55,0.12)', boxShadow: '0 24px 70px rgba(31,41,55,0.24)' };
const headerStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 12, padding: 18, borderBottom: '1px solid rgba(31,41,55,0.09)' };
const kickerStyle: React.CSSProperties = { margin: '0 0 5px', color: '#a66a1f', fontSize: 12, fontWeight: 900 };
const closeStyle: React.CSSProperties = { width: 32, height: 32, border: 0, background: 'transparent', color: '#64748b', fontSize: 24, cursor: 'pointer' };
const labelStyle: React.CSSProperties = { display: 'block', marginBottom: 7, color: '#475569', fontSize: 12, fontWeight: 850 };
const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid rgba(71,85,105,0.22)', borderRadius: 6, padding: '10px 11px', resize: 'vertical', font: 'inherit', lineHeight: 1.6 };
const previewGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 10 };
const previewStyle: React.CSSProperties = { width: '100%', aspectRatio: '4 / 3', display: 'block', objectFit: 'cover', borderRadius: 6 };
const removeStyle: React.CSSProperties = { position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: 999, border: 0, background: 'rgba(15,23,42,0.76)', color: '#fff', cursor: 'pointer' };
const footerStyle: React.CSSProperties = { display: 'flex', justifyContent: 'flex-end', gap: 8, padding: 14, borderTop: '1px solid rgba(31,41,55,0.09)' };
const secondaryStyle: React.CSSProperties = { border: '1px solid rgba(71,85,105,0.18)', borderRadius: 6, padding: '8px 13px', background: '#fff', color: '#475569', fontWeight: 800, cursor: 'pointer' };
const primaryStyle: React.CSSProperties = { border: 0, borderRadius: 6, padding: '8px 14px', background: '#b91c1c', color: '#fff', fontWeight: 850, cursor: 'pointer' };
