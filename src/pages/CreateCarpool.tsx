import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { AuthData, CarpoolSubsidyType } from '../types';
import { CITIES } from '../constants/cities';
import { formatDetailedSubsidy, generateCarpoolMessage, parseCarpoolMessage } from '../lib/carpoolMessage';
import ResponsibilityNotice from '../components/ResponsibilityNotice';

const API = '/api';
const C = '#fffdf8';
const GOLD = '#d9a857';
const INK = '#1f2937';
const MUTED = 'rgba(71,85,105,0.76)';

const subsidyOptions: { value: CarpoolSubsidyType; label: string }[] = [
  { value: 'none', label: '不写补贴' },
  { value: 'half_price', label: '半价' },
  { value: 'free_ticket', label: '免票' },
  { value: 'discount', label: '折扣' },
  { value: 'a_subsidy', label: 'A补' },
  { value: 'fixed_deduct', label: '减金额' },
  { value: 'custom', label: '自定义' },
];

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

function defaultDeadline(dateText: string) {
  if (!dateText) return '';
  const [year, month, day] = dateText.split('-').map(Number);
  if (!year || !month || !day) return '';
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function modeFromType(type: CarpoolSubsidyType): 'none' | 'asking' | 'offering' {
  if (type === 'none') return 'none';
  if (type === 'a_subsidy') return 'asking';
  return 'offering';
}

export default function CreateCarpool() {
  const navigate = useNavigate();
  const [auth] = useState(() => getAuth());
  const [balance, setBalance] = useState<number | null>(null);
  const [rawMessage, setRawMessage] = useState('');
  const [generatedMessage, setGeneratedMessage] = useState('');
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [copyMsg, setCopyMsg] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [title, setTitle] = useState('');
  const [city, setCity] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [dateExpired, setDateExpired] = useState(false);
  const [startTime, setStartTime] = useState('');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('18:00');
  const [scriptName, setScriptName] = useState('');
  const [roleName, setRoleName] = useState('');
  const [roleNote, setRoleNote] = useState('');
  const [neededCount, setNeededCount] = useState(1);
  const [subsidyType, setSubsidyType] = useState<CarpoolSubsidyType>('none');
  const [subsidyAmount, setSubsidyAmount] = useState(0);
  const [subsidyDiscount, setSubsidyDiscount] = useState('');
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

  const currentGeneratedMessage = useMemo(() => generateCarpoolMessage({
    eventDate,
    startTime,
    city,
    scriptName,
    roleName,
    neededCount,
    subsidyType,
    subsidyAmount,
    subsidyDiscount: subsidyDiscount ? Number(subsidyDiscount) : null,
    subsidyNote,
    deadlineDate,
    deadlineTime,
    leaderContact,
    content,
  }), [city, content, deadlineDate, deadlineTime, eventDate, leaderContact, neededCount, roleName, scriptName, startTime, subsidyAmount, subsidyDiscount, subsidyNote, subsidyType]);

  const applyParsed = () => {
    if (!rawMessage.trim()) {
      setParseWarnings(['先粘贴一段车头消息。']);
      return;
    }
    const parsed = parseCarpoolMessage(rawMessage);
    setParseWarnings(parsed.warnings);
    setDateExpired(parsed.dateExpired);
    if (parsed.eventDate) {
      setEventDate(parsed.eventDate);
      if (!deadlineDate) setDeadlineDate(defaultDeadline(parsed.eventDate));
    } else if (parsed.dateExpired) {
      setEventDate('');
    }
    if (parsed.startTime) setStartTime(parsed.startTime);
    if (parsed.scriptName) setScriptName(parsed.scriptName);
    if (parsed.roleName) setRoleName(parsed.roleName);
    if (parsed.roleNote) setRoleNote(parsed.roleNote);
    setSubsidyType(parsed.subsidyType);
    setSubsidyAmount(parsed.subsidyAmount);
    setSubsidyDiscount(parsed.subsidyDiscount ? String(parsed.subsidyDiscount) : '');
    setSubsidyNote(parsed.subsidyNote);
    if (parsed.leaderContact) setLeaderContact(parsed.leaderContact);
    if (parsed.content) setContent(parsed.content);
    if (parsed.title) setTitle(parsed.title);
    const message = generateCarpoolMessage({
      eventDate: parsed.eventDate || '',
      startTime: parsed.startTime,
      city,
      scriptName: parsed.scriptName || '',
      roleName: parsed.roleName,
      neededCount,
      subsidyType: parsed.subsidyType,
      subsidyAmount: parsed.subsidyAmount,
      subsidyDiscount: parsed.subsidyDiscount,
      subsidyNote: parsed.subsidyNote,
      deadlineDate: parsed.eventDate ? (deadlineDate || defaultDeadline(parsed.eventDate)) : '',
      deadlineTime,
      leaderContact: parsed.leaderContact || leaderContact,
      content: parsed.content,
    });
    setGeneratedMessage(message);
  };

  const refreshGenerated = () => {
    setGeneratedMessage(currentGeneratedMessage);
    setCopyMsg('已生成，可复制到微信。');
  };

  const copyGenerated = async () => {
    const text = generatedMessage || currentGeneratedMessage;
    if (!text.trim()) {
      setCopyMsg('先生成一段拼车消息。');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopyMsg('已复制。');
    } catch {
      setCopyMsg('复制失败，可以手动选中文案复制。');
    }
  };

  const submit = async () => {
    if (!auth) return navigate('/login');
    if (dateExpired || !eventDate) return setError('日期已过期或未确认，请手动选择有效日期');
    if (!city || !deadlineDate || !scriptName.trim() || !leaderContact.trim()) {
      return setError('请填写城市、报名截止日期、本名和车头微信');
    }
    const finalContent = content.trim() || currentGeneratedMessage.replace(/联系：.+$/m, '').trim();
    if (!finalContent) return setError('请填写公开说明，联系方式不会公开展示');
    if (boostAmount > 0 && balance !== null && balance < boostAmount) {
      return setError('契约币不足，请先充值');
    }
    setSubmitting(true);
    setError('');
    try {
      const subsidyMode = modeFromType(subsidyType);
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
          subsidyType,
          subsidyAmount,
          subsidyDiscount: subsidyDiscount ? Number(subsidyDiscount) : null,
          subsidyNote: subsidyNote.trim(),
          storeName: storeName.trim(),
          storeAddress: storeAddress.trim(),
          storeSourceUrl: storeSourceUrl.trim(),
          storeVerifyNote: storeVerifyNote.trim(),
          leaderContact: leaderContact.trim(),
          contactNote: contactNote.trim(),
          content: finalContent,
          rawMessage: rawMessage.trim(),
          generatedMessage: (generatedMessage || currentGeneratedMessage).trim(),
          boostAmount,
        }),
      });
      const d = await r.json();
      if (d.success) navigate('/carpools?published=1');
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
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'grid', gap: 6 }}>
            <Link to="/carpools" style={backLinkStyle}>← 返回拼车区</Link>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: '1.55rem', marginBottom: 4 }}>车头消息工作台</h1>
            <p style={{ fontSize: '0.84rem', color: MUTED }}>粘贴车头姐原话，先生成能发群的消息，再沉淀成拼车数据。</p>
          </div>
          <Link to="/wallet" style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid rgba(201,146,46,0.25)', background: 'rgba(255,255,255,0.78)', color: '#925f18', textDecoration: 'none', fontWeight: 700, fontSize: '0.85rem' }}>
            契约币 {balance ?? '...'}
          </Link>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '30px 20px 80px' }}>
        <div style={{ display: 'grid', gap: 18 }}>
          <section style={heroCardStyle}>
            <Field label="粘贴车头消息">
              <textarea
                value={rawMessage}
                onChange={e => setRawMessage(e.target.value)}
                rows={7}
                placeholder={'例：🚗6.14 晚场 无限x琳琅=祝魇cp（各半价）\n也可以直接写你想发到群里的拼车消息。'}
                style={{ ...inputStyle, resize: 'vertical', minHeight: 150, lineHeight: 1.75 }}
              />
            </Field>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={applyParsed} style={secondaryButtonStyle}>解析拼车消息</button>
              <button onClick={refreshGenerated} style={secondaryButtonStyle}>生成可转发消息</button>
              <button onClick={() => void copyGenerated()} className="btn-gold" style={{ padding: '10px 18px' }}>复制消息</button>
            </div>
            {(parseWarnings.length > 0 || copyMsg) && (
              <div style={{ display: 'grid', gap: 6 }}>
                {parseWarnings.map(item => <p key={item} style={warningStyle}>{item}</p>)}
                {copyMsg && <p style={{ color: '#166534', fontSize: '0.8rem', fontWeight: 800 }}>{copyMsg}</p>}
              </div>
            )}
          </section>

          <ResponsibilityNotice />

          <section style={heroCardStyle}>
            <h2 style={sectionTitleStyle}>确认四个关键信息</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <Field label="日期 *"><input type="date" value={eventDate} onChange={e => { setEventDate(e.target.value); setDateExpired(false); if (!deadlineDate) setDeadlineDate(defaultDeadline(e.target.value)); }} style={inputStyle} /></Field>
              <Field label="城市 *">
                <select value={city} onChange={e => setCity(e.target.value)} style={inputStyle}>
                  <option value="">选择城市</option>
                  {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Input label="本名 *" value={scriptName} onChange={setScriptName} placeholder="例：琳琅 / 无限x琳琅" />
              <Input label="车头微信 *" value={leaderContact} onChange={setLeaderContact} placeholder="登录后才给用户查看" />
            </div>
            {dateExpired && <p style={warningStyle}>这条消息里的日期已经过了。请确认它仍有效，并手动选择新的有效日期。</p>}
          </section>

          <section style={heroCardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <h2 style={sectionTitleStyle}>生成结果</h2>
              <span style={{ color: '#925f18', fontWeight: 900, fontSize: '0.82rem' }}>{formatDetailedSubsidy({ subsidy_type: subsidyType, subsidy_amount: subsidyAmount, subsidy_discount: subsidyDiscount ? Number(subsidyDiscount) : null, subsidy_note: subsidyNote })}</span>
            </div>
            <Field label="可转发拼车消息">
              <textarea
                value={generatedMessage || currentGeneratedMessage}
                onChange={e => setGeneratedMessage(e.target.value)}
                rows={7}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.75, background: '#fffaf2' }}
              />
            </Field>
            <Field label="公开说明（不公开车头微信）">
              <textarea value={content} onChange={e => setContent(e.target.value)} rows={5} placeholder="除了日期、本名、角色、补贴之外的介绍信息写在这里；联系方式不要写进公开说明。" style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.75 }} />
            </Field>
          </section>

          <button onClick={() => setShowMore(!showMore)} style={{ ...secondaryButtonStyle, justifySelf: 'start' }}>
            {showMore ? '收起更多设置' : '展开更多设置'}
          </button>

          {showMore && (
            <div style={{ display: 'grid', gap: 18 }}>
              <Section title="角色与时间">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
                  <Input label="标题" value={title} onChange={setTitle} placeholder="可不填，系统自动生成" />
                  <Input label="时间" value={startTime} onChange={setStartTime} placeholder="例：19:30" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
                  <Field label="报名截止日期 *"><input type="date" value={deadlineDate} onChange={e => setDeadlineDate(e.target.value)} style={inputStyle} /></Field>
                  <Input label="截止时间" value={deadlineTime} onChange={setDeadlineTime} placeholder="例：18:00" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
                  <Input label="缺/约的角色" value={roleName} onChange={setRoleName} placeholder="例：祝魇cp / 祁江" />
                  <Field label="缺口人数">
                    <input type="number" min={1} max={20} value={neededCount} onChange={e => setNeededCount(Number(e.target.value) || 1)} style={inputStyle} />
                  </Field>
                </div>
                <Field label="角色补充">
                  <textarea value={roleNote} onChange={e => setRoleNote(e.target.value)} rows={3} placeholder="性别、反串、是否可换角色、需要什么风格..." style={{ ...inputStyle, resize: 'none', lineHeight: 1.7 }} />
                </Field>
              </Section>

              <Section title="补贴与展示">
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {subsidyOptions.map(item => (
                    <button key={item.value} onClick={() => setSubsidyType(item.value)}
                      style={{
                        padding: '9px 15px', borderRadius: 999, border: subsidyType === item.value ? `1px solid ${GOLD}` : '1px solid rgba(217,168,87,0.2)',
                        background: subsidyType === item.value ? 'rgba(217,168,87,0.14)' : '#fff',
                        color: subsidyType === item.value ? '#925f18' : MUTED, cursor: 'pointer', fontWeight: 800,
                      }}>{item.label}</button>
                  ))}
                </div>
                {subsidyType !== 'none' && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
                      {(subsidyType === 'a_subsidy' || subsidyType === 'fixed_deduct') && (
                        <Field label="金额">
                          <input type="number" min={0} value={subsidyAmount} onChange={e => setSubsidyAmount(Number(e.target.value) || 0)} style={inputStyle} />
                        </Field>
                      )}
                      {subsidyType === 'discount' && (
                        <Input label="折扣" value={subsidyDiscount} onChange={setSubsidyDiscount} placeholder="例：8.5" />
                      )}
                    </div>
                    <Field label="补贴原话">
                      <input value={subsidyNote} onChange={e => setSubsidyNote(e.target.value)} placeholder="例：各半价 / A补50 / 补100 / 免票" style={inputStyle} />
                    </Field>
                  </>
                )}
                <Field label={`加权展示 · ${boostAmount} 契约币`}>
                  <input type="range" min={0} max={100} step={10} value={boostAmount} onChange={e => setBoostAmount(Number(e.target.value))} style={{ width: '100%', accentColor: GOLD }} />
                  <p style={{ marginTop: 6, color: 'rgba(71,85,105,0.66)', fontSize: '0.76rem' }}>加权展示是平台排序功能，和拼车现金补贴不是一回事。</p>
                </Field>
              </Section>

              <Section title="店家线索">
                <Input label="店家名称" value={storeName} onChange={setStoreName} placeholder="例：某某沉浸式剧场" />
                <Input label="店家地址" value={storeAddress} onChange={setStoreAddress} placeholder="可选，城市内具体商圈/地址" />
                <Input label="店家主页/资料链接" value={storeSourceUrl} onChange={setStoreSourceUrl} placeholder="抖音/小红书/地图/公众号链接" />
                <Field label="店家说明">
                  <textarea value={storeVerifyNote} onChange={e => setStoreVerifyNote(e.target.value)} rows={3} placeholder="你为什么认为这是这家店？有没有公开资料或剧司辰店铺链接？" style={{ ...inputStyle, resize: 'none', lineHeight: 1.7 }} />
                </Field>
              </Section>

              <Section title="联系补充">
                <Input label="联系补充" value={contactNote} onChange={setContactNote} placeholder="例：加微信备注灵契拼车 / 先站内申请" />
              </Section>
            </div>
          )}

          {error && <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(254,242,242,0.92)', border: '1px solid rgba(220,38,38,0.24)', color: '#b91c1c', fontSize: '0.85rem' }}>{error}</div>}

          <button onClick={submit} disabled={submitting}
            style={{
              width: '100%', padding: '16px', borderRadius: 14, fontWeight: 900, fontSize: '1rem',
              cursor: submitting ? 'not-allowed' : 'pointer',
              background: submitting ? 'rgba(201,146,46,0.15)' : `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`,
              color: submitting ? 'rgba(201,146,46,0.4)' : INK,
              border: 'none',
            }}>
            {submitting ? '发布中...' : (boostAmount > 0 ? `发布拼车 · 扣 ${boostAmount} 契约币` : '发布拼车')}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ display: 'grid', gap: 14, borderRadius: 16, border: '1px solid rgba(217,168,87,0.2)', background: 'rgba(255,255,255,0.78)', padding: 18, boxShadow: '0 12px 30px rgba(31,41,55,0.05)' }}>
      <h2 style={sectionTitleStyle}>{title}</h2>
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

const heroCardStyle: React.CSSProperties = {
  display: 'grid',
  gap: 14,
  borderRadius: 18,
  border: '1px solid rgba(217,168,87,0.22)',
  background: 'rgba(255,255,255,0.82)',
  padding: 18,
  boxShadow: '0 14px 36px rgba(31,41,55,0.06)',
};

const sectionTitleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-serif)',
  fontSize: '1.08rem',
  fontWeight: 900,
  margin: 0,
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: '10px 16px',
  borderRadius: 10,
  border: '1px solid rgba(217,168,87,0.28)',
  background: '#fff',
  color: '#925f18',
  cursor: 'pointer',
  fontWeight: 900,
};

const warningStyle: React.CSSProperties = {
  color: '#b45309',
  background: 'rgba(254,243,199,0.72)',
  border: '1px solid rgba(245,158,11,0.22)',
  borderRadius: 10,
  padding: '9px 12px',
  fontSize: '0.8rem',
  fontWeight: 800,
};

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
