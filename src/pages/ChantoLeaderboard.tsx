import { useEffect, useState } from 'react';
import type React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import CitySearchSelect from '../components/CitySearchSelect';
import { JumuluCompactHeader, JumuluPageFrame } from '../components/JumuluPageChrome';
import { generatedAvatarDataUrl } from '../lib/avatar';
import { jumuluFilterPanelStyle } from '../styles/jumuluPageStyles';

const API = '/api';
const INK = '#1f2937';
const MUTED = 'rgba(71,85,105,0.72)';
const GOLD = '#a66a1f';

type Period = 'month' | 'all';
type Item = {
  rank: number;
  id: string;
  dm_name: string;
  city?: string | null;
  workplace?: string | null;
  photo_url?: string | null;
  photo_focus_x?: number | null;
  photo_focus_y?: number | null;
  chanto_total: number;
  gift_count: number;
  supporter_count: number;
};

export default function ChantoLeaderboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [city, setCity] = useState(searchParams.get('city') || 'all');
  const [period, setPeriod] = useState<Period>(searchParams.get('period') === 'all' ? 'all' : 'month');
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ period });
    if (city && city !== 'all') params.set('city', city);
    fetch(`${API}/lc/dm-gifts/leaderboard?${params}`, { signal: controller.signal })
      .then(async response => ({ response, body: await response.json() }))
      .then(({ response, body }) => {
        if (!response.ok || !body.success) throw new Error(body.error?.message || body.error || '缠头榜加载失败');
        setItems(body.data?.items || []);
      })
      .catch(reason => {
        if (reason?.name !== 'AbortError') setError(reason instanceof Error ? reason.message : '缠头榜加载失败');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [city, period]);

  const updateFilter = (nextCity: string, nextPeriod: Period) => {
    setLoading(true);
    setError('');
    setCity(nextCity);
    setPeriod(nextPeriod);
    const next = new URLSearchParams();
    if (nextCity && nextCity !== 'all') next.set('city', nextCity);
    if (nextPeriod === 'all') next.set('period', 'all');
    setSearchParams(next, { replace: true });
  };

  const title = city === 'all' ? '全国缠头榜' : `${city}缠头榜`;

  return (
    <JumuluPageFrame currentLabel="缠头榜" maxWidth={1120}>
      <JumuluCompactHeader
        eyebrow="DM 支持榜"
        title={title}
        description="只按已支付且未退款的缠头总额排序。它不影响口碑榜、五星评分、审核结果或其他页面的默认推荐。"
        aside={<Link to="/dm" style={backLinkStyle}>查看 DM 评分</Link>}
      />

      <section style={jumuluFilterPanelStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <CitySearchSelect value={city} onChange={value => updateFilter(value, period)} allowAll allowCustom style={{ minWidth: 210, flex: '1 1 260px' }} />
          <div style={segmentStyle}>
            <button type="button" onClick={() => updateFilter(city, 'month')} style={segmentButton(period === 'month')}>本月榜</button>
            <button type="button" onClick={() => updateFilter(city, 'all')} style={segmentButton(period === 'all')}>总榜</button>
          </div>
        </div>
      </section>

      {loading ? <div style={emptyStyle}>正在加载...</div> : error ? <div style={{ ...emptyStyle, color: '#b91c1c' }}>{error}</div> : items.length === 0 ? <div style={emptyStyle}>当前城市还没有缠头记录。完成本人认领和 DM 身份认证后才能收取缠头。</div> : (
        <section className="chanto-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
          {items.map(item => (
            <Link key={item.id} to={`/dm/${encodeURIComponent(item.id)}`} style={cardStyle}>
              <span style={rankStyle(item.rank)}>{item.rank}</span>
              <img src={item.photo_url || generatedAvatarDataUrl(item.dm_name, item.id)} alt="" style={{ width: 62, height: 62, objectFit: 'cover', objectPosition: `${item.photo_focus_x ?? 50}% ${item.photo_focus_y ?? 25}%`, borderRadius: 7, border: '1px solid rgba(31,41,55,0.08)', background: '#fffaf2' }} />
              <span style={{ minWidth: 0, flex: 1 }}>
                <strong style={{ display: 'block', color: INK, fontSize: 17, overflowWrap: 'anywhere' }}>{item.dm_name}</strong>
                <span style={{ display: 'block', color: MUTED, fontSize: 12, marginTop: 5 }}>{item.city || '城市待补'}{item.workplace ? ` · ${item.workplace}` : ''}</span>
                <span style={{ display: 'block', color: MUTED, fontSize: 12, marginTop: 5 }}>{item.supporter_count} 人 · {item.gift_count} 次支持</span>
              </span>
              <span style={{ textAlign: 'right', flex: '0 0 auto' }}>
                <strong style={{ display: 'block', color: GOLD, fontSize: 21 }}>{item.chanto_total}</strong>
                <span style={{ color: MUTED, fontSize: 11 }}>缠头</span>
              </span>
            </Link>
          ))}
        </section>
      )}
      <style>{`
        @media (max-width: 700px) {
          .chanto-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </JumuluPageFrame>
  );
}

const backLinkStyle: React.CSSProperties = { minHeight: 38, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 13px', borderRadius: 7, border: '1px solid rgba(39,83,137,0.18)', background: '#fff', color: '#275389', textDecoration: 'none', fontSize: 13, fontWeight: 900 };
const segmentStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, padding: 4, borderRadius: 8, background: '#f3f4f6' };
const segmentButton = (active: boolean): React.CSSProperties => ({ minHeight: 36, border: 0, borderRadius: 6, background: active ? '#fff' : 'transparent', color: active ? INK : MUTED, padding: '0 15px', fontWeight: 900, cursor: 'pointer', boxShadow: active ? '0 1px 4px rgba(31,41,55,0.10)' : 'none' });
const cardStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 11, minWidth: 0, padding: 12, borderRadius: 8, border: '1px solid rgba(31,41,55,0.08)', background: '#fff', color: INK, textDecoration: 'none' };
const rankStyle = (rank: number): React.CSSProperties => ({ width: 28, height: 28, flex: '0 0 28px', display: 'grid', placeItems: 'center', borderRadius: 7, background: rank <= 3 ? '#fff4d6' : '#f8fafc', color: rank <= 3 ? '#8a5a19' : MUTED, fontSize: 13, fontWeight: 950 });
const emptyStyle: React.CSSProperties = { padding: '38px 18px', borderRadius: 8, border: '1px dashed rgba(31,41,55,0.14)', background: '#fff', color: MUTED, textAlign: 'center', lineHeight: 1.7 };
