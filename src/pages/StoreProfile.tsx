import { useEffect, useState } from 'react';
import type React from 'react';
import { Link, useParams } from 'react-router-dom';
import { generatedAvatarDataUrl } from '../lib/avatar';
import { JumuluPageFrame } from '../components/JumuluPageChrome';
import { jumuluCardStyle, jumuluPrimaryLinkStyle, jumuluSecondaryLinkStyle } from '../styles/jumuluPageStyles';

const API = '/api';
const INK = '#1f2937';
const GOLD = '#a66a1f';
const BLUE = '#275389';
const MUTED = 'rgba(71,85,105,0.72)';

type StoreDetail = {
  dossier: {
    id: string;
    name: string;
    city?: string | null;
    address?: string | null;
    profile_url?: string | null;
    photo_url?: string | null;
    note?: string | null;
    tags?: string[];
    claim_status?: string;
  };
  summary: { avg: number | null; review_count: number; player_count: number; sample_status: 'insufficient' | 'stable' };
  ratings: Array<{ id: string; profile_name: string; script_name: string; visited_on: string; rating: number; content: string; tags?: string[] }>;
  reputation_summary: { event_count: number; red_count: number; black_count: number; white_count: number };
  reputation_events: Array<{ id: string; type: 'red' | 'black' | 'white'; content: string; author_name: string; event_date?: string | null; event_script_name?: string | null; created_at: string }>;
};

