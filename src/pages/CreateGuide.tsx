import { useEffect, useMemo, useState } from 'react';
import type React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { readStoredCreatorAuth } from '../lib/authSession';

const API = '/api';
const BG = '#fffdf8';
const INK = '#1f2937';
const GOLD = '#d9a857';
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
  ['creator', '灵契师'],
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
    <main style={{ minHeight: '100vh', background: BG, color: INK }}>
      <section style={{ maxWidth: 920, margin: '0 auto', padding: '22px 18px 60px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 16 }}>
          <Link to="/guides" style={{ color: '#275389', textDecoration: 'none', fontWeight: 850 }}>‹ 返回攻略交易</Link>
          <Link to="/guides/income" style={ghostButton}>创作者收入</Link>
        </div>
        <div style={{ border: '1px solid rgba(201,146,46,0.18)', borderRadius: 18, background: '#fff', padding: 18, boxShadow: '0 18px 48px rgba(31,41,55,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
            <div>
              <p style={{ color: '#925f18', fontWeight: 900, fontSize: '0.76rem', marginBottom: 6 }}>发布攻略</p>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.55rem', marginBottom: 6 }}>把经验写成可购买内容</h1>
              <p style={{ color: MUTED, lineHeight: 1.7, margin: 0, maxWidth: 660 }}>不能上传盗版剧本文本、线索卡、谜底、核心机制复刻或未授权素材。提交后先审核。</p>
            </div>
            <div style={{ color: '#925f18', fontWeight: 900 }}>作者：{auth.display_name || auth.phone || auth.email || '已登录用户'}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(220px, 0.8fr)', gap: 12 }}>
            <div style={{ display: 'grid', gap: 10 }}>
              <input value={form.title} onChange={e => update('title', e.target.value)} placeholder="标题，例如：《琳琅》祝历线不剧透体验建议" style={inputStyle} />
              <textarea value={form.summary} onChange={e => update('summary', e.target.value)} placeholder="摘要：给未购买用户看的介绍，不要在摘要里剧透" style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }} />
              <textarea value={form.content} onChange={e => update('content', e.target.value)} placeholder="正文：至少 80 字。可以写体验建议、妆造清单、出片点、城市路线、成车话术等" style={{ ...inputStyle, minHeight: 220, resize: 'vertical' }} />
            </div>
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
              <input value={form.price} onChange={e => update('price', e.target.value.replace(/[^\d]/g, '').slice(0, 3))} placeholder="价格，0-500 契约币" style={inputStyle} />
              <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', color: MUTED, fontSize: '0.82rem', lineHeight: 1.65 }}>
                <input type="checkbox" checked={form.copyrightConfirmed} onChange={e => update('copyrightConfirmed', e.target.checked)} style={{ marginTop: 4 }} />
                <span>我确认本文为自己的经验输出，不含盗版、谜底、线索卡、未授权素材或侵犯隐私内容。</span>
              </label>
              <div style={{ border: '1px solid rgba(185,28,28,0.16)', background: 'rgba(254,242,242,0.72)', borderRadius: 12, padding: 10, color: '#991b1b', fontSize: '0.78rem', lineHeight: 1.7 }}>
                礼物赞赏不是解锁条件。攻略正文只能通过购买或免费解锁查看。
              </div>
              {message && <p style={{ color: message.includes('失败') || message.includes('错误') ? '#b91c1c' : '#166534', margin: 0 }}>{message}</p>}
              <button type="button" onClick={() => void submit()} disabled={submitting} style={goldButton}>
                {submitting ? '提交中...' : '提交审核'}
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  border: '1px solid rgba(201,146,46,0.22)',
  borderRadius: 12,
  padding: '11px 13px',
  background: 'rgba(255,250,242,0.72)',
  color: INK,
  fontSize: '0.92rem',
};

const goldButton: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '11px 16px',
  borderRadius: 12,
  border: 'none',
  background: `linear-gradient(135deg, ${GOLD}, #c9922e)`,
  color: INK,
  fontWeight: 900,
  textDecoration: 'none',
  cursor: 'pointer',
};

const ghostButton: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '9px 13px',
  borderRadius: 12,
  border: '1px solid rgba(201,146,46,0.24)',
  background: 'rgba(255,255,255,0.72)',
  color: '#925f18',
  fontWeight: 850,
  textDecoration: 'none',
};
