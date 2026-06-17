import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DraftAutosaveNotice from '../components/DraftAutosaveNotice';
import { readStoredCreatorAuth } from '../lib/authSession';
import { useDraftAutosave } from '../hooks/useDraftAutosave';

const API = '/api';
const GOLD = '#d9a857';
const BG = '#fffdf8';
const PANEL = '#fffaf2';
const TEXT = '#1f2937';
const MUTED = 'rgba(71,85,105,0.76)';

function getAuth(): { token: string; displayName: string } | null {
  const data = readStoredCreatorAuth();
  return data?.token ? { token: data.token, displayName: data.display_name || '用户' } : null;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '12px 14px',
  borderRadius: 10,
  border: '1px solid rgba(217,168,87,0.24)',
  background: '#fff',
  color: TEXT,
  outline: 'none',
  fontSize: '0.92rem',
};

type ContactDraft = {
  subject: string;
  content: string;
  contact: string;
};

function shouldSaveContactDraft(data: ContactDraft) {
  return !!(data.subject.trim() || data.content.trim() || data.contact.trim());
}

export default function Contact() {
  const navigate = useNavigate();
  const auth = getAuth();
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [contact, setContact] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const draftValue = useMemo<ContactDraft>(() => ({ subject, content, contact }), [contact, content, subject]);
  const contactDraft = useDraftAutosave<ContactDraft>({
    key: 'lc:draft:contact-message',
    version: 1,
    value: draftValue,
    shouldSave: shouldSaveContactDraft,
    onRestore: data => {
      setSubject(data.subject || '');
      setContent(data.content || '');
      setContact(data.contact || '');
    },
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) {
      navigate('/login');
      return;
    }
    if (!subject.trim() || !content.trim()) {
      setError('请填写标题和内容');
      return;
    }
    setLoading(true);
    setError('');
    setMsg('');
    try {
      const r = await fetch(`${API}/lc/site-messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify({ subject: subject.trim(), content: content.trim(), contact: contact.trim() }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) {
        setError(d.error || '发送失败');
        return;
      }
      contactDraft.clearDraft();
      setSubject('');
      setContent('');
      setContact('');
      setMsg('站内信已发送，管理员会在后台处理。');
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', background: BG, color: TEXT }}>
      <section style={{ background: `linear-gradient(135deg, ${PANEL} 0%, #eef6ff 100%)`, borderBottom: '1px solid rgba(217,168,87,0.18)', padding: '54px 20px 38px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <span style={{ color: GOLD, fontSize: '0.84rem', fontWeight: 900 }}>联系与反馈</span>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: 'clamp(1.8rem, 5vw, 2.7rem)', margin: '18px 0 12px' }}>联系灵契</h1>
          <p style={{ color: MUTED, lineHeight: 1.8, maxWidth: 680 }}>
            账号、充值、发票、举报申诉、隐私请求和合作问题，都可以通过站内信或客服邮箱联系。
          </p>
        </div>
      </section>

      <section style={{ maxWidth: 860, margin: '0 auto', padding: '28px 20px 72px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 18 }}>
        <form onSubmit={submit} style={{ background: '#fff', border: '1px solid rgba(217,168,87,0.22)', borderRadius: 16, padding: 22, boxShadow: '0 14px 34px rgba(31,41,55,0.06)' }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 900, marginBottom: 14 }}>站内信</h2>
          {!auth && (
            <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(239,246,255,0.92)', color: '#275389', fontSize: '0.86rem', lineHeight: 1.7, marginBottom: 16 }}>
              站内信需要登录账号。未登录时也可以直接发送邮件到 basara-twenty@foxmail.com。
            </div>
          )}
          <div style={{ marginBottom: 14 }}>
            <DraftAutosaveNotice
              savedAt={contactDraft.savedAt}
              restoredAt={contactDraft.restoredAt}
              error={contactDraft.error}
              note="未发送的站内信会自动保存到当前浏览器。"
            />
          </div>
          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <label style={{ display: 'block', color: MUTED, fontSize: '0.78rem', fontWeight: 800, marginBottom: 7 }}>标题</label>
              <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="例如：充值未到账 / 黑榜申诉 / 发票申请" maxLength={80} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', color: MUTED, fontSize: '0.78rem', fontWeight: 800, marginBottom: 7 }}>内容</label>
              <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="写清楚账号、页面链接、订单号、发生时间和你希望我们怎么处理。" rows={7} maxLength={2000} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: MUTED, fontSize: '0.78rem', fontWeight: 800, marginBottom: 7 }}>补充联系方式（可选）</label>
              <input value={contact} onChange={e => setContact(e.target.value)} placeholder="邮箱、抖音主页、小红书主页或其他你愿意留下的联系方式" maxLength={300} style={inputStyle} />
            </div>
          </div>
          {error && <p style={{ color: '#b91c1c', fontSize: '0.84rem', marginTop: 14 }}>{error}</p>}
          {msg && <p style={{ color: '#15803d', fontSize: '0.84rem', marginTop: 14 }}>{msg}</p>}
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <Link to="/" style={{ flex: 1, textAlign: 'center', padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(71,85,105,0.16)', color: MUTED, textDecoration: 'none', fontWeight: 800 }}>取消</Link>
            <button type="submit" disabled={loading || !subject.trim() || !content.trim()} style={{
              flex: 2,
              padding: '12px 14px',
              borderRadius: 10,
              border: 'none',
              background: loading || !subject.trim() || !content.trim() ? 'rgba(71,85,105,0.12)' : `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`,
              color: loading || !subject.trim() || !content.trim() ? 'rgba(71,85,105,0.52)' : BG,
              fontWeight: 900,
              cursor: loading || !subject.trim() || !content.trim() ? 'not-allowed' : 'pointer',
            }}>{loading ? '发送中...' : auth ? '发送站内信' : '登录后发送'}</button>
          </div>
        </form>

        <aside style={{ background: '#fff', border: '1px solid rgba(217,168,87,0.18)', borderRadius: 16, padding: 20, alignSelf: 'start' }}>
          <h2 style={{ fontSize: '0.98rem', fontWeight: 900, marginBottom: 12 }}>其他方式</h2>
          <div style={{ display: 'grid', gap: 12, color: MUTED, fontSize: '0.86rem', lineHeight: 1.75 }}>
            <p style={{ margin: 0 }}>客服邮箱：<a href="mailto:basara-twenty@foxmail.com" style={{ color: '#275389', fontWeight: 800, textDecoration: 'none' }}>basara-twenty@foxmail.com</a></p>
            <p style={{ margin: 0 }}>经营主体：<Link to="/business-license" style={{ color: '#275389', fontWeight: 800, textDecoration: 'none' }}>查看营业执照与主体信息</Link></p>
            <p style={{ margin: 0 }}>举报公开内容时，优先使用对应卡片上的“举报”按钮，系统会自动保存目标快照。</p>
            <p style={{ margin: 0 }}>涉及充值、发票、申诉时，请尽量写清楚账号手机号后四位、订单金额、页面链接和时间。</p>
          </div>
        </aside>
      </section>
    </main>
  );
}
