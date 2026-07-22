import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { JumuluCompactHeader, JumuluPageFrame } from '../components/JumuluPageChrome';
import { readStoredCreatorAuth } from '../lib/authSession';

type Restriction = {
  id?: string | null;
  scope: 'publish' | 'account';
  reason: string;
  starts_at?: string | null;
  ends_at?: string | null;
};

type Appeal = {
  id: string;
  content: string;
  evidence_urls?: string[];
  status: 'pending' | 'needs_info' | 'approved' | 'rejected' | 'withdrawn';
  admin_reply?: string | null;
  created_at: string;
};

type Notice = {
  id: string;
  type: string;
  title: string;
  content: string;
  read_at?: string | null;
  created_at: string;
};

type StatusPayload = {
  state: 'active' | 'restricted' | 'merged';
  message: string;
  restriction: Restriction | null;
  appeal: Appeal | null;
  unread_count: number;
};

const INK = '#1f2937';
const MUTED = 'rgba(71,85,105,0.76)';
const LINE = 'rgba(217,168,87,0.24)';

function dateTime(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString('zh-CN', { hour12: false }) : value;
}

function appealStatusLabel(status?: Appeal['status']) {
  if (status === 'pending') return '处理中';
  if (status === 'needs_info') return '待补充';
  if (status === 'approved') return '已通过';
  if (status === 'rejected') return '维持限制';
  return '未提交';
}

