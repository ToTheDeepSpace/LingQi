import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { AuthData, Commission, CommissionApplication } from '../types';
import { CITIES } from '../constants/cities';

const API = '/api';
const C = '#fffdf8';
const C2 = '#eef6ff';
const GOLD = '#d9a857';
const INK = '#1f2937';
const MUTED = 'rgba(71,85,105,0.76)';

const TARGET_LABEL: Record<string, string> = {
  creator: '灵契师',
  photographer: '摄影师',
  makeup: '妆造师',
  costume: '服装商',
  prop: '道具师',
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

export default function Commissions() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState<Commission[]>([]);
  const [myItems, setMyItems] = useState<Commission[]>([]);
  const [receivedApplications, setReceivedApplications] = useState<CommissionApplication[]>([]);
  const [sentApplications, setSentApplications] = useState<{ id: string; commission_id: string; status: string; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [city, setCity] = useState('all');
  const [targetType, setTargetType] = useState('all');
  const [cityOpen, setCityOpen] = useState(false);
  const [applicationModal, setApplicationModal] = useState<Commission | null>(null);
  const [applicationLetter, setApplicationLetter] = useState('');
  const [applicationError, setApplicationError] = useState('');
  const [applicationDone, setApplicationDone] = useState(false);
  const [submittingApplication, setSubmittingApplication] = useState(false);
  const submitted = searchParams.get('submitted') === '1';

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const qs = new URLSearchParams();
        if (city !== 'all') qs.set('city', city);
        if (targetType !== 'all') qs.set('targetType', targetType);
        const r = await fetch(`${API}/lc/commissions?${qs.toString()}`);
        const d = await r.json();
        if (!alive) return;
        if (d.success) setItems(d.data || []);
        else setError(d.error || '加载失败');
      } catch {
        if (alive) setError('网络错误');
      } finally {
        if (alive) setLoading(false);
      }
    };
    void load();
    return () => { alive = false; };
  }, [city, targetType]);

  useEffect(() => {
    let alive = true;
    const auth = getAuth();
    if (!auth) {
      return () => { alive = false; };
    }
    const loadMine = async () => {
      try {
        const headers = { Authorization: `Bearer ${auth.token}` };
        const [mineRes, receivedRes, sentRes] = await Promise.all([
          fetch(`${API}/lc/commissions/mine`, { headers }),
          fetch(`${API}/lc/commissions/applications/received`, { headers }),
          fetch(`${API}/lc/commissions/applications/sent`, { headers }),
        ]);
        const mine = await mineRes.json();
        const received = await receivedRes.json();
        const sent = await sentRes.json();
        if (alive && mine.success) setMyItems(mine.data || []);
        if (alive && received.success) setReceivedApplications(received.data || []);
        if (alive && sent.success) setSentApplications(sent.data || []);
      } catch {
        if (alive) {
          setMyItems([]);
          setReceivedApplications([]);
          setSentApplications([]);
        }
      }
    };
    void loadMine();
    return () => { alive = false; };
  }, []);

  const privateItems = myItems.filter(item => item.status !== 'approved');
  const sentApplicationIds = new Set(sentApplications.map(item => item.commission_id));

  const openApplicationModal = (item: Commission) => {
    const auth = getAuth();
    if (!auth) {
      navigate('/login');
      return;
    }
    setApplicationModal(item);
    setApplicationLetter('');
    setApplicationError('');
    setApplicationDone(false);
  };

  const closeApplicationModal = () => {
    setApplicationModal(null);
    setApplicationLetter('');
    setApplicationError('');
    setApplicationDone(false);
    setSubmittingApplication(false);
  };

  const submitApplication = async () => {
    if (!applicationModal) return;
    const auth = getAuth();
    if (!auth) return navigate('/login');
    if (!applicationLetter.trim()) {
      setApplicationError('请先写一段申请信');
      return;
    }
    setSubmittingApplication(true);
    setApplicationError('');
    try {
      const r = await fetch(`${API}/lc/commissions/${applicationModal.id}/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify({ letter: applicationLetter.trim() }),
      });
      const d = await r.json();
      if (d.success) {
        setSentApplications(prev => [{ id: d.data.id, commission_id: applicationModal.id, status: 'submitted', created_at: new Date().toISOString() }, ...prev]);
        setApplicationDone(true);
      } else {
        setApplicationError(d.error || '提交失败');
      }
    } catch {
      setApplicationError('网络错误，请重试');
    } finally {
      setSubmittingApplication(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这条委托需求吗？')) return;
    const auth = getAuth();
    if (!auth) return;
    try {
      const r = await fetch(`${API}/lc/commissions/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      const d = await r.json();
      if (d.success) {
        setMyItems(prev => prev.filter(item => item.id !== id));
        setItems(prev => prev.filter(item => item.id !== id));
      } else {
        alert(d.error || '删除失败');
      }
    } catch {
      alert('网络错误，请重试');
    }
  };

  return (
    <div style={{ backgroundColor: C, minHeight: '100vh', color: INK }}>
      <div style={{ background: `radial-gradient(circle at 20% 0%, rgba(217,168,87,0.16), transparent 34%), linear-gradient(135deg, ${C2}, #fffaf2)`, borderBottom: '1px solid rgba(201,146,46,0.2)', padding: '52px 20px 42px' }}>
        <div style={{ maxWidth: 1040, margin: '0 auto' }}>
          <div className="gold-line" style={{ marginBottom: 16 }} />
          <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: 'clamp(1.8rem, 4vw, 2.7rem)', marginBottom: 10 }}>
            委托需求墙
          </h1>
          <p style={{ color: MUTED, fontSize: '1rem', lineHeight: 1.8, maxWidth: 680 }}>
            委托人可以在这里写下想见的角色、日期和地点。也可以只留一段愿望，等待合适的灵契师回应。
          </p>
          <div style={{ marginTop: 22, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link to="/commissions/new" className="btn-gold" style={{ padding: '10px 22px', textDecoration: 'none', fontSize: '0.92rem' }}>
              发布委托需求
            </Link>
            <Link to="/explore" style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid rgba(217,168,87,0.32)', color: '#925f18', background: 'rgba(255,255,255,0.72)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 700 }}>
              找灵契师
            </Link>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '28px 20px 80px' }}>
        {submitted && (
          <div style={{ marginBottom: 18, borderRadius: 12, border: '1px solid rgba(217,168,87,0.28)', background: 'rgba(217,168,87,0.12)', padding: '14px 16px', color: '#65401c', lineHeight: 1.7 }}>
            已提交成功，正在等待人工审核。审核通过后会公开展示在委托需求墙；在此之前，只有你能在下方“我的委托进度”看到它。
          </div>
        )}

        {privateItems.length > 0 && (
          <section style={{ marginBottom: 26, borderRadius: 16, border: '1px solid rgba(217,168,87,0.2)', background: 'rgba(255,250,242,0.86)', padding: 18, boxShadow: '0 12px 30px rgba(31,41,55,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 14 }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', fontWeight: 900, marginBottom: 6 }}>我的委托进度</h2>
                <p style={{ color: MUTED, fontSize: '0.86rem', lineHeight: 1.7 }}>
                  这些内容暂时不公开，审核通过后才会进入大厅。
                </p>
              </div>
              <Link to="/commissions/new" style={{ color: GOLD, textDecoration: 'none', fontSize: '0.84rem', fontWeight: 800 }}>继续发布</Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {privateItems.map(item => <CommissionCard key={item.id} item={item} showStatus onDelete={() => handleDelete(item.id)} />)}
            </div>
          </section>
        )}

        {receivedApplications.length > 0 && (
          <section style={{ marginBottom: 26, borderRadius: 16, border: '1px solid rgba(125,211,252,0.32)', background: 'rgba(239,246,255,0.9)', padding: 18, boxShadow: '0 12px 30px rgba(31,41,55,0.05)' }}>
            <div style={{ marginBottom: 14 }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', fontWeight: 900, marginBottom: 6 }}>收到的接单申请</h2>
              <p style={{ color: MUTED, fontSize: '0.86rem', lineHeight: 1.7 }}>
                这些是别人对你已发布委托需求写来的申请信，先在这里看，后面再接正式沟通流。
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {receivedApplications.map(app => (
                <article key={app.id} style={{ borderRadius: 14, border: '1px solid rgba(125,211,252,0.24)', background: '#fff', padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 10, color: 'rgba(71,85,105,0.6)', fontSize: '0.76rem' }}>
                    <span>{app.commission?.title || '委托需求'}</span>
                    <span>{app.created_at?.slice(0, 10)}</span>
                  </div>
                  <h3 style={{ fontWeight: 900, fontSize: '0.98rem', marginBottom: 8, color: '#275389' }}>
                    {app.applicant_is_realname ? '⭐ ' : ''}{app.applicant_name}
                  </h3>
                  <p style={{ color: MUTED, lineHeight: 1.7, fontSize: '0.84rem', whiteSpace: 'pre-wrap' }}>{app.letter}</p>
                </article>
              ))}
            </div>
          </section>
        )}

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 22 }}>
          {[
            ['all', '全部'],
            ['creator', '灵契师'],
            ['photographer', '摄影师'],
            ['makeup', '妆造师'],
            ['costume', '服装商'],
            ['prop', '道具师'],
          ].map(([key, label]) => {
            const active = targetType === key;
            return (
              <button key={key} onClick={() => setTargetType(key)}
                style={{
                  padding: '8px 15px', borderRadius: 999, border: active ? `1px solid ${GOLD}` : '1px solid rgba(217,168,87,0.16)',
                  background: active ? 'rgba(217,168,87,0.16)' : 'rgba(255,255,255,0.86)',
                  color: active ? '#925f18' : 'rgba(71,85,105,0.78)', cursor: 'pointer', fontWeight: active ? 800 : 500,
                }}>
                {label}
              </button>
            );
          })}

          <div style={{ position: 'relative', marginLeft: 'auto' }}>
            <button onClick={() => setCityOpen(!cityOpen)}
              style={{ padding: '8px 15px', borderRadius: 999, border: '1px solid rgba(217,168,87,0.24)', background: 'rgba(255,255,255,0.86)', color: city === 'all' ? 'rgba(71,85,105,0.78)' : '#925f18', cursor: 'pointer', fontWeight: 700 }}>
              📍 {city === 'all' ? '全部城市' : city}
            </button>
            {cityOpen && (
              <div style={{ position: 'absolute', right: 0, top: '115%', zIndex: 20, width: 280, maxHeight: 320, overflow: 'auto', padding: 8, borderRadius: 14, background: '#fffdf8', border: '1px solid rgba(217,168,87,0.28)', boxShadow: '0 16px 44px rgba(31,41,55,0.16)' }}>
                <button onClick={() => { setCity('all'); setCityOpen(false); }} style={cityButton(city === 'all')}>全部城市</button>
                <div style={{ height: 1, background: 'rgba(217,168,87,0.18)', margin: '6px 0' }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                  {CITIES.map(c => <button key={c} onClick={() => { setCity(c); setCityOpen(false); }} style={cityButton(city === c)}>{c}</button>)}
                </div>
              </div>
            )}
          </div>
        </div>

        {loading && <StateText text="正在展开委托卷轴..." />}
        {error && <StateText text={error} danger />}
        {!loading && !error && items.length === 0 && (
          <div style={{ textAlign: 'center', padding: '92px 20px', border: '1px dashed rgba(217,168,87,0.26)', borderRadius: 16, background: 'rgba(255,250,242,0.82)' }}>
            <div style={{ fontSize: 48, opacity: 0.45, marginBottom: 14 }}>✦</div>
            <p style={{ color: MUTED, marginBottom: 20 }}>这里还没有公开委托</p>
            <Link to="/commissions/new" className="btn-gold" style={{ padding: '10px 22px', textDecoration: 'none' }}>发布第一条</Link>
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {items.map(item => (
              <CommissionCard
                key={item.id}
                item={item}
                onApply={() => openApplicationModal(item)}
                applied={sentApplicationIds.has(item.id)}
                ownItem={getAuth()?.id === item.poster_id}
              />
            ))}
          </div>
        )}
      </div>

      {applicationModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(31,41,55,0.48)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ width: '100%', maxWidth: 520, borderRadius: 18, border: '1px solid rgba(217,168,87,0.28)', background: '#fffdf8', boxShadow: '0 24px 70px rgba(31,41,55,0.24)', padding: 28 }}>
            {applicationDone ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 42, marginBottom: 12 }}>✅</div>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: '1.25rem', marginBottom: 8 }}>接单申请已提交</h3>
                <p style={{ color: MUTED, lineHeight: 1.8, marginBottom: 20 }}>
                  你的申请信已经送到这条委托需求下面。当前版本先用于原型跑通，后面再补正式私信/通知。
                </p>
                <button onClick={closeApplicationModal} className="btn-gold" style={{ padding: '10px 24px' }}>关闭</button>
              </div>
            ) : (
              <>
                <p style={{ color: GOLD, fontSize: '0.78rem', fontWeight: 900, letterSpacing: '0.04em', marginBottom: 8 }}>我要接单</p>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: '1.25rem', marginBottom: 8 }}>{applicationModal.title}</h3>
                <p style={{ color: MUTED, lineHeight: 1.75, fontSize: '0.86rem', marginBottom: 16 }}>
                  写清楚你能接什么、可用时间、城市和你希望委托人先知道的条件。不要在这里放敏感隐私。
                </p>
                <textarea value={applicationLetter} onChange={e => setApplicationLetter(e.target.value)}
                  rows={6}
                  placeholder="例：我可以接这个角色，6月初在上海/杭州都方便。我的风格更偏沉浸陪伴，可以先沟通角色设定和边界..."
                  style={{ width: '100%', boxSizing: 'border-box', borderRadius: 12, border: '1px solid rgba(217,168,87,0.28)', background: '#fff', color: INK, padding: '12px 14px', resize: 'none', outline: 'none', lineHeight: 1.7 }} />
                {applicationError && <p style={{ color: '#b91c1c', fontSize: '0.82rem', marginTop: 10 }}>{applicationError}</p>}
                <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                  <button onClick={closeApplicationModal}
                    style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid rgba(217,168,87,0.28)', background: 'transparent', color: MUTED, cursor: 'pointer', fontWeight: 700 }}>取消</button>
                  <button onClick={submitApplication} disabled={!applicationLetter.trim() || submittingApplication}
                    className="btn-gold"
                    style={{ flex: 2, padding: '11px', opacity: !applicationLetter.trim() || submittingApplication ? 0.55 : 1, cursor: !applicationLetter.trim() || submittingApplication ? 'not-allowed' : 'pointer' }}>
                    {submittingApplication ? '提交中...' : '提交申请信'}
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

