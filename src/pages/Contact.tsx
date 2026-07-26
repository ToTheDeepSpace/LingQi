import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import DraftAutosaveNotice from '../components/DraftAutosaveNotice';
import { JumuluCompactHeader, JumuluPageFrame } from '../components/JumuluPageChrome';
import MobileTaskAction from '../components/MobileTaskAction';
import { readStoredCreatorAuth } from '../lib/authSession';
import { useDraftAutosave } from '../hooks/useDraftAutosave';
import {
  jumuluCardStyle,
  jumuluPrimaryLinkStyle,
  jumuluSecondaryLinkStyle,
} from '../styles/jumuluPageStyles';

const API = '/api';
const TEXT = '#1f2937';
const MUTED = '#64748b';

function getAuth(): { token: string; displayName: string } | null {
  const data = readStoredCreatorAuth();
  return data?.token ? { token: data.token, displayName: data.display_name || '用户' } : null;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '12px 14px',
  borderRadius: 7,
  border: '1px solid rgba(31,41,55,0.12)',
  background: '#fff',
  color: TEXT,
  outline: 'none',
  fontSize: '0.92rem',
};

type ContactDraft = {
  category: string;
  subject: string;
  content: string;
  contact: string;
};

function shouldSaveContactDraft(data: ContactDraft) {
  return !!(data.subject.trim() || data.content.trim() || data.contact.trim() || data.category !== 'suggestion');
}

export default function Contact() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const auth = getAuth();
  const [category, setCategory] = useState(searchParams.get('category') || 'suggestion');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [contact, setContact] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const draftValue = useMemo<ContactDraft>(() => ({ category, subject, content, contact }), [category, contact, content, subject]);
  const contactDraft = useDraftAutosave<ContactDraft>({
    key: 'lc:draft:contact-message',
    version: 2,
    value: draftValue,
    shouldSave: shouldSaveContactDraft,
    onRestore: data => {
      setCategory(data.category || 'suggestion');
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
        body: JSON.stringify({ category, subject: subject.trim(), content: content.trim(), contact: contact.trim() }),
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
    <JumuluPageFrame currentLabel="建议反馈" maxWidth={980}>
      <JumuluCompactHeader
        eyebrow="建议、纠错与申诉"
        title="建议反馈"
        description="提交功能建议、资料纠错、内容申诉、账号问题或合作需求。"
      />

      <section className="contact-page-grid">
        <form id="contact-feedback-form" onSubmit={submit} style={formStyle}>
          <div style={formHeadingStyle}>
            <h2 style={{ fontSize: 17, fontWeight: 900, margin: 0 }}>提交反馈</h2>
            <DraftAutosaveNotice
              savedAt={contactDraft.savedAt}
              restoredAt={contactDraft.restoredAt}
              error={contactDraft.error}
              note="未发送的站内信会自动保存到当前浏览器。"
            />
          </div>
          {!auth && (
            <div style={{ padding: '9px 10px', borderRadius: 7, background: '#eef6ff', color: '#275389', fontSize: 12, lineHeight: 1.55, marginBottom: 12 }}>
              站内信需要登录账号。未登录时也可以直接发送邮件到 basara-twenty@foxmail.com。
            </div>
          )}
          <div style={{ display: 'grid', gap: 10 }}>
            <div className="contact-short-fields">
              <div>
                <label style={labelStyle}>类型</label>
                <select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle}>
                  <option value="suggestion">功能建议</option>
                  <option value="dm_correction">DM资料纠错</option>
                  <option value="appeal">照片 / 身份 / 内容申诉</option>
                  <option value="bug">故障反馈</option>
                  <option value="account">账号问题</option>
                  <option value="cooperation">合作与共建</option>
                  <option value="general">其他</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>标题</label>
                <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="一句话说明问题" maxLength={80} style={inputStyle} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>内容</label>
              <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="写清页面、时间、发生了什么，以及你希望怎么处理。" rows={5} maxLength={2000} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
            <div>
              <label style={labelStyle}>补充联系方式（可选）</label>
              <input value={contact} onChange={e => setContact(e.target.value)} placeholder="邮箱或社交主页" maxLength={300} style={inputStyle} />
            </div>
          </div>
          {error && <p style={{ color: '#b91c1c', fontSize: 13, margin: '10px 0 0' }}>{error}</p>}
          {msg && <p style={{ color: '#15803d', fontSize: 13, margin: '10px 0 0' }}>{msg}</p>}
          <div className="contact-form-actions">
            <Link to="/" style={jumuluSecondaryLinkStyle}>取消</Link>
            <button type="submit" disabled={loading || !subject.trim() || !content.trim()} style={{
              ...jumuluPrimaryLinkStyle,
              minWidth: 150,
              opacity: loading || !subject.trim() || !content.trim() ? 0.5 : 1,
              cursor: loading || !subject.trim() || !content.trim() ? 'not-allowed' : 'pointer',
            }}>{loading ? '发送中...' : auth ? '发送站内信' : '登录后发送'}</button>
          </div>
        </form>

        <aside style={asideStyle}>
          <h2 style={{ fontSize: 16, fontWeight: 900, margin: '0 0 10px' }}>其他方式</h2>
          <div style={{ display: 'grid', gap: 10, color: MUTED, fontSize: 13, lineHeight: 1.6 }}>
            <p style={{ margin: 0 }}>客服邮箱<br /><a href="mailto:basara-twenty@foxmail.com" style={textLinkStyle}>basara-twenty@foxmail.com</a></p>
            <p style={{ margin: 0 }}>经营主体<br /><Link to="/business-license" style={textLinkStyle}>查看营业执照与主体信息</Link></p>
            <p style={{ margin: 0 }}>举报公开内容请优先使用对应卡片上的“举报”，系统会自动保存目标快照。</p>
            <p style={{ margin: 0 }}>充值、发票或申诉请写明账号后四位、订单金额、页面链接和时间。</p>
          </div>
        </aside>
      </section>

      <MobileTaskAction
        form="contact-feedback-form"
        label={loading ? '发送中...' : auth ? '发送站内信' : '登录后发送'}
        disabled={loading || !subject.trim() || !content.trim()}
      />
    </JumuluPageFrame>
  );
}

const formStyle: React.CSSProperties = { ...jumuluCardStyle, minWidth: 0, padding: 16 };
const asideStyle: React.CSSProperties = { ...jumuluCardStyle, minWidth: 0, padding: 14, alignSelf: 'start' };
const formHeadingStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 };
const labelStyle: React.CSSProperties = { display: 'block', color: MUTED, fontSize: 12, fontWeight: 800, marginBottom: 5 };
const textLinkStyle: React.CSSProperties = { color: '#275389', fontWeight: 800, textDecoration: 'none' };
