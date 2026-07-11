import { useEffect, useMemo, useState } from 'react';
import type React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import CitySearchSelect from '../components/CitySearchSelect';
import { ReputationButton, ReputationHubShell } from '../components/ReputationHubChrome';
import { cityReputationTitle } from '../lib/reputationNaming';

const API = '/api';
const GOLD = '#a66a1f';
const INK = '#1f2937';
const BLUE = '#275389';
const MUTED = 'rgba(71,85,105,0.76)';

const SUBJECT_LABEL: Record<string, string> = {
  creator: '服务者',
  dm: '卡司',
  store: '店家',
  takeaway: '外卖',
  player: '玩家',
  script_role: '角色',
};

const CITY_SUBJECT_FILTERS = [
  { value: 'all', label: '全部' },
  { value: 'dm', label: '卡司' },
  { value: 'store', label: '店家' },
  { value: 'takeaway', label: '外卖' },
  { value: 'script_role', label: '角色' },
] as const;

type SortKey = 'composite' | 'people' | 'new';

type ReputationItem = {
  key: string;
  subject_name: string;
  subject_type: string;
  subject_city?: string | null;
  praise_value: number;
  reputation_value: number;
  praise_people: number;
  event_count: number;
  red_count: number;
  white_count: number;
  black_count: number;
  comment_count: number;
  latest_at?: string | null;
  tags?: string[];
  subject_dossier_id?: string | null;
  rating_summary?: {
    avg: number | null;
    review_count: number;
    player_count: number;
    sample_status: 'insufficient' | 'stable';
  } | null;
};

function dossierUrl(item: ReputationItem) {
  const params = new URLSearchParams({
    subjectName: item.subject_name,
    subjectType: item.subject_type,
  });
  if (item.subject_city) params.set('city', item.subject_city);
  return `/reputation/dossier?${params}`;
}

function sortLabel(sort: SortKey) {
  if (sort === 'people') return '参与人数';
  if (sort === 'new') return '新晋';
  return '口碑值';
}

function formatDate(value?: string | null) {
  if (!value) return '暂无更新';
  return value.slice(0, 10);
}

