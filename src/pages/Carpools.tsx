import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { AuthData, Carpool, CarpoolApplication } from '../types';
import { CITIES } from '../constants/cities';
import { getJsonCached } from '../lib/apiCache';

const API = '/api';
const C = '#fffdf8';
const C2 = '#eef6ff';
const GOLD = '#d9a857';
const INK = '#1f2937';
const MUTED = 'rgba(71,85,105,0.76)';

const SUBSIDY_LABEL: Record<string, string> = {
  none: '无补贴',
  asking: '吃补',
  offering: '出补',
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

export default function Carpools() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState<Carpool[]>([]);
  const [myItems, setMyItems] = useState<Carpool[]>([]);
  const [sentApplications, setSentApplications] = useState<{ id: string; carpool_id: string; status: string }[]>([]);
  const [receivedApplications, setReceivedApplications] = useState<CarpoolApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [city, setCity] = useState('all');
  const [date, setDate] = useState('');
  const [script, setScript] = useState('');
  const [cityOpen, setCityOpen] = useState(false);
  const [applyModal, setApplyModal] = useState<Carpool | null>(null);
  const [applyRole, setApplyRole] = useState('');
  const [applyMessage, setApplyMessage] = useState('');
  const [applyError, setApplyError] = useState('');
  const [applyDone, setApplyDone] = useState(false);
  const [submittingApply, setSubmittingApply] = useState(false);
  const submitted = searchParams.get('submitted') === '1';

  const loadPublic = useMemo(() => async () => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams();
      if (city !== 'all') qs.set('city', city);
      if (date) qs.set('date', date);
      if (script.trim()) qs.set('script', script.trim());
      const { data: d } = await getJsonCached<{ success: boolean; data?: Carpool[]; error?: string }>(
        `${API}/lc/carpools?${qs.toString()}`,
        undefined,
        15_000,
      );
      if (d.success) setItems(d.data || []);
      else setError(d.error || '加载失败');
    } catch {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  }, [city, date, script]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadPublic(), 0);
    return () => window.clearTimeout(timer);
  }, [loadPublic]);

  useEffect(() => {
    const auth = getAuth();
    if (!auth) return;
    const headers = { Authorization: `Bearer ${auth.token}` };
    Promise.all([
      fetch(`${API}/lc/carpools/mine`, { headers }).then(r => r.json()),
      fetch(`${API}/lc/carpools/applications/sent`, { headers }).then(r => r.json()),
      fetch(`${API}/lc/carpools/applications/received`, { headers }).then(r => r.json()),
    ]).then(([mine, sent, received]) => {
      if (mine.success) setMyItems(mine.data || []);
      if (sent.success) setSentApplications(sent.data || []);
      if (received.success) setReceivedApplications(received.data || []);
    }).catch(() => {
      setMyItems([]);
      setSentApplications([]);
      setReceivedApplications([]);
    });
  }, []);

  const privateItems = myItems.filter(item => item.status !== 'approved');
  const sentIds = useMemo(() => new Set(sentApplications.map(item => item.carpool_id)), [sentApplications]);

  const openApply = (item: Carpool) => {
    const auth = getAuth();
    if (!auth) return navigate('/login');
    setApplyModal(item);
    setApplyRole(item.role_name || '');
    setApplyMessage('');
    setApplyError('');
    setApplyDone(false);
  };

  const closeApply = () => {
    setApplyModal(null);
    setApplyRole('');
    setApplyMessage('');
    setApplyError('');
    setApplyDone(false);
    setSubmittingApply(false);
  };

  const submitApply = async () => {
    if (!applyModal) return;
    const auth = getAuth();
    if (!auth) return navigate('/login');
    if (!applyMessage.trim()) return setApplyError('请写一段上车申请');
    setSubmittingApply(true);
    setApplyError('');
    try {
      const r = await fetch(`${API}/lc/carpools/${applyModal.id}/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify({ roleName: applyRole.trim(), message: applyMessage.trim() }),
      });
      const d = await r.json();
      if (d.success) {
        setSentApplications(prev => [{ id: d.data.id, carpool_id: applyModal.id, status: 'submitted' }, ...prev]);
        setApplyDone(true);
      } else {
        setApplyError(d.error || '提交失败');
      }
    } catch {
      setApplyError('网络错误，请重试');
    } finally {
      setSubmittingApply(false);
    }
  };

  return (
    <div style={{ backgroundColor: C, minHeight: '100vh', color: INK }}>
      <div style={{ background: `radial-gradient(circle at 18% 0%, rgba(217,168,87,0.16), transparent 34%), linear-gradient(135deg, ${C2}, #fffaf2)`, borderBottom: '1px solid rgba(201,146,46,0.2)', padding: '52px 20px 42px' }}>
        <div style={{ maxWidth: 1060, margin: '0 auto' }}>
          <div className="gold-line" style={{ marginBottom: 16 }} />
          <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: 'clamp(1.8rem, 4vw, 2.7rem)', marginBottom: 10 }}>拼车区</h1>
          <p style={{ color: MUTED, fontSize: '1rem', lineHeight: 1.8, maxWidth: 720 }}>
            情感本、演绎本、缺角色、缺搭子、缺补贴，都先丢到这里。每条拼车会沉淀城市、日期、剧本、角色和补贴数据，后面直接接剧司辰拼车日历。
          </p>
          <div style={{ marginTop: 22, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link to="/carpools/new" className="btn-gold" style={{ padding: '10px 22px', textDecoration: 'none', fontSize: '0.92rem' }}>发布拼车</Link>
            <Link to="/rankings" style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid rgba(217,168,87,0.32)', color: '#925f18', background: 'rgba(255,255,255,0.72)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 700 }}>看看红黑榜</Link>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1060, margin: '0 auto', padding: '28px 20px 80px' }}>
        {submitted && (
          <div style={{ marginBottom: 18, borderRadius: 12, border: '1px solid rgba(217,168,87,0.28)', background: 'rgba(217,168,87,0.12)', padding: '14px 16px', color: '#65401c', lineHeight: 1.7 }}>
            拼车已提交，正在等待人工审核。审核通过后会进入拼车区；如果你填了店家信息，它会同时成为店家线索。
          </div>
        )}

        {privateItems.length > 0 && (
          <section style={{ marginBottom: 24, borderRadius: 16, border: '1px solid rgba(217,168,87,0.2)', background: 'rgba(255,250,242,0.86)', padding: 18 }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.15rem', fontWeight: 900, marginBottom: 12 }}>我的拼车进度</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {privateItems.map(item => <CarpoolCard key={item.id} item={item} showStatus />)}
            </div>
          </section>
        )}

        {receivedApplications.length > 0 && (
          <section style={{ marginBottom: 24, borderRadius: 16, border: '1px solid rgba(59,130,246,0.2)', background: 'rgba(239,246,255,0.8)', padding: 18 }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.15rem', fontWeight: 900, marginBottom: 12 }}>收到的上车申请</h2>
            <div style={{ display: 'grid', gap: 10 }}>
              {receivedApplications.map(app => (
                <article key={app.id} style={{ borderRadius: 12, background: '#fff', border: '1px solid rgba(59,130,246,0.16)', padding: 14 }}>
                  <Meta>{app.carpool?.title || '未知拼车'} · {app.created_at?.slice(0, 10)}</Meta>
                  <h3 style={{ fontWeight: 900, fontSize: '0.98rem', margin: '6px 0', color: '#275389' }}>{app.applicant_is_realname ? '⭐ ' : ''}{app.applicant_name}{app.role_name ? ` · ${app.role_name}` : ''}</h3>
                  <p style={{ color: MUTED, lineHeight: 1.7, fontSize: '0.84rem', whiteSpace: 'pre-wrap' }}>{app.message}</p>
                </article>
              ))}
            </div>
          </section>
        )}

        <section style={{ borderRadius: 16, border: '1px solid rgba(217,168,87,0.2)', background: 'rgba(255,255,255,0.72)', padding: 16, marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, alignItems: 'end' }}>
            <div>
              <Label>日期</Label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <Label>本名</Label>
              <input value={script} onChange={e => setScript(e.target.value)} placeholder="搜剧本名" style={inputStyle} />
            </div>
            <div style={{ position: 'relative' }}>
              <Label>城市</Label>
              <button onClick={() => setCityOpen(!cityOpen)} style={{ ...inputStyle, textAlign: 'left', cursor: 'pointer' }}>
                📍 {city === 'all' ? '全部城市' : city}
              </button>
              {cityOpen && (
                <div style={{ position: 'absolute', left: 0, right: 0, top: '100%', zIndex: 20, maxHeight: 300, overflow: 'auto', padding: 8, borderRadius: 12, background: '#fffdf8', border: '1px solid rgba(217,168,87,0.28)', boxShadow: '0 16px 44px rgba(31,41,55,0.16)' }}>
                  <button onClick={() => { setCity('all'); setCityOpen(false); }} style={cityButton(city === 'all')}>全部城市</button>
                  {CITIES.map(c => <button key={c} onClick={() => { setCity(c); setCityOpen(false); }} style={cityButton(city === c)}>{c}</button>)}
                </div>
              )}
            </div>
            <button onClick={() => void loadPublic()} className="btn-gold" style={{ padding: '11px 18px' }}>筛选</button>
          </div>
        </section>

        <section style={{ borderRadius: 16, border: '1px solid rgba(217,168,87,0.2)', background: 'linear-gradient(135deg, rgba(255,250,242,0.9), rgba(239,246,255,0.78))', padding: 18, marginBottom: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.15rem', fontWeight: 900, marginBottom: 6 }}>AI 补贴助手接口</h2>
              <p style={{ color: MUTED, lineHeight: 1.7, fontSize: '0.86rem', margin: 0 }}>
                已预留 `/api/lc/carpools/assistant/compensation`。等拼车数据够多，就能按城市、本名、角色给出近期吃补/出补参考。
              </p>
            </div>
            <span style={{ alignSelf: 'center', color: '#925f18', fontSize: '0.82rem', fontWeight: 900 }}>先收数据，再让 AI 有话可说</span>
          </div>
        </section>

        {loading && <StateText text="正在找车..." />}
        {error && <StateText text={error} danger />}
        {!loading && !error && items.length === 0 && (
          <div style={{ textAlign: 'center', padding: '92px 20px', border: '1px dashed rgba(217,168,87,0.26)', borderRadius: 16, background: 'rgba(255,250,242,0.82)' }}>
            <div style={{ fontSize: 48, opacity: 0.45, marginBottom: 14 }}>🚗</div>
            <p style={{ color: MUTED, marginBottom: 20 }}>这里还没有公开拼车</p>
            <Link to="/carpools/new" className="btn-gold" style={{ padding: '10px 22px', textDecoration: 'none' }}>发布第一辆车</Link>
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: 16 }}>
            {items.map(item => (
              <CarpoolCard
                key={item.id}
                item={item}
                onApply={() => openApply(item)}
                applied={sentIds.has(item.id)}
                ownItem={getAuth()?.id === item.poster_id}
              />
            ))}
          </div>
        )}
      </div>

      {applyModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(31,41,55,0.48)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ width: '100%', maxWidth: 520, borderRadius: 18, border: '1px solid rgba(217,168,87,0.28)', background: '#fffdf8', boxShadow: '0 24px 70px rgba(31,41,55,0.24)', padding: 28 }}>
            {applyDone ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 42, marginBottom: 12 }}>✅</div>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: '1.25rem', marginBottom: 8 }}>上车申请已提交</h3>
                <p style={{ color: MUTED, lineHeight: 1.8, marginBottom: 20 }}>发布者可以在拼车区看到你的申请。后面再补正式消息提醒。</p>
                <button onClick={closeApply} className="btn-gold" style={{ padding: '10px 24px' }}>关闭</button>
              </div>
            ) : (
              <>
                <p style={{ color: GOLD, fontSize: '0.78rem', fontWeight: 900, letterSpacing: '0.04em', marginBottom: 8 }}>我要上车</p>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: '1.25rem', marginBottom: 8 }}>{applyModal.title}</h3>
                <Input label="想接/想玩的角色" value={applyRole} onChange={setApplyRole} placeholder="可选，例如：姐姐 / NPC / 男A" />
                <div style={{ marginTop: 12 }}>
                  <Label>申请说明 *</Label>
                  <textarea value={applyMessage} onChange={e => setApplyMessage(e.target.value)} rows={6}
                    placeholder="写清楚你能来的时间、想玩的角色、补贴预期、是否能接受反串/换角色..."
                    style={{ ...inputStyle, resize: 'none', lineHeight: 1.7 }} />
                </div>
                {applyError && <p style={{ color: '#b91c1c', fontSize: '0.82rem', marginTop: 10 }}>{applyError}</p>}
                <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                  <button onClick={closeApply} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid rgba(217,168,87,0.28)', background: 'transparent', color: MUTED, cursor: 'pointer', fontWeight: 700 }}>取消</button>
                  <button onClick={submitApply} disabled={!applyMessage.trim() || submittingApply} className="btn-gold"
                    style={{ flex: 2, padding: '11px', opacity: !applyMessage.trim() || submittingApply ? 0.55 : 1, cursor: !applyMessage.trim() || submittingApply ? 'not-allowed' : 'pointer' }}>
                    {submittingApply ? '提交中...' : '提交上车申请'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CarpoolCard({ item, showStatus, onApply, applied, ownItem }: { item: Carpool; showStatus?: boolean; onApply?: () => void; applied?: boolean; ownItem?: boolean }) {
  const subsidyText = item.subsidy_mode === 'none' ? '无补贴' : `${SUBSIDY_LABEL[item.subsidy_mode]} ${item.subsidy_amount} 契约币`;
  return (
    <article className="content-card" style={{ borderRadius: 16, padding: 20, border: '1px solid rgba(217,168,87,0.2)', background: 'linear-gradient(180deg, #ffffff, #fffaf2)', boxShadow: item.boost_amount > 0 ? '0 16px 36px rgba(217,168,87,0.18)' : '0 12px 30px rgba(31,41,55,0.06)' }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {showStatus && <StatusPill status={item.status} />}
        {item.boost_amount > 0 && <Pill>置顶加权 {item.boost_amount}</Pill>}
        <Pill>{item.event_date}</Pill>
        {item.deadline_date && <Pill>截止 {item.deadline_date}{item.deadline_time ? ` ${item.deadline_time}` : ''}</Pill>}
        <Pill>{item.city}</Pill>
        <Pill>{subsidyText}</Pill>
      </div>
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.13rem', fontWeight: 900, marginBottom: 8, color: INK }}>{item.title}</h2>
      <Meta>{item.script_name}{item.role_name ? ` · ${item.role_name}` : ''}{item.start_time ? ` · ${item.start_time}` : ''}</Meta>
      <p style={{ color: MUTED, lineHeight: 1.75, fontSize: '0.9rem', margin: '12px 0 14px', whiteSpace: 'pre-wrap' }}>{item.content}</p>
      <div style={{ display: 'grid', gap: 7, fontSize: '0.8rem', color: 'rgba(71,85,105,0.66)' }}>
        {item.role_note && <span>角色说明：{item.role_note}</span>}
        <span>缺口：{item.joined_count}/{item.needed_count}</span>
        {item.store_name && <span>店家：{item.store_name}{item.store_address ? ` · ${item.store_address}` : ''}</span>}
        {item.leader_contact && <span>车头联系方式：{item.leader_contact}</span>}
        {item.contact_note && <span>联系说明：{item.contact_note}</span>}
        {item.juzhanggui_sync_status === 'synced' && <span>已同步到剧司辰排期草稿</span>}
      </div>
      <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid rgba(217,168,87,0.16)', display: 'flex', justifyContent: 'space-between', gap: 12, color: 'rgba(71,85,105,0.58)', fontSize: '0.78rem' }}>
        <span>{item.poster_is_realname ? '⭐ ' : ''}{item.poster_name}</span>
        <span>{item.created_at?.slice(0, 10)}</span>
      </div>
      {onApply && (
        <button onClick={onApply} disabled={applied || ownItem}
          style={{
            width: '100%', marginTop: 14, padding: '10px 14px', borderRadius: 10,
            border: applied || ownItem ? '1px solid rgba(125,147,170,0.18)' : '1px solid rgba(217,168,87,0.28)',
            background: applied || ownItem ? 'rgba(241,245,249,0.8)' : 'linear-gradient(135deg, rgba(217,168,87,0.22), rgba(217,168,87,0.12))',
            color: applied || ownItem ? 'rgba(71,85,105,0.52)' : '#925f18',
            cursor: applied || ownItem ? 'not-allowed' : 'pointer',
            fontWeight: 900,
          }}>
          {ownItem ? '自己的拼车' : applied ? '已申请上车' : '我要上车'}
        </button>
      )}
    </article>
  );
}

function Input({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: '0.78rem', fontWeight: 800, marginBottom: 7, color: 'rgba(71,85,105,0.74)' }}>{children}</p>;
}

function Meta({ children }: { children: React.ReactNode }) {
  return <p style={{ color: 'rgba(71,85,105,0.62)', fontSize: '0.8rem', lineHeight: 1.7, margin: 0 }}>{children}</p>;
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span style={{ padding: '4px 9px', borderRadius: 999, background: 'rgba(217,168,87,0.13)', border: '1px solid rgba(217,168,87,0.22)', color: '#925f18', fontSize: '0.75rem', fontWeight: 700 }}>{children}</span>;
}

function StatusPill({ status }: { status: Carpool['status'] }) {
  const map = {
    pending: { label: '待审核', color: GOLD, bg: 'rgba(217,168,87,0.13)', border: 'rgba(217,168,87,0.24)' },
    rejected: { label: '未通过', color: '#b91c1c', bg: 'rgba(254,242,242,0.9)', border: 'rgba(220,38,38,0.24)' },
    approved: { label: '已公开', color: '#166534', bg: 'rgba(240,253,244,0.9)', border: 'rgba(34,197,94,0.22)' },
    closed: { label: '已关闭', color: '#64748b', bg: 'rgba(241,245,249,0.9)', border: 'rgba(100,116,139,0.22)' },
  }[status];
  return <span style={{ padding: '4px 9px', borderRadius: 999, background: map.bg, border: `1px solid ${map.border}`, color: map.color, fontSize: '0.75rem', fontWeight: 800 }}>{map.label}</span>;
}

function StateText({ text, danger }: { text: string; danger?: boolean }) {
  return <div style={{ textAlign: 'center', padding: '90px 0', color: danger ? '#b91c1c' : 'rgba(71,85,105,0.68)' }}>{text}</div>;
}

function cityButton(active: boolean): React.CSSProperties {
  return {
    width: '100%',
    textAlign: 'left',
    padding: '7px 10px',
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    background: active ? 'rgba(217,168,87,0.14)' : 'transparent',
    color: active ? '#925f18' : 'rgba(71,85,105,0.72)',
    fontWeight: active ? 800 : 500,
    fontSize: '0.82rem',
  };
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
