import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { AuthData, Commission } from '../types';
import { CITIES } from '../constants/cities';

const API = '/api';
const C = '#0b1a30';
const C2 = '#0f2239';
const GOLD = '#d9a857';

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
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState<Commission[]>([]);
  const [myItems, setMyItems] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [city, setCity] = useState('all');
  const [targetType, setTargetType] = useState('all');
  const [cityOpen, setCityOpen] = useState(false);
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
        const r = await fetch(`${API}/lc/commissions/mine`, {
          headers: { Authorization: `Bearer ${auth.token}` },
        });
        const d = await r.json();
        if (alive && d.success) setMyItems(d.data || []);
      } catch {
        if (alive) setMyItems([]);
      }
    };
    void loadMine();
    return () => { alive = false; };
  }, []);

  const privateItems = myItems.filter(item => item.status !== 'approved');

  return (
    <div style={{ backgroundColor: C, minHeight: '100vh', color: '#fff' }}>
      <div style={{ background: `radial-gradient(circle at 20% 0%, rgba(107,63,160,0.28), transparent 34%), ${C2}`, borderBottom: '1px solid rgba(201,146,46,0.12)', padding: '52px 20px 42px' }}>
        <div style={{ maxWidth: 1040, margin: '0 auto' }}>
          <div className="gold-line" style={{ marginBottom: 16 }} />
          <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: 'clamp(1.8rem, 4vw, 2.7rem)', marginBottom: 10 }}>
            委托需求墙
          </h1>
          <p style={{ color: 'rgba(220,230,243,0.78)', fontSize: '1rem', lineHeight: 1.8, maxWidth: 680 }}>
            委托人可以在这里写下想见的角色、日期和地点。也可以只留一段愿望，等待合适的灵契师回应。
          </p>
          <div style={{ marginTop: 22, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link to="/commissions/new" className="btn-gold" style={{ padding: '10px 22px', textDecoration: 'none', fontSize: '0.92rem' }}>
              发布委托需求
            </Link>
            <Link to="/explore" style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid rgba(217,168,87,0.28)', color: GOLD, textDecoration: 'none', fontSize: '0.9rem', fontWeight: 700 }}>
              找灵契师
            </Link>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '28px 20px 80px' }}>
        {submitted && (
          <div style={{ marginBottom: 18, borderRadius: 12, border: '1px solid rgba(217,168,87,0.28)', background: 'rgba(217,168,87,0.1)', padding: '14px 16px', color: 'rgba(245,243,238,0.88)', lineHeight: 1.7 }}>
            已提交成功，正在等待人工审核。审核通过后会公开展示在委托需求墙；在此之前，只有你能在下方“我的委托进度”看到它。
          </div>
        )}

        {privateItems.length > 0 && (
          <section style={{ marginBottom: 26, borderRadius: 16, border: '1px solid rgba(217,168,87,0.18)', background: 'rgba(255,255,255,0.045)', padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 14 }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', fontWeight: 900, marginBottom: 6 }}>我的委托进度</h2>
                <p style={{ color: 'rgba(220,230,243,0.68)', fontSize: '0.86rem', lineHeight: 1.7 }}>
                  这些内容暂时不公开，审核通过后才会进入大厅。
                </p>
              </div>
              <Link to="/commissions/new" style={{ color: GOLD, textDecoration: 'none', fontSize: '0.84rem', fontWeight: 800 }}>继续发布</Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {privateItems.map(item => <CommissionCard key={item.id} item={item} showStatus />)}
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
                  background: active ? 'rgba(217,168,87,0.16)' : 'rgba(255,255,255,0.045)',
                  color: active ? GOLD : 'rgba(220,230,243,0.7)', cursor: 'pointer', fontWeight: active ? 800 : 500,
                }}>
                {label}
              </button>
            );
          })}

          <div style={{ position: 'relative', marginLeft: 'auto' }}>
            <button onClick={() => setCityOpen(!cityOpen)}
              style={{ padding: '8px 15px', borderRadius: 999, border: '1px solid rgba(217,168,87,0.2)', background: 'rgba(255,255,255,0.045)', color: city === 'all' ? 'rgba(220,230,243,0.7)' : GOLD, cursor: 'pointer', fontWeight: 700 }}>
              📍 {city === 'all' ? '全部城市' : city}
            </button>
            {cityOpen && (
              <div style={{ position: 'absolute', right: 0, top: '115%', zIndex: 20, width: 280, maxHeight: 320, overflow: 'auto', padding: 8, borderRadius: 14, background: '#0d1f38', border: '1px solid rgba(217,168,87,0.22)', boxShadow: '0 16px 44px rgba(0,0,0,0.45)' }}>
                <button onClick={() => { setCity('all'); setCityOpen(false); }} style={cityButton(city === 'all')}>全部城市</button>
                <div style={{ height: 1, background: 'rgba(217,168,87,0.12)', margin: '6px 0' }} />
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
          <div style={{ textAlign: 'center', padding: '92px 20px', border: '1px dashed rgba(217,168,87,0.2)', borderRadius: 16, background: 'rgba(255,255,255,0.03)' }}>
            <div style={{ fontSize: 48, opacity: 0.45, marginBottom: 14 }}>✦</div>
            <p style={{ color: 'rgba(220,230,243,0.72)', marginBottom: 20 }}>这里还没有公开委托</p>
            <Link to="/commissions/new" className="btn-gold" style={{ padding: '10px 22px', textDecoration: 'none' }}>发布第一条</Link>
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {items.map(item => (
              <CommissionCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CommissionCard({ item, showStatus }: { item: Commission; showStatus?: boolean }) {
  return (
    <article style={{ borderRadius: 16, padding: 20, border: '1px solid rgba(217,168,87,0.16)', background: 'linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.035))' }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {showStatus && <StatusPill status={item.status} />}
        {item.needed_date && <Pill>{item.needed_date}</Pill>}
        {item.city && <Pill>{item.city}</Pill>}
        {item.target_type && <Pill>{TARGET_LABEL[item.target_type] || item.target_type}</Pill>}
      </div>
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.15rem', fontWeight: 900, marginBottom: 10, color: '#fff' }}>{item.title}</h2>
      <p style={{ color: 'rgba(220,230,243,0.75)', lineHeight: 1.75, fontSize: '0.9rem', marginBottom: 16, whiteSpace: 'pre-wrap' }}>{item.content}</p>
      <div style={{ display: 'grid', gap: 7, fontSize: '0.8rem', color: 'rgba(220,230,243,0.62)' }}>
        {item.desired_role && <span>想要角色：{item.desired_role}</span>}
        {item.location && <span>地点补充：{item.location}</span>}
        {item.budget && <span>预算：{item.budget}</span>}
        {item.contact_note && <span>联系说明：{item.contact_note}</span>}
        {showStatus && item.status === 'rejected' && item.reject_reason && <span style={{ color: '#fca5a5' }}>未通过原因：{item.reject_reason}</span>}
      </div>
      <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid rgba(217,168,87,0.12)', display: 'flex', justifyContent: 'space-between', gap: 12, color: 'rgba(220,230,243,0.52)', fontSize: '0.78rem' }}>
        <span>{item.poster_is_realname ? '⭐ ' : ''}{item.poster_name}</span>
        <span>{item.created_at?.slice(0, 10)}</span>
      </div>
    </article>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span style={{ padding: '4px 9px', borderRadius: 999, background: 'rgba(217,168,87,0.13)', border: '1px solid rgba(217,168,87,0.22)', color: GOLD, fontSize: '0.75rem', fontWeight: 700 }}>{children}</span>;
}

function StatusPill({ status }: { status: Commission['status'] }) {
  const map = {
    pending: { label: '待审核', color: GOLD, bg: 'rgba(217,168,87,0.13)', border: 'rgba(217,168,87,0.24)' },
    rejected: { label: '未通过', color: '#fca5a5', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.24)' },
    approved: { label: '已公开', color: '#86efac', bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.22)' },
  }[status];
  return <span style={{ padding: '4px 9px', borderRadius: 999, background: map.bg, border: `1px solid ${map.border}`, color: map.color, fontSize: '0.75rem', fontWeight: 800 }}>{map.label}</span>;
}

function StateText({ text, danger }: { text: string; danger?: boolean }) {
  return <div style={{ textAlign: 'center', padding: '90px 0', color: danger ? '#f87171' : 'rgba(220,230,243,0.65)' }}>{text}</div>;
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
    color: active ? GOLD : 'rgba(220,230,243,0.7)',
    fontWeight: active ? 800 : 500,
    fontSize: '0.82rem',
  };
}
