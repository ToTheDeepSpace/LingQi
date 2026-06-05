import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CITIES } from '../constants/cities';
import type { AuthData, ScriptCatalogItem } from '../types';
import ResponsibilityNotice from '../components/ResponsibilityNotice';

const API = '/api';
const C = '#fffdf8';
const C2 = '#fffaf2';
const GOLD = '#d9a857';
const INK = '#1f2937';
const MUTED = 'rgba(71,85,105,0.76)';

function getAuth(): AuthData | null {
  try {
    const stored = localStorage.getItem('lc_creator');
    if (!stored) return null;
    const data = JSON.parse(stored) as AuthData;
    const payload = JSON.parse(atob(data.token.split('.')[1]));
    if (payload.exp * 1000 < Date.now()) return null;
    return data;
  } catch { return null; }
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 10,
  border: '1px solid rgba(217,168,87,0.28)',
  background: '#fff',
  color: INK,
  boxSizing: 'border-box',
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  color: 'rgba(71,85,105,0.82)',
  fontSize: '0.82rem',
  fontWeight: 800,
  marginBottom: 8,
};

export default function CreateCommission() {
  const navigate = useNavigate();
  const auth = useMemo(() => getAuth(), []);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [scripts, setScripts] = useState<ScriptCatalogItem[]>([]);
  const [scriptId, setScriptId] = useState('');
  const [scriptName, setScriptName] = useState('');
  const [desiredRole, setDesiredRole] = useState('');
  const [targetType, setTargetType] = useState('creator');
  const [neededDate, setNeededDate] = useState('');
  const [city, setCity] = useState('');
  const [location, setLocation] = useState('');
  const [budget, setBudget] = useState('');
  const [contactNote, setContactNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    const loadScripts = async () => {
      try {
        const r = await fetch(`${API}/lc/scripts`);
        const d = await r.json();
        if (alive && d.success) setScripts(d.data || []);
      } catch {
        if (alive) setScripts([]);
      }
    };
    void loadScripts();
    return () => { alive = false; };
  }, []);

  if (!auth) {
    return (
      <div style={{ minHeight: '100vh', background: C, color: INK, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.8rem', marginBottom: 12 }}>请先注册身份</h1>
          <p style={{ color: MUTED, lineHeight: 1.8, marginBottom: 22 }}>发布委托需求需要账号身份，公开展示仍只显示昵称。</p>
          <Link to="/login" className="btn-gold" style={{ padding: '10px 24px', textDecoration: 'none' }}>去登录 / 注册</Link>
        </div>
      </div>
    );
  }

  const submit = async () => {
    if (!title.trim() || !content.trim()) {
      setError('请至少填写标题和需求内容');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const aiAssistContext = {
        reserved: true,
        source: 'manual_form_v1',
        fields_present: {
          script: !!(scriptId || scriptName.trim()),
          neededDate: !!neededDate,
          city: !!city,
          desiredRole: !!desiredRole,
          budget: !!budget,
        },
      };
      const r = await fetch(`${API}/lc/commissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify({
          title, content, scriptId: scriptId || null, scriptName: scriptName.trim() || null, desiredRole, targetType, neededDate, city, location, budget, contactNote, aiAssistContext,
        }),
      });
      const d = await r.json();
      if (d.success) navigate('/commissions?submitted=1');
      else setError(d.error || '提交失败');
    } catch {
      setError('网络错误，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: C, color: INK }}>
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '28px 20px 80px' }}>
        <Link to="/commissions" style={{ color: 'rgba(39,83,137,0.78)', textDecoration: 'none', fontSize: '0.88rem' }}>← 返回委托需求墙</Link>
        <div style={{ marginTop: 24, padding: '28px', borderRadius: 16, background: C2, border: '1px solid rgba(217,168,87,0.22)', boxShadow: '0 18px 48px rgba(31,41,55,0.08)' }}>
          <div className="gold-line" style={{ marginBottom: 16 }} />
          <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: 'clamp(1.6rem, 4vw, 2.3rem)', marginBottom: 8 }}>发布委托需求</h1>
          <p style={{ color: MUTED, lineHeight: 1.8, marginBottom: 22 }}>
            你可以写得很具体，也可以只留一段愿望。内容会先进入人工审核。
          </p>

          <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(217,168,87,0.1)', border: '1px solid rgba(217,168,87,0.24)', color: '#65401c', fontSize: '0.84rem', marginBottom: 22 }}>
            以 <strong style={{ color: '#925f18' }}>{auth.display_name}</strong> 的身份发布。AI 填表助手接口已预留，当前先由你手动填写。
          </div>

          <div style={{ marginBottom: 22 }}>
            <ResponsibilityNotice />
          </div>

          <div style={{ display: 'grid', gap: 16 }}>
            <div>
              <label style={labelStyle}>标题</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="例如：6月1日想约一位能出芙莉莲的灵契师" style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>需求内容</label>
              <textarea value={content} onChange={e => setContent(e.target.value)} rows={7} placeholder="写下你想要的角色、陪伴场景、时间长度、氛围偏好。也可以只写一段愿望。" style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.7 }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              <div>
                <label style={labelStyle}>关联剧本（可选）</label>
                <select value={scriptId} onChange={e => {
                  const id = e.target.value;
                  const selected = scripts.find(script => script.id === id);
                  setScriptId(id);
                  setScriptName(selected?.name || '');
                }} style={inputStyle}>
                  <option value="">暂不指定 / 手动填写</option>
                  {scripts.map(script => <option key={script.id} value={script.id}>{script.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>剧本名补充（可选）</label>
                <input value={scriptName} onChange={e => { setScriptName(e.target.value); setScriptId(''); }} placeholder="剧本库没有时可先手动填" style={inputStyle} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
              <div>
                <label style={labelStyle}>想找谁</label>
                <select value={targetType} onChange={e => setTargetType(e.target.value)} style={inputStyle}>
                  <option value="creator">灵契师</option>
                  <option value="photographer">摄影师</option>
                  <option value="makeup">妆造师</option>
                  <option value="costume">服装商</option>
                  <option value="prop">道具师</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>目标角色（可选）</label>
                <input value={desiredRole} onChange={e => setDesiredRole(e.target.value)} placeholder="角色名 / 类型" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>日期（可选）</label>
                <input type="date" value={neededDate} onChange={e => setNeededDate(e.target.value)} style={inputStyle} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
              <div>
                <label style={labelStyle}>城市（可选）</label>
                <select value={city} onChange={e => setCity(e.target.value)} style={inputStyle}>
                  <option value="">暂不指定</option>
                  {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>地点补充（可选）</label>
                <input value={location} onChange={e => setLocation(e.target.value)} placeholder="如：朝阳区 / 某展会 / 可商量" style={inputStyle} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
              <div>
                <label style={labelStyle}>预算（可选）</label>
                <input value={budget} onChange={e => setBudget(e.target.value)} placeholder="例如：1000-3000 / 可议" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>联系说明（可选）</label>
                <input value={contactNote} onChange={e => setContactNote(e.target.value)} placeholder="例如：先站内沟通 / 需要预约意向金" style={inputStyle} />
              </div>
            </div>
          </div>

          {error && <p style={{ color: '#b91c1c', fontSize: '0.86rem', marginTop: 18 }}>{error}</p>}

          <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
            <button onClick={submit} disabled={submitting}
              style={{ padding: '12px 28px', borderRadius: 10, border: 'none', cursor: submitting ? 'not-allowed' : 'pointer', background: submitting ? 'rgba(241,245,249,0.88)' : `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`, color: submitting ? 'rgba(71,85,105,0.55)' : INK, fontWeight: 900 }}>
              {submitting ? '提交中...' : '提交审核'}
            </button>
            <Link to="/commissions" style={{ padding: '12px 18px', borderRadius: 10, border: '1px solid rgba(217,168,87,0.28)', color: MUTED, textDecoration: 'none', fontWeight: 700 }}>取消</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
