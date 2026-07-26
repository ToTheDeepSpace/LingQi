import { useEffect, useMemo, useState } from 'react';
import type React from 'react';
import { Link } from 'react-router-dom';
import CitySearchSelect from '../components/CitySearchSelect';
import { JumuluCompactHeader, JumuluPageFrame } from '../components/JumuluPageChrome';
import { jumuluCardStyle, jumuluFilterPanelStyle, jumuluPrimaryLinkStyle, jumuluSecondaryLinkStyle } from '../styles/jumuluPageStyles';

const API = '/api';
const INK = '#1f2937';
const GOLD = '#a66a1f';
const BLUE = '#275389';
const MUTED = 'rgba(71,85,105,0.72)';
const STORE_LIST_BATCH = 20;

type RatingSummary = {
  avg: number | null;
  review_count: number;
  player_count: number;
  sample_status: 'insufficient' | 'stable';
};

type StoreDossier = {
  id: string;
  dm_name: string;
  city?: string | null;
  workplace?: string | null;
  photo_url?: string | null;
  note?: string | null;
  tags?: string[];
  claim_status?: string;
  rating_summary: RatingSummary;
};

export default function Stores() {
  const [items, setItems] = useState<StoreDossier[]>([]);
  const [city, setCity] = useState('all');
  const [query, setQuery] = useState('');
  const [loadedKey, setLoadedKey] = useState('');
  const [error, setError] = useState('');
  const [visibleCount, setVisibleCount] = useState(STORE_LIST_BATCH);
  const requestKey = useMemo(() => `${city}|${query.trim()}`, [city, query]);
  const loading = loadedKey !== requestKey;

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ entityType: 'store' });
    if (city !== 'all') params.set('city', city);
    if (query.trim()) params.set('q', query.trim());
    fetch(`${API}/lc/dm-dossiers?${params}`, { signal: controller.signal })
      .then(response => response.json().then(payload => ({ response, payload })))
      .then(({ response, payload }) => {
        if (!response.ok || !payload.success) throw new Error(payload.error || '店家评分加载失败');
        setVisibleCount(STORE_LIST_BATCH);
        setItems(payload.data || []);
        setError('');
      })
      .catch(fetchError => {
        if (fetchError?.name === 'AbortError') return;
        setItems([]);
        setError(fetchError instanceof SyntaxError ? '店家评分加载失败，请稍后重试' : fetchError instanceof Error ? fetchError.message : '店家评分加载失败');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadedKey(requestKey);
      });
    return () => controller.abort();
  }, [city, query, requestKey]);

  const sortedItems = useMemo(() => [...items].sort((left, right) => {
    const players = Number(right.rating_summary?.player_count || 0) - Number(left.rating_summary?.player_count || 0);
    if (players) return players;
    const score = Number(right.rating_summary?.avg || 0) - Number(left.rating_summary?.avg || 0);
    if (score) return score;
    return left.dm_name.localeCompare(right.dm_name, 'zh-CN');
  }), [items]);
  const displayedItems = sortedItems.slice(0, visibleCount);
  const remainingCount = Math.max(0, sortedItems.length - displayedItems.length);
  const nextBatchCount = Math.min(STORE_LIST_BATCH, remainingCount);

  return (
    <JumuluPageFrame
      currentLabel="店家评分"
    >
      <JumuluCompactHeader
        eyebrow="沉浸式娱乐店家评分"
        title="查店家，评到店体验"
        description="每次真实到店都可以留下综合五星；同一玩家多次体验会完整展示，但综合分只占一个玩家权重。"
        aside={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Link to="/stores/rate" style={jumuluPrimaryLinkStyle}>给店家评分</Link>
            <Link to="/reputation/city" style={jumuluSecondaryLinkStyle}>看城市口碑</Link>
          </div>
        }
      />

      <section style={jumuluFilterPanelStyle}>
        <div style={filterRowStyle}>
          <CitySearchSelect value={city} onChange={setCity} allowAll allowCustom style={{ flex: '1 1 190px', minWidth: 180 }} />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索店家名称" style={inputStyle} />
        </div>
      </section>

      {loading && <StatePanel>正在加载店家评分...</StatePanel>}
      {!loading && error && <StatePanel tone="error">{error}</StatePanel>}
      {!loading && !error && sortedItems.length === 0 && (
        <StatePanel>
          <strong>还没有找到店家档案</strong>
          <span style={{ color: MUTED, fontSize: 13 }}>可以直接提交新店家并留下第一条到店评分。</span>
          <Link to="/stores/rate" style={jumuluPrimaryLinkStyle}>给店家评分</Link>
        </StatePanel>
      )}

      {!loading && !error && sortedItems.length > 0 && (
        <>
          <section style={gridStyle} aria-label="店家评分列表">
            {displayedItems.map(item => {
              const summary = item.rating_summary || { avg: null, review_count: 0, player_count: 0, sample_status: 'insufficient' as const };
              return (
                <article key={item.id} style={cardStyle}>
                  <Link to={`/stores/${encodeURIComponent(item.id)}`} aria-label={`查看${item.dm_name}店家专属页`} style={cardOverlayLinkStyle} />
                  <div style={cardHeadStyle}>
                    <div style={{ minWidth: 0 }}>
                      <h2 style={nameStyle}>{item.dm_name}</h2>
                      <p style={metaStyle}>{item.city || '城市待补'}{item.workplace ? ` · ${item.workplace}` : ''}</p>
                    </div>
                    <div style={scoreStyle}>
                      {summary.avg ? <><strong>{summary.avg.toFixed(1)}</strong><span>★</span></> : <strong style={{ fontSize: 13 }}>暂无评分</strong>}
                      <small>{summary.player_count || 0} 人评分</small>
                    </div>
                  </div>
                  {item.tags && item.tags.length > 0 && <div style={tagRowStyle}>{item.tags.slice(0, 4).map(tag => <span key={tag} style={tagStyle}>{tag}</span>)}</div>}
                  <div style={{ ...cardFooterStyle, position: 'relative', zIndex: 2 }}>
                    <span style={{ color: MUTED, fontSize: 12 }}>{summary.review_count || 0} 条到店记录{summary.sample_status === 'insufficient' && summary.player_count > 0 ? ' · 样本较少' : ''}</span>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Link to={`/stores/rate?storeId=${encodeURIComponent(item.id)}`} style={smallSecondaryStyle}>评分</Link>
                      <Link to={`/stores/${encodeURIComponent(item.id)}`} style={smallPrimaryStyle}>查看店家</Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
          {remainingCount > 0 && (
            <button
              type="button"
              onClick={() => setVisibleCount(current => current + STORE_LIST_BATCH)}
              style={loadMoreStyle}
            >
              <strong>继续加载 {nextBatchCount} 家</strong>
              <span>已显示 {displayedItems.length} / {sortedItems.length}</span>
            </button>
          )}
        </>
      )}
    </JumuluPageFrame>
  );
}

function StatePanel({ children, tone = 'normal' }: { children: React.ReactNode; tone?: 'normal' | 'error' }) {
  return <section style={{ ...stateStyle, color: tone === 'error' ? '#b91c1c' : INK }}>{children}</section>;
}

const filterRowStyle: React.CSSProperties = { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' };
const inputStyle: React.CSSProperties = { flex: '2 1 260px', minWidth: 200, minHeight: 44, border: '1px solid rgba(39,83,137,0.18)', borderRadius: 10, padding: '0 12px', background: '#fff', color: INK, fontSize: 14 };
const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))', gap: 12 };
const cardStyle: React.CSSProperties = { ...jumuluCardStyle, position: 'relative', minHeight: 156, display: 'grid', alignContent: 'space-between', gap: 10, padding: 14 };
const cardOverlayLinkStyle: React.CSSProperties = { position: 'absolute', inset: 0, zIndex: 1, borderRadius: 8 };
const cardHeadStyle: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 };
const nameStyle: React.CSSProperties = { margin: 0, fontSize: 17, lineHeight: 1.3, overflowWrap: 'anywhere' };
const metaStyle: React.CSSProperties = { margin: '6px 0 0', color: MUTED, fontSize: 13, lineHeight: 1.55 };
const scoreStyle: React.CSSProperties = { flex: '0 0 auto', minWidth: 76, textAlign: 'right', color: INK };
const tagRowStyle: React.CSSProperties = { display: 'flex', gap: 6, flexWrap: 'wrap' };
const tagStyle: React.CSSProperties = { padding: '3px 8px', borderRadius: 999, background: '#eef6ff', color: BLUE, fontSize: 11, fontWeight: 800 };
const cardFooterStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', paddingTop: 12, borderTop: '1px solid rgba(31,41,55,0.07)' };
const smallPrimaryStyle: React.CSSProperties = { minHeight: 34, display: 'inline-flex', alignItems: 'center', borderRadius: 7, padding: '0 11px', background: BLUE, color: '#fff', fontSize: 12, fontWeight: 900, textDecoration: 'none' };
const smallSecondaryStyle: React.CSSProperties = { ...smallPrimaryStyle, background: '#fff', color: GOLD, border: '1px solid rgba(166,106,31,0.22)' };
const loadMoreStyle: React.CSSProperties = { width: '100%', minHeight: 42, marginTop: 2, border: '1px solid rgba(39,83,137,0.14)', borderRadius: 8, background: '#fff', color: BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, cursor: 'pointer' };
const stateStyle: React.CSSProperties = { minHeight: 170, display: 'grid', placeContent: 'center', justifyItems: 'center', gap: 10, border: '1px dashed rgba(39,83,137,0.22)', borderRadius: 8, background: '#fff', padding: 24, textAlign: 'center' };