function CommissionCard({ item, showStatus, onDelete, onApply, applied, ownItem }: { item: Commission; showStatus?: boolean; onDelete?: () => void; onApply?: () => void; applied?: boolean; ownItem?: boolean }) {
  return (
    <article style={{ borderRadius: 16, padding: 20, border: '1px solid rgba(217,168,87,0.2)', background: 'linear-gradient(180deg, #ffffff, #fffaf2)', boxShadow: '0 12px 30px rgba(31,41,55,0.06)' }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {showStatus && <StatusPill status={item.status} />}
        {item.needed_date && <Pill>{item.needed_date}</Pill>}
        {item.city && <Pill>{item.city}</Pill>}
        {item.target_type && <Pill>{TARGET_LABEL[item.target_type] || item.target_type}</Pill>}
      </div>
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.15rem', fontWeight: 900, marginBottom: 10, color: INK }}>{item.title}</h2>
      <p style={{ color: MUTED, lineHeight: 1.75, fontSize: '0.9rem', marginBottom: 16, whiteSpace: 'pre-wrap' }}>{item.content}</p>
      <div style={{ display: 'grid', gap: 7, fontSize: '0.8rem', color: 'rgba(71,85,105,0.66)' }}>
        {item.desired_role && <span>想要角色：{item.desired_role}</span>}
        {item.location && <span>地点补充：{item.location}</span>}
        {item.budget && <span>预算：{item.budget}</span>}
        {item.contact_note && <span>联系说明：{item.contact_note}</span>}
        {showStatus && item.status === 'rejected' && item.reject_reason && <span style={{ color: '#b91c1c' }}>未通过原因：{item.reject_reason}</span>}
      </div>
      <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid rgba(217,168,87,0.16)', display: 'flex', justifyContent: 'space-between', gap: 12, color: 'rgba(71,85,105,0.58)', fontSize: '0.78rem' }}>
        <span>{item.poster_is_realname ? '⭐ ' : ''}{item.poster_name}</span>
        <span>{item.created_at?.slice(0, 10)}</span>
      </div>
      {onDelete && (
        <button onClick={onDelete}
          style={{ marginTop: 12, padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(220,38,38,0.24)', background: 'rgba(254,242,242,0.86)', color: '#b91c1c', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
          删除
        </button>
      )}
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
          {ownItem ? '自己的需求' : applied ? '已提交申请' : '我要接单'}
        </button>
      )}
    </article>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span style={{ padding: '4px 9px', borderRadius: 999, background: 'rgba(217,168,87,0.13)', border: '1px solid rgba(217,168,87,0.22)', color: '#925f18', fontSize: '0.75rem', fontWeight: 700 }}>{children}</span>;
}

function StatusPill({ status }: { status: Commission['status'] }) {
  const map = {
    pending: { label: '待审核', color: GOLD, bg: 'rgba(217,168,87,0.13)', border: 'rgba(217,168,87,0.24)' },
    rejected: { label: '未通过', color: '#b91c1c', bg: 'rgba(254,242,242,0.9)', border: 'rgba(220,38,38,0.24)' },
    approved: { label: '已公开', color: '#166534', bg: 'rgba(240,253,244,0.9)', border: 'rgba(34,197,94,0.22)' },
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