export default function CityReputation() {
  const [searchParams] = useSearchParams();
  const initialCity = (searchParams.get('city') || '').trim();
  const [city, setCity] = useState(initialCity || 'all');
  const [subjectType, setSubjectType] = useState('all');
  const [sort, setSort] = useState<SortKey>('composite');
  const [items, setItems] = useState<ReputationItem[]>([]);
  const [loadedKey, setLoadedKey] = useState('');
  const [error, setError] = useState('');

  const requestKey = useMemo(() => `${city}|${subjectType}|${sort}`, [city, subjectType, sort]);
  const pageTitle = cityReputationTitle(city);
  const concreteCity = city !== 'all' ? city : '';
  const cityHref = concreteCity ? `/reputation/city?city=${encodeURIComponent(concreteCity)}` : '/reputation/city';
  const loading = loadedKey !== requestKey;

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ sort });
    if (city !== 'all') params.set('city', city);
    if (subjectType !== 'all') params.set('subjectType', subjectType);
    fetch(`${API}/lc/reputation/city?${params}`, { signal: controller.signal })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setItems(d.data?.items || []);
          setError('');
        } else {
          setItems([]);
          setError(d.error || '城市榜单加载失败');
        }
      })
      .catch(error => {
        if (error?.name !== 'AbortError') {
          setItems([]);
          setError('网络错误，城市榜单暂时加载失败');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadedKey(requestKey);
      });
    return () => controller.abort();
  }, [city, subjectType, sort, requestKey]);

  return (
    <ReputationHubShell
      active="city"
      cityTitle={pageTitle}
      cityHref={cityHref}
      currentLabel={pageTitle}
      actions={<ReputationButton to="/rankings/new">发布城市口碑</ReputationButton>}
    >
      <section style={cityHeroStyle}>
        <div>
          <p style={eyebrowStyle}>{city === 'all' ? '城市口碑' : city}</p>
          <h1 style={titleStyle}>{pageTitle}</h1>
          <p style={leadStyle}>
            城市页聚合店家、卡司、外卖和角色的对象档案，不替代红黑榜事件主榜。
          </p>
        </div>
        <aside style={adInlineStyle}>
          <strong>广告位招租</strong>
          <ReputationButton to="/contact" tone="gold">联系投放</ReputationButton>
        </aside>
      </section>

      <section style={cityFilterStyle}>
        <CitySearchSelect
          value={city}
          onChange={setCity}
          allowAll
          allowCustom
          style={{ minWidth: 190, flex: '1 1 190px' }}
        />
        <div style={filterGroupStyle}>
          {CITY_SUBJECT_FILTERS.map(item => (
            <Segment key={item.value} active={subjectType === item.value} onClick={() => setSubjectType(item.value)}>
              {item.label}
            </Segment>
          ))}
        </div>
        <div style={filterGroupStyle}>
          <Segment active={sort === 'composite'} onClick={() => setSort('composite')}>口碑值</Segment>
          <Segment active={sort === 'people'} onClick={() => setSort('people')}>参与人数</Segment>
          <Segment active={sort === 'new'} onClick={() => setSort('new')}>新晋</Segment>
        </div>
      </section>

      <section style={contentSectionStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={{ margin: 0, fontSize: 18 }}>{city === 'all' ? '城市对象档案' : `${city}对象档案`}</h2>
          <span style={sortBadgeStyle}>按{sortLabel(sort)}排序</span>
        </div>

        {loading ? (
          <p style={{ color: MUTED, padding: '36px 0', margin: 0 }}>加载中...</p>
        ) : error ? (
          <div style={emptyStyle}>{error}</div>
        ) : items.length === 0 ? (
          <div style={emptyStyle}>当前城市暂无可聚合的对象档案。先去红黑榜发布事件，或去卡司评分创建 DM / 店家档案。</div>
        ) : (
          <div style={cityGridStyle}>
            {items.map((item, index) => (
              <article key={item.key} className="content-card" style={cardStyle}>
                <div style={cardHeaderStyle}>
                  <div style={{ minWidth: 0 }}>
                    <span style={rankBadgeStyle}>#{index + 1}</span>
                    <h2 style={cardTitleStyle}>{item.subject_name}</h2>
                    <p style={cardMetaStyle}>
                      {SUBJECT_LABEL[item.subject_type] || item.subject_type}
                      {item.subject_city ? ` · ${item.subject_city}` : ''}
                    </p>
                  </div>
                  <span style={typeBadgeStyle}>{item.black_count > 0 ? '含争议记录' : '正向沉淀'}</span>
                </div>

                <div style={metricRowStyle}>
                  <span style={goldMetricChipStyle}>{item.praise_value} 打榜值</span>
                  <span style={metricChipStyle}>{item.reputation_value} 口碑值</span>
                  <span style={metricChipStyle}>{item.praise_people} 人参与</span>
                </div>

                {item.subject_type === 'store' && (
                  <p style={storeRatingLineStyle}>
                    {item.rating_summary?.avg
                      ? `${item.rating_summary.avg.toFixed(1)} ★ · ${item.rating_summary.player_count} 人评分 · ${item.rating_summary.review_count} 条到店记录`
                      : '店家综合五星：暂无评分'}
                  </p>
                )}

                <p style={eventLineStyle}>
                  {item.event_count} 条事件 · 红 {item.red_count} · 白 {item.white_count} · 黑 {item.black_count} · 评论 {item.comment_count}
                </p>

                {item.tags && item.tags.length > 0 && (
                  <div style={tagRowStyle}>
                    {item.tags.slice(0, 4).map(tag => <span key={tag} style={tagStyle}>{tag}</span>)}
                  </div>
                )}

                <div style={cardFooterStyle}>
                  <span style={{ color: 'rgba(71,85,105,0.48)', fontSize: 12 }}>{formatDate(item.latest_at)}</span>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {item.subject_type === 'store' && item.subject_dossier_id && (
                      <Link to={`/stores/rate?storeId=${encodeURIComponent(item.subject_dossier_id)}`} style={secondaryButtonStyle}>评分</Link>
                    )}
                    <Link
                      to={item.subject_type === 'store' && item.subject_dossier_id
                        ? `/stores/${encodeURIComponent(item.subject_dossier_id)}`
                        : dossierUrl(item)}
                      style={primaryButtonStyle}
                    >
                      查看档案
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </ReputationHubShell>
  );
}

function Segment({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={segmentStyle(active)}>
      {children}
    </button>
  );
}

function segmentStyle(active: boolean): React.CSSProperties {
  return {
    minHeight: 34,
    borderRadius: 999,
    border: active ? `1px solid ${BLUE}` : '1px solid rgba(31,41,55,0.10)',
    background: active ? BLUE : '#fff',
    color: active ? '#fff' : 'rgba(31,41,55,0.72)',
    padding: '0 12px',
    fontSize: 12,
    fontWeight: 900,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };
}

const cityHeroStyle: React.CSSProperties = {
  minHeight: 88,
  borderRadius: 12,
  border: '1px solid rgba(31,41,55,0.08)',
  background: '#fff',
  padding: '18px 18px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  flexWrap: 'wrap',
};
const eyebrowStyle: React.CSSProperties = { margin: '0 0 5px', color: GOLD, fontSize: 12, fontWeight: 950 };
const titleStyle: React.CSSProperties = { margin: 0, fontFamily: 'var(--font-serif)', fontSize: 'clamp(1.9rem, 3.2vw, 2.45rem)', lineHeight: 1.05, letterSpacing: 0 };
const leadStyle: React.CSSProperties = { margin: '6px 0 0', color: 'rgba(31,41,55,0.72)', lineHeight: 1.55, fontSize: 14, fontWeight: 700 };
const adInlineStyle: React.CSSProperties = { minHeight: 54, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', borderRadius: 12, border: '1px solid rgba(217,168,87,0.26)', background: INK, color: '#d9a857', padding: '10px 12px' };
const cityFilterStyle: React.CSSProperties = { minHeight: 54, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', padding: '10px 12px', borderRadius: 10, background: '#f8fafc', border: '1px solid rgba(31,41,55,0.06)' };
const filterGroupStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' };
const contentSectionStyle: React.CSSProperties = { display: 'grid', gap: 12 };
const sectionHeaderStyle: React.CSSProperties = { minHeight: 38, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' };
const sortBadgeStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', minHeight: 30, padding: '0 11px', borderRadius: 999, background: '#fff8e8', border: '1px solid rgba(217,168,87,0.30)', color: GOLD, fontSize: 12, fontWeight: 900 };
const cityGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: 12, alignItems: 'start' };
const cardStyle: React.CSSProperties = { minHeight: 218, display: 'grid', gap: 12, alignContent: 'start', padding: 18, borderRadius: 12, border: '1px solid rgba(31,41,55,0.08)', background: '#fff', boxShadow: 'none' };
const cardHeaderStyle: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 };
const rankBadgeStyle: React.CSSProperties = { display: 'inline-flex', borderRadius: 999, padding: '3px 9px', background: 'rgba(166,106,31,0.10)', color: GOLD, fontSize: 12, fontWeight: 950 };
const cardTitleStyle: React.CSSProperties = { margin: '8px 0 6px', fontSize: 18, lineHeight: 1.25, color: INK };
const cardMetaStyle: React.CSSProperties = { margin: 0, color: MUTED, fontSize: 13, fontWeight: 760 };
const typeBadgeStyle: React.CSSProperties = { display: 'inline-flex', flexShrink: 0, borderRadius: 999, padding: '4px 9px', background: 'rgba(239,246,255,0.88)', color: BLUE, fontSize: 12, fontWeight: 900 };
const metricRowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' };
const metricChipStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', minHeight: 30, padding: '0 11px', borderRadius: 999, border: '1px solid rgba(31,41,55,0.10)', background: '#fff', color: BLUE, fontSize: 12, fontWeight: 900 };
const goldMetricChipStyle: React.CSSProperties = { ...metricChipStyle, background: '#fff8e8', color: GOLD, borderColor: 'rgba(217,168,87,0.30)' };
const storeRatingLineStyle: React.CSSProperties = { margin: 0, padding: '9px 0', borderTop: '1px solid rgba(31,41,55,0.06)', borderBottom: '1px solid rgba(31,41,55,0.06)', color: GOLD, fontSize: 13, fontWeight: 900, lineHeight: 1.55 };
const eventLineStyle: React.CSSProperties = { margin: 0, color: MUTED, fontSize: 13, lineHeight: 1.7 };
const tagRowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' };
const tagStyle: React.CSSProperties = { padding: '3px 8px', borderRadius: 999, background: 'rgba(239,246,255,0.88)', color: BLUE, fontSize: 12, fontWeight: 800 };
const cardFooterStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', paddingTop: 8, borderTop: '1px solid rgba(31,41,55,0.06)' };
const primaryButtonStyle: React.CSSProperties = { minHeight: 34, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: BLUE, color: '#fff', padding: '0 12px', fontWeight: 900, cursor: 'pointer', textDecoration: 'none', fontSize: 12 };
const secondaryButtonStyle: React.CSSProperties = { ...primaryButtonStyle, background: '#fff', color: GOLD, border: '1px solid rgba(166,106,31,0.22)' };
const emptyStyle: React.CSSProperties = { padding: 28, borderRadius: 12, border: '1px dashed rgba(31,41,55,0.14)', background: '#fff', color: MUTED, textAlign: 'center', lineHeight: 1.8 };