export default function AccountStatus() {
  const auth = readStoredCreatorAuth();
  const token = auth?.token || '';
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [content, setContent] = useState('');
  const [evidenceText, setEvidenceText] = useState('');
  const [loading, setLoading] = useState(Boolean(auth?.token));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [statusResponse, noticeResponse] = await Promise.all([
        fetch('/api/lc/account/status', { headers }),
        fetch('/api/lc/account/notifications', { headers }),
      ]);
      const [statusBody, noticeBody] = await Promise.all([statusResponse.json(), noticeResponse.json()]);
      if (!statusResponse.ok || !statusBody.success) throw new Error(statusBody.error || '账号状态加载失败');
      setStatus(statusBody.data);
      if (noticeResponse.ok && noticeBody.success) setNotices(noticeBody.data || []);
      if (statusBody.data?.appeal?.status === 'needs_info') {
        setContent(statusBody.data.appeal.content || '');
        setEvidenceText((statusBody.data.appeal.evidence_urls || []).join('\n'));
      }
      if (statusBody.data?.state === 'merged') {
        localStorage.removeItem('lc_creator');
        localStorage.removeItem('lc_admin_token');
        window.dispatchEvent(new Event('lc-auth-changed'));
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '账号状态加载失败');
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const submitAppeal = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || content.trim().length < 10) return;
    setSubmitting(true);
    setError('');
    try {
      const evidenceUrls = evidenceText.split(/\r?\n/).map(item => item.trim()).filter(Boolean).slice(0, 6);
      const response = await fetch('/api/lc/account/appeals', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim(), evidenceUrls }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || '申诉提交失败');
      setContent('');
      setEvidenceText('');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '申诉提交失败');
    } finally { setSubmitting(false); }
  };

  const markRead = async (id: string) => {
    if (!token) return;
    const response = await fetch(`/api/lc/account/notifications/${encodeURIComponent(id)}/read`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok) setNotices(current => current.map(item => item.id === id ? { ...item, read_at: new Date().toISOString() } : item));
  };

  if (!auth?.token) return (
    <JumuluPageFrame currentLabel="账号状态" maxWidth={900}>
      <JumuluCompactHeader title="账号状态" description="登录后可以查看限制原因、站内通知和申诉处理结果。" />
      <section style={panelStyle}>
        <p style={{ margin: 0, color: MUTED, lineHeight: 1.7 }}>当前没有登录。</p>
        <Link to="/login?redirect=%2Faccount-status" style={primaryLinkStyle}>登录账号</Link>
      </section>
    </JumuluPageFrame>
  );

  return (
    <JumuluPageFrame currentLabel="账号状态" maxWidth={900}>
      <JumuluCompactHeader title="账号状态与申诉" description="限制原因、处理时间和管理员回复都在这里留痕。" />
      {loading && <section style={panelStyle}>正在读取账号状态...</section>}
      {error && <section style={{ ...panelStyle, borderColor: 'rgba(185,28,28,0.24)', color: '#991b1b' }}>{error}</section>}
      {status?.state === 'merged' && (
        <section style={panelStyle}>
          <h2 style={titleStyle}>临时账号已合并</h2>
          <p style={bodyStyle}>{status.message}</p>
          <Link to="/login?redirect=%2Faccount-status" style={primaryLinkStyle}>重新登录原网站账号</Link>
        </section>
      )}
      {status && status.state !== 'merged' && (
        <section style={{ ...panelStyle, borderColor: status.state === 'restricted' ? 'rgba(180,83,9,0.30)' : LINE, background: status.state === 'restricted' ? '#fffaf2' : '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div>
              <div style={{ color: status.state === 'restricted' ? '#925f18' : '#166534', fontSize: 12, fontWeight: 900 }}>{status.state === 'restricted' ? '当前受限' : '状态正常'}</div>
              <h2 style={{ ...titleStyle, marginTop: 5 }}>{status.restriction?.scope === 'account' ? '账号功能限制' : status.restriction ? '发布功能限制' : '账号可以正常使用'}</h2>
            </div>
            {status.restriction && <span style={{ padding: '5px 9px', borderRadius: 6, background: '#fff4e6', color: '#925f18', fontSize: 12, fontWeight: 900 }}>{status.restriction.ends_at ? '限时' : '长期'}</span>}
          </div>
          {status.restriction && (
            <div style={{ display: 'grid', gap: 8, marginTop: 14, color: MUTED, fontSize: 13, lineHeight: 1.65 }}>
              <div><strong style={{ color: INK }}>原因：</strong>{status.restriction.reason}</div>
              <div><strong style={{ color: INK }}>开始：</strong>{dateTime(status.restriction.starts_at) || '未记录'}</div>
              <div><strong style={{ color: INK }}>结束：</strong>{dateTime(status.restriction.ends_at) || '长期有效，等待管理员解除'}</div>
            </div>
          )}
        </section>
      )}

      {status?.state === 'restricted' && (
        <section style={panelStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <h2 style={titleStyle}>账号申诉</h2>
            {status.appeal && <span style={{ color: MUTED, fontSize: 12, fontWeight: 850 }}>{appealStatusLabel(status.appeal.status)}</span>}
          </div>
          {status.appeal?.admin_reply && <div style={replyStyle}><strong>管理员回复：</strong>{status.appeal.admin_reply}</div>}
          {(!status.appeal || status.appeal.status === 'needs_info' || ['approved', 'rejected', 'withdrawn'].includes(status.appeal.status)) && (
            <form onSubmit={submitAppeal} style={{ display: 'grid', gap: 12, marginTop: 14 }}>
              <label style={labelStyle}>申诉说明
                <textarea value={content} onChange={event => setContent(event.target.value)} rows={6} maxLength={2000} placeholder="说明限制可能存在的问题、相关时间和希望如何处理，至少 10 个字。" style={textareaStyle} />
              </label>
              <label style={labelStyle}>补充材料链接（可选，每行一个，最多 6 个）
                <textarea value={evidenceText} onChange={event => setEvidenceText(event.target.value)} rows={3} placeholder="https://..." style={textareaStyle} />
              </label>
              <button type="submit" disabled={submitting || content.trim().length < 10} style={buttonStyle(submitting || content.trim().length < 10)}>{submitting ? '提交中...' : status.appeal?.status === 'needs_info' ? '补充并重新提交' : '提交申诉'}</button>
            </form>
          )}
          {status.appeal?.status === 'pending' && <p style={bodyStyle}>申诉正在处理中。处理结果会出现在下方通知中，不需要重复提交。</p>}
        </section>
      )}

      <section style={panelStyle}>
        <h2 style={titleStyle}>账号通知</h2>
        {notices.length === 0 ? <p style={bodyStyle}>暂无账号治理通知。</p> : (
          <div style={{ display: 'grid', gap: 0, marginTop: 10 }}>
            {notices.map(item => (
              <button key={item.id} type="button" onClick={() => !item.read_at && void markRead(item.id)} style={{ display: 'grid', gap: 4, width: '100%', padding: '12px 0', border: 0, borderTop: '1px solid rgba(31,41,55,0.08)', background: 'transparent', color: INK, textAlign: 'left', cursor: item.read_at ? 'default' : 'pointer' }}>
                <span style={{ fontSize: 13, fontWeight: item.read_at ? 750 : 900 }}>{item.title}{!item.read_at ? ' · 未读' : ''}</span>
                <span style={{ color: MUTED, fontSize: 12, lineHeight: 1.65 }}>{item.content}</span>
                <span style={{ color: 'rgba(71,85,105,0.55)', fontSize: 11 }}>{dateTime(item.created_at)}</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </JumuluPageFrame>
  );
}

const panelStyle: React.CSSProperties = { padding: '16px 18px', border: `1px solid ${LINE}`, borderRadius: 8, background: '#fff', color: INK };
const titleStyle: React.CSSProperties = { margin: 0, color: INK, fontSize: 16, fontWeight: 900 };
const bodyStyle: React.CSSProperties = { margin: '10px 0 0', color: MUTED, fontSize: 13, lineHeight: 1.75 };
const labelStyle: React.CSSProperties = { display: 'grid', gap: 7, color: INK, fontSize: 13, fontWeight: 850 };
const textareaStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', resize: 'vertical', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(31,41,55,0.14)', background: '#fff', color: INK, font: 'inherit', fontWeight: 500, lineHeight: 1.65 };
const replyStyle: React.CSSProperties = { marginTop: 12, padding: '10px 12px', borderRadius: 7, background: '#eff6ff', color: '#275389', fontSize: 13, lineHeight: 1.7 };
const primaryLinkStyle: React.CSSProperties = { display: 'inline-flex', marginTop: 14, minHeight: 36, alignItems: 'center', padding: '0 13px', borderRadius: 7, background: '#1f2937', color: '#fff', fontSize: 13, fontWeight: 900, textDecoration: 'none' };
const buttonStyle = (disabled: boolean): React.CSSProperties => ({ justifySelf: 'start', minHeight: 38, padding: '0 15px', border: 0, borderRadius: 7, background: disabled ? '#e5e7eb' : '#1f2937', color: disabled ? '#94a3b8' : '#fff', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 900 });
