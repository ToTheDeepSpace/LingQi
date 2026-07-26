import { useEffect, useMemo, useState } from 'react';
import type React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import InfoTip from '../components/InfoTip';
import { JumuluCompactHeader, JumuluPageFrame } from '../components/JumuluPageChrome';
import MobileTaskAction from '../components/MobileTaskAction';
import { readStoredCreatorAuth } from '../lib/authSession';
import {
  jumuluCardStyle,
  jumuluPrimaryLinkStyle,
  jumuluSecondaryLinkStyle,
} from '../styles/jumuluPageStyles';

const API = '/api';
const INK = '#1f2937';
const MUTED = 'rgba(71,85,105,0.76)';

const guideTypes = [
  ['script', '选本攻略'],
  ['role', '角色攻略'],
  ['city', '城市攻略'],
  ['carpool', '成车攻略'],
  ['photo', '出片攻略'],
  ['store_dm', '店家 / DM 经验'],
  ['other', '其他攻略'],
];

const targetTypes = [
  ['script', '剧本'],
  ['script_role', '剧本角色'],
  ['dm_role', 'DM / 场控角色'],
  ['store', '店家'],
  ['dm', 'DM / 卡司'],
  ['creator', '服务者'],
  ['city', '城市'],
  ['carpool_leader', '车头'],
  ['other', '其他'],
];

const spoilerLevels = [
  ['none', '无剧透'],
  ['light', '轻剧透'],
  ['heavy', '重剧透'],
  ['played_only', '已玩后可见'],
];

export default function CreateGuide() {
  const navigate = useNavigate();
  const auth = useMemo(() => readStoredCreatorAuth(), []);
  const [form, setForm] = useState({
    title: '',
    summary: '',
    content: '',
    price: '6',
    spoilerLevel: 'none',
    guideType: 'script',
    targetType: 'script',
    targetName: '',
    copyrightConfirmed: false,
  });
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!auth) navigate('/login?redirect=/guides/new');
  }, [auth, navigate]);

  if (!auth) return null;

  const update = (key: keyof typeof form, value: string | boolean) => setForm(prev => ({ ...prev, [key]: value }));

  const submit = async () => {
    setMessage('');
    setSubmitting(true);
    try {
      const r = await fetch(`${API}/lc/guides`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify({
          ...form,
          price: Number(form.price || 0),
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) {
        setMessage(d.error || '提交失败');
        return;
      }
      setMessage('已提交审核，通过后会进入攻略交易页');
      window.setTimeout(() => navigate('/guides'), 900);
    } catch {
      setMessage('网络错误');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <JumuluPageFrame currentLabel="发布攻略" maxWidth={980}>
      <JumuluCompactHeader
        eyebrow="经验内容交易"
        title={<>发布攻略 <InfoTip>不能上传盗版剧本文本、线索卡、谜底、核心机制复刻或未授权素材。提交后先审核。</InfoTip></>}
        description="写清可公开摘要与完整正文，选择绑定对象、剧透范围和解锁价格。"
        aside={<Link to="/guides/income" style={jumuluSecondaryLinkStyle}>创作者收入</Link>}
      />

      <form
        id="guide-create-form"
        className="guide-create-form"
        onSubmit={event => { event.preventDefault(); void submit(); }}
        style={formStyle}
      >
        <div style={authorStyle}>作者：{auth.display_name || auth.phone || auth.email || '已登录用户'}</div>
        <div className="guide-create-grid">
          <section style={editorStyle}>
            <div style={{ display: 'grid', gap: 10 }}>
              <input value={form.title} onChange={e => update('title', e.target.value)} placeholder="标题，例如：《琳琅》祝历线不剧透体验建议" style={inputStyle} />
              <textarea value={form.summary} onChange={e => update('summary', e.target.value)} placeholder="摘要：给未购买用户看的介绍，不要在摘要里剧透" style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }} />
              <textarea value={form.content} onChange={e => update('content', e.target.value)} placeholder="正文：至少 80 字。可以写体验建议、妆造清单、出片点、城市路线、成车话术等" style={{ ...inputStyle, minHeight: 220, resize: 'vertical' }} />
            </div>
          </section>

          <section style={settingsStyle}>
            <div style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
              <select value={form.guideType} onChange={e => update('guideType', e.target.value)} style={inputStyle}>
                {guideTypes.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
              <select value={form.targetType} onChange={e => update('targetType', e.target.value)} style={inputStyle}>
                {targetTypes.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
              <select value={form.spoilerLevel} onChange={e => update('spoilerLevel', e.target.value)} style={inputStyle}>
                {spoilerLevels.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
              <input value={form.targetName} onChange={e => update('targetName', e.target.value)} placeholder="绑定对象：剧本/角色/城市/店家" style={inputStyle} />
              <input value={form.price} onChange={e => update('price', e.target.value.replace(/[^\d]/g, '').slice(0, 3))} placeholder="价格，0-500 榜金" style={inputStyle} />
              <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', color: MUTED, fontSize: '0.82rem', lineHeight: 1.65 }}>
                <input type="checkbox" checked={form.copyrightConfirmed} onChange={e => update('copyrightConfirmed', e.target.checked)} style={{ marginTop: 4 }} />
                <span>我确认本文为自己的经验输出，不含盗版、谜底、线索卡、未授权素材或侵犯隐私内容。</span>
              </label>
              <p style={{ color: '#925f18', fontSize: '0.78rem', fontWeight: 850, display: 'inline-flex', alignItems: 'center', gap: 6, margin: 0 }}>
                交易规则
                <InfoTip>礼物赞赏不是解锁条件。攻略正文只能通过购买或免费解锁查看。</InfoTip>
              </p>
              {message && <p style={{ color: message.includes('失败') || message.includes('错误') ? '#b91c1c' : '#166534', margin: 0 }}>{message}</p>}
              <button type="submit" disabled={submitting} style={{ ...jumuluPrimaryLinkStyle, width: '100%' }}>
                {submitting ? '提交中...' : '提交审核'}
              </button>
            </div>
          </section>
        </div>
      </form>

      <MobileTaskAction label={submitting ? '提交中...' : '提交审核'} form="guide-create-form" disabled={submitting} />
    </JumuluPageFrame>
  );
}

const formStyle: React.CSSProperties = { ...jumuluCardStyle, display: 'grid', gap: 12, padding: 14 };
const authorStyle: React.CSSProperties = { color: '#925f18', fontSize: 12, fontWeight: 850 };
const editorStyle: React.CSSProperties = { minWidth: 0 };
const settingsStyle: React.CSSProperties = { minWidth: 0 };
const inputStyle: React.CSSProperties = {
  boxSizing: 'border-box',
  width: '100%',
  border: '1px solid rgba(31,41,55,0.14)',
  borderRadius: 8,
  padding: '11px 13px',
  background: '#fff',
  color: INK,
  fontSize: '0.92rem',
};