export default function StoreProfile() {
  const { id = '' } = useParams();
  const [data, setData] = useState<StoreDetail | null>(null);
  const [loadedId, setLoadedId] = useState('');
  const [error, setError] = useState('');
  const loading = loadedId !== id;

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API}/lc/store-dossiers/${encodeURIComponent(id)}`, { signal: controller.signal })
      .then(response => response.json().then(payload => ({ response, payload })))
      .then(({ response, payload }) => {
        if (!response.ok || !payload.success) throw new Error(payload.error || '店家档案加载失败');
        setData(payload.data);
        setError('');
      })
      .catch(fetchError => {
        if (fetchError?.name === 'AbortError') return;
        setError(fetchError instanceof Error ? fetchError.message : '店家档案加载失败');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadedId(id);
      });
    return () => controller.abort();
  }, [id]);

  return (
    <JumuluPageFrame
      currentLabel="店家详情"
      maxWidth={1080}
      actions={
        <>
          <Link to={`/stores/rate?storeId=${encodeURIComponent(id)}`} style={jumuluPrimaryLinkStyle}>给店家评分</Link>
          <Link to="/stores" style={jumuluSecondaryLinkStyle}>返回店家列表</Link>
        </>
      }
    >
      {loading && <StatePanel>正在加载店家档案...</StatePanel>}
      {!loading && error && <StatePanel tone="error">{error}</StatePanel>}
      {!loading && data && (
        <>
          <section style={heroStyle}>
            <img src={data.dossier.photo_url || generatedAvatarDataUrl(data.dossier.name, `store:${id}`)} alt="" style={avatarStyle} />
            <div style={{ minWidth: 0, flex: '1 1 260px' }}>
              <p style={eyebrowStyle}>店家档案{data.dossier.claim_status === 'approved' ? ' · 已认领' : ' · 未认领'}</p>
              <h1 style={titleStyle}>{data.dossier.name}</h1>
              <p style={metaStyle}>{data.dossier.city || '城市待补'}{data.dossier.address ? ` · ${data.dossier.address}` : ''}</p>
            </div>
            <div style={heroScoreStyle}>
              {data.summary.avg ? <><strong>{data.summary.avg.toFixed(1)}</strong><span>★</span></> : <strong style={{ fontSize: 16 }}>暂无评分</strong>}
              <small>{data.summary.player_count} 人评分 · {data.summary.review_count} 条记录</small>
            </div>
          </section>

          <section style={summaryGridStyle}>
            <Metric label="综合五星" value={data.summary.avg ? `${data.summary.avg.toFixed(1)} / 5` : '暂无'} />
            <Metric label="独立玩家" value={`${data.summary.player_count} 人`} />
            <Metric label="到店记录" value={`${data.summary.review_count} 条`} />
            <Metric label="红黑榜事件" value={`${data.reputation_summary.event_count || 0} 条`} />
          </section>

          <div className="store-profile-layout" style={layoutStyle}>
            <section style={{ ...jumuluCardStyle, padding: 16 }}>
              <div style={sectionHeadStyle}><h2 style={sectionTitleStyle}>玩家到店评价</h2><span style={sampleStyle}>{data.summary.sample_status === 'stable' ? '样本已稳定' : '样本较少'}</span></div>
              <div style={listStyle}>
                {data.ratings.map(item => (
                  <article key={item.id} style={reviewStyle}>
                    <div style={reviewHeadStyle}><strong>{item.profile_name || '匿名玩家'}</strong><span style={reviewScoreStyle}>{item.rating} 星</span></div>
                    <p style={proofStyle}>《{item.script_name}》 · {item.visited_on}</p>
                    <p style={contentStyle}>{item.content}</p>
                    {item.tags && item.tags.length > 0 && <div style={tagRowStyle}>{item.tags.map(tag => <span key={tag} style={tagStyle}>{tag}</span>)}</div>}
                  </article>
                ))}
                {data.ratings.length === 0 && <div style={emptyStyle}>还没有公开的到店评分。</div>}
              </div>
            </section>

            <aside style={sideStyle}>
              <section style={{ ...jumuluCardStyle, padding: 16 }}>
                <h2 style={sectionTitleStyle}>店家档案</h2>
                {data.dossier.note && <p style={contentStyle}>{data.dossier.note}</p>}
                {data.dossier.tags && data.dossier.tags.length > 0 && <div style={tagRowStyle}>{data.dossier.tags.map(tag => <span key={tag} style={tagStyle}>{tag}</span>)}</div>}
                {data.dossier.profile_url && <a href={normalizeExternalUrl(data.dossier.profile_url)} target="_blank" rel="noreferrer" style={{ ...jumuluSecondaryLinkStyle, marginTop: 12 }}>查看店铺主页</a>}
              </section>

              <section style={{ ...jumuluCardStyle, padding: 16 }}>
                <h2 style={sectionTitleStyle}>关联红黑榜事件</h2>
                <p style={{ margin: '8px 0 12px', color: MUTED, fontSize: 13, lineHeight: 1.65 }}>五星记录长期体验，红黑榜保留具体事件，两套数据分开。</p>
                <div style={listStyle}>
                  {data.reputation_events.slice(0, 6).map(event => (
                    <article key={event.id} style={eventStyle}>
                      <strong style={{ color: event.type === 'black' ? '#475569' : event.type === 'red' ? '#b91c1c' : GOLD }}>{event.type === 'red' ? '红榜事件' : event.type === 'black' ? '黑榜事件' : '白榜记录'}</strong>
                      <p style={{ margin: '6px 0 0', color: MUTED, fontSize: 12 }}>{event.event_script_name ? `《${event.event_script_name}》 · ` : ''}{event.event_date || event.created_at?.slice(0, 10)}</p>
                      <p style={{ margin: '8px 0 0', color: INK, fontSize: 13, lineHeight: 1.6 }}>{event.content}</p>
                    </article>
                  ))}
                  {data.reputation_events.length === 0 && <div style={emptyStyle}>暂无关联事件。</div>}
                </div>
                <Link to={`/rankings/new?subjectType=store&subjectDossierId=${encodeURIComponent(id)}`} style={{ ...jumuluSecondaryLinkStyle, marginTop: 12 }}>发布红黑榜记录</Link>
              </section>
            </aside>
          </div>
          <style>{`
            @media (max-width: 760px) {
              .store-profile-layout { grid-template-columns: 1fr !important; }
            }
          `}</style>
        </>
      )}
    </JumuluPageFrame>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div style={metricStyle}><span>{label}</span><strong>{value}</strong></div>;
}

function StatePanel({ children, tone = 'normal' }: { children: React.ReactNode; tone?: 'normal' | 'error' }) {
  return <section style={{ ...stateStyle, color: tone === 'error' ? '#b91c1c' : INK }}>{children}</section>;
}

function normalizeExternalUrl(value: string) {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

const heroStyle: React.CSSProperties = { minHeight: 140, display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', borderRadius: 8, border: '1px solid rgba(31,41,55,0.08)', background: '#fff', padding: 20 };
const avatarStyle: React.CSSProperties = { width: 88, height: 88, borderRadius: 8, objectFit: 'cover', background: '#fff8e8', border: '1px solid rgba(166,106,31,0.18)' };
const eyebrowStyle: React.CSSProperties = { margin: 0, color: GOLD, fontSize: 12, fontWeight: 900 };
const titleStyle: React.CSSProperties = { margin: '7px 0 0', fontFamily: 'var(--font-serif)', fontSize: 'clamp(2rem, 5vw, 3rem)', lineHeight: 1.05, overflowWrap: 'anywhere' };
const metaStyle: React.CSSProperties = { margin: '9px 0 0', color: MUTED, lineHeight: 1.6 };
const heroScoreStyle: React.CSSProperties = { marginLeft: 'auto', minWidth: 120, textAlign: 'right' };
const summaryGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 };
const metricStyle: React.CSSProperties = { ...jumuluCardStyle, minHeight: 82, display: 'grid', alignContent: 'center', gap: 7, padding: 14, color: MUTED, fontSize: 12 };
const layoutStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(280px, 0.65fr)', gap: 12, alignItems: 'start' };
const sideStyle: React.CSSProperties = { display: 'grid', gap: 12 };
const sectionHeadStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 12 };
const sectionTitleStyle: React.CSSProperties = { margin: 0, fontSize: 17 };
const sampleStyle: React.CSSProperties = { color: BLUE, fontSize: 12, fontWeight: 850 };
const listStyle: React.CSSProperties = { display: 'grid', gap: 9 };
const reviewStyle: React.CSSProperties = { borderTop: '1px solid rgba(31,41,55,0.08)', paddingTop: 12 };
const reviewHeadStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 10 };
const reviewScoreStyle: React.CSSProperties = { color: GOLD, fontWeight: 900 };
const proofStyle: React.CSSProperties = { margin: '7px 0 0', color: BLUE, fontSize: 12, fontWeight: 800 };
const contentStyle: React.CSSProperties = { margin: '9px 0 0', color: 'rgba(31,41,55,0.82)', lineHeight: 1.7, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' };
const tagRowStyle: React.CSSProperties = { display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 };
const tagStyle: React.CSSProperties = { padding: '3px 8px', borderRadius: 999, background: '#eef6ff', color: BLUE, fontSize: 11, fontWeight: 800 };
const eventStyle: React.CSSProperties = { borderTop: '1px solid rgba(31,41,55,0.08)', paddingTop: 10 };
const emptyStyle: React.CSSProperties = { padding: 16, borderRadius: 7, border: '1px dashed rgba(31,41,55,0.14)', color: MUTED, textAlign: 'center', fontSize: 13 };
const stateStyle: React.CSSProperties = { minHeight: 180, display: 'grid', placeContent: 'center', border: '1px dashed rgba(39,83,137,0.22)', borderRadius: 8, background: '#fff', padding: 24, textAlign: 'center' };
