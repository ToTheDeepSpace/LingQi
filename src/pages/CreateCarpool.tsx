import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { AuthData } from '../types';
import { CITIES } from '../constants/cities';

const API = '/api';
const C = '#fffdf8';
const GOLD = '#d9a857';
const INK = '#1f2937';
const MUTED = 'rgba(71,85,105,0.76)';

const backLinkStyle: React.CSSProperties = {
  color: 'rgba(39,83,137,0.82)',
  textDecoration: 'none',
  fontSize: '0.86rem',
  fontWeight: 800,
};

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

export default function CreateCarpool() {
  const navigate = useNavigate();
  const [auth] = useState(() => getAuth());
  const [balance, setBalance] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [city, setCity] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('');
  const [scriptName, setScriptName] = useState('');
  const [roleName, setRoleName] = useState('');
  const [roleNote, setRoleNote] = useState('');
  const [neededCount, setNeededCount] = useState(1);
  const [subsidyMode, setSubsidyMode] = useState<'none' | 'asking' | 'offering'>('none');
  const [subsidyAmount, setSubsidyAmount] = useState(0);
  const [subsidyNote, setSubsidyNote] = useState('');
  const [storeName, setStoreName] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [storeSourceUrl, setStoreSourceUrl] = useState('');
  const [storeVerifyNote, setStoreVerifyNote] = useState('');
  const [leaderContact, setLeaderContact] = useState('');
  const [contactNote, setContactNote] = useState('');
  const [content, setContent] = useState('');
  const [boostAmount, setBoostAmount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!auth) { navigate('/login'); return; }
    fetch(`${API}/lc/wallet`, { headers: { Authorization: `Bearer ${auth.token}` } })
      .then(r => r.json())
      .then(d => { if (d.success) setBalance(d.data.balance); })
      .catch(() => setBalance(null));
  }, [auth, navigate]);

  const submit = async () => {
    if (!auth) return navigate('/login');
    if (!city || !eventDate || !deadlineDate || !scriptName.trim() || !leaderContact.trim() || !content.trim()) {
      return setError('请填写城市、日期、截止日期、本名、车头联系方式和拼车说明');
    }
    if (boostAmount > 0 && balance !== null && balance < boostAmount) {
      return setError('契约币不足，请先充值');
    }
    setSubmitting(true);
    setError('');
    try {
      const r = await fetch(`${API}/lc/carpools`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify({
          title: title.trim(),
          city,
          eventDate,
          startTime,
          deadlineDate,
          deadlineTime,
          scriptName: scriptName.trim(),
          roleName: roleName.trim(),
          roleNote: roleNote.trim(),
          neededCount,
          subsidyMode,
          subsidyAmount,
          subsidyNote: subsidyNote.trim(),
          storeName: storeName.trim(),
          storeAddress: storeAddress.trim(),
          storeSourceUrl: storeSourceUrl.trim(),
          storeVerifyNote: storeVerifyNote.trim(),
          leaderContact: leaderContact.trim(),
          contactNote: contactNote.trim(),
          content: content.trim(),
          boostAmount,
        }),
      });
      const d = await r.json();
      if (d.success) navigate('/carpools?submitted=1');
      else setError(typeof d.error === 'string' ? d.error : (d.error?.message || '提交失败'));
    } catch {
      setError('网络错误，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  if (!auth) return null;

  return (
    <div style={{ backgroundColor: C, minHeight: '100vh', color: INK }}>
      <div style={{ background: 'linear-gradient(135deg, #eef6ff, #fffaf2)', borderBottom: '1px solid rgba(201,146,46,0.2)', padding: '32px 20px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'grid', gap: 6 }}>
            <Link to="/carpools" style={backLinkStyle}>← 返回拼车区</Link>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: '1.5rem', marginBottom: 4 }}>发布拼车</h1>
            <p style={{ fontSize: '0.82rem', color: MUTED }}>日期、城市、剧本、角色和现金补贴/票价折扣信息会成为后续 AI 助手的数据基础。</p>
          </div>
          <Link to="/wallet" style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid rgba(201,146,46,0.25)', background: 'rgba(255,255,255,0.78)', color: '#925f18', textDecoration: 'none', fontWeight: 700, fontSize: '0.85rem' }}>
            契约币 {balance ?? '...'}
          </Link>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '34px 20px 80px' }}>
        <div style={{ display: 'grid', gap: 22 }}>
          <Section title="拼车基础">
            <Input label="标题" value={title} onChange={setTitle} placeholder="可不填，系统会用 日期 + 城市 + 本名 自动生成" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
              <Field label="日期 *"><input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} style={inputStyle} /></Field>
              <Field label="时间"><input value={startTime} onChange={e => setStartTime(e.target.value)} placeholder="例：19:30" style={inputStyle} /></Field>
              <Field label="城市 *">
                <select value={city} onChange={e => setCity(e.target.value)} style={inputStyle}>
                  <option value="">选择城市</option>
                  {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
              <Field label="报名截止日期 *"><input type="date" value={deadlineDate} onChange={e => setDeadlineDate(e.target.value)} style={inputStyle} /></Field>
              <Field label="截止时间"><input value={deadlineTime} onChange={e => setDeadlineTime(e.target.value)} placeholder="例：18:00" style={inputStyle} /></Field>
            </div>
            <Input label="本名 *" value={scriptName} onChange={setScriptName} placeholder="例：某某情感本 / 某某沉浸式" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
              <Input label="缺/约的角色" value={roleName} onChange={setRoleName} placeholder="例：姐姐、男A、NPC" />
              <Field label="缺口人数">
                <input type="number" min={1} max={20} value={neededCount} onChange={e => setNeededCount(Number(e.target.value) || 1)} style={inputStyle} />
              </Field>
            </div>
            <Field label="角色补充">
              <textarea value={roleNote} onChange={e => setRoleNote(e.target.value)} rows={3} placeholder="性别、反串、是否可换角色、需要什么风格..." style={{ ...inputStyle, resize: 'none', lineHeight: 1.7 }} />
            </Field>
          </Section>

          <Section title="补贴（现金/票价折扣）与展示">
            <p style={{ color: MUTED, lineHeight: 1.7, fontSize: '0.84rem', marginTop: -4 }}>
              补贴不是契约币。这里记录的是车头/恋陪位给其他玩家位的现金补贴或票价折扣；契约币只用于平台加权展示、发帖、投票等站内动作。
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                ['none', '不写补贴'],
                ['asking', '我想吃补'],
                ['offering', '车头出补'],
              ].map(([key, label]) => (
                <button key={key} onClick={() => setSubsidyMode(key as 'none' | 'asking' | 'offering')}
                  style={{
                    padding: '9px 15px', borderRadius: 999, border: subsidyMode === key ? `1px solid ${GOLD}` : '1px solid rgba(217,168,87,0.2)',
                    background: subsidyMode === key ? 'rgba(217,168,87,0.14)' : '#fff',
                    color: subsidyMode === key ? '#925f18' : MUTED, cursor: 'pointer', fontWeight: 800,
                  }}>{label}</button>
              ))}
            </div>
            {subsidyMode !== 'none' && (
              <>
                <Field label="补贴金额（现金，元；票价折扣可填 0 后写说明）">
                  <input type="number" min={0} value={subsidyAmount} onChange={e => setSubsidyAmount(Number(e.target.value) || 0)} style={inputStyle} />
                </Field>
                <Field label="补贴说明">
                  <textarea value={subsidyNote} onChange={e => setSubsidyNote(e.target.value)} rows={3} placeholder="例：车头补 100 现金 / 免半张票 / 票价八折 / 具体私聊确认" style={{ ...inputStyle, resize: 'none', lineHeight: 1.7 }} />
                </Field>
              </>
            )}
            <Field label={`加权展示 · ${boostAmount} 契约币`}>
              <input type="range" min={0} max={100} step={10} value={boostAmount} onChange={e => setBoostAmount(Number(e.target.value))} style={{ width: '100%', accentColor: GOLD }} />
              <p style={{ marginTop: 6, color: 'rgba(71,85,105,0.66)', fontSize: '0.76rem' }}>不加钱也能发；加权展示会在同筛选条件下更靠前。它是平台排序功能，和拼车现金补贴不是一回事。</p>
            </Field>
          </Section>

          <Section title="店家线索">
            <p style={{ color: MUTED, lineHeight: 1.7, fontSize: '0.84rem', marginTop: -4 }}>
              填了店家信息后，会同步进入后台作为店家线索。后续可用它来创建/验证店家，并和剧司辰店家排期打通。
            </p>
            <Input label="店家名称" value={storeName} onChange={setStoreName} placeholder="例：某某沉浸式剧场" />
            <Input label="店家地址" value={storeAddress} onChange={setStoreAddress} placeholder="可选，城市内具体商圈/地址" />
            <Input label="店家主页/资料链接" value={storeSourceUrl} onChange={setStoreSourceUrl} placeholder="抖音/小红书/地图/公众号链接" />
            <Field label="店家说明">
              <textarea value={storeVerifyNote} onChange={e => setStoreVerifyNote(e.target.value)} rows={3} placeholder="你为什么认为这是这家店？有没有公开资料、联系方式或剧司辰店铺链接？" style={{ ...inputStyle, resize: 'none', lineHeight: 1.7 }} />
            </Field>
          </Section>

          <Section title="拼车说明">
            <Field label="说明 *">
              <textarea value={content} onChange={e => setContent(e.target.value)} rows={7} placeholder="写清楚现在缺什么、适合谁上车、现金补贴或票价折扣、AA/边界、是否可接受换角色。不要公开敏感联系方式。" style={{ ...inputStyle, resize: 'none', lineHeight: 1.8 }} />
            </Field>
            <Input label="车头联系方式 *" value={leaderContact} onChange={setLeaderContact} placeholder="例：站内昵称 / 抖音主页 / 群二维码说明 / 微信需谨慎公开" />
            <Input label="联系补充" value={contactNote} onChange={setContactNote} placeholder="例：先站内申请，确认后再给具体联系方式" />
          </Section>

          {error && <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(254,242,242,0.92)', border: '1px solid rgba(220,38,38,0.24)', color: '#b91c1c', fontSize: '0.85rem' }}>{error}</div>}

          <button onClick={submit} disabled={submitting}
            style={{
              width: '100%', padding: '16px', borderRadius: 14, fontWeight: 900, fontSize: '1rem',
              cursor: submitting ? 'not-allowed' : 'pointer',
              background: submitting ? 'rgba(201,146,46,0.15)' : `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`,
              color: submitting ? 'rgba(201,146,46,0.4)' : INK,
              border: 'none',
            }}>
            {submitting ? '提交中...' : (boostAmount > 0 ? `发布 · 扣 ${boostAmount} 契约币` : '免费发布拼车')}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ display: 'grid', gap: 14, borderRadius: 16, border: '1px solid rgba(217,168,87,0.2)', background: 'rgba(255,255,255,0.78)', padding: 18, boxShadow: '0 12px 30px rgba(31,41,55,0.05)' }}>
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.08rem', fontWeight: 900, margin: 0 }}>{title}</h2>
      {children}
    </section>
  );
}

function Input({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <Field label={label}>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
    </Field>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: '0.8rem', fontWeight: 800, marginBottom: 8, color: 'rgba(71,85,105,0.74)' }}>{label}</p>
      {children}
    </div>
  );
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
