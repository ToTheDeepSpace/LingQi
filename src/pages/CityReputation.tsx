import { useEffect, useMemo, useState } from 'react';
import type React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import CitySearchSelect from '../components/CitySearchSelect';
import InfoTip from '../components/InfoTip';
import { ReputationAdCard, ReputationBadge, ReputationHubShell, ReputationPanel, ReputationStat } from '../components/ReputationHubChrome';
import { cityReputationTitle } from '../lib/reputationNaming';

const API = '/api';
const GOLD = '#a66a1f';
const INK = '#1f2937';
const MUTED = 'rgba(71,85,105,0.76)';

const SUBJECT_LABEL: Record<string, string> = {
  creator: '委托师',
  dm: 'DM / 卡司',
  store: '店家',
  takeaway: '外卖',
  player: '玩家',
};

type SortKey = 'composite' | 'praise' | 'people' | 'new';

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
};

function dossierUrl(item: ReputationItem) {
  const params = new URLSearchParams({
    subjectName: item.subject_name,
    subjectType: item.subject_type,
  });
  if (item.subject_city) params.set('city', item.subject_city);
  return `/reputation/dossier?${params}`;
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
    <ReputationHubShell active="city" cityTitle={pageTitle} cityHref={cityHref}>
      <section style={cityHeroStyle}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
          <div>
            <ReputationBadge>{city === 'all' ? '城市口碑' : city}</ReputationBadge>
            <h1 style={{ margin: '14px 0 10px', fontFamily: 'var(--font-serif)', fontSize: 'clamp(2.2rem, 5vw, 3rem)', lineHeight: 1.08 }}>
              {pageTitle}
              <InfoTip>这里不是单条红黑榜，而是把玩家遇到的事件沉淀成城市里的 DM、店家、剧本和角色参考。打榜值代表真金白银支持强度，口碑值代表多人认可和信息质量。</InfoTip>
            </h1>
            <p style={{ margin: 0, maxWidth: 720, color: MUTED, lineHeight: 1.75, fontSize: 15, fontWeight: 600 }}>
              同一个城市里，店家、卡司、灵契师、玩家、外卖和剧本角色的口碑会自然连在一起。这里展示城市维度的对象档案，不替代红黑榜事件主榜。
            </p>
          </div>
          <ReputationAdCard />
        </div>

        <div style={cityFilterStyle}>
          <CitySearchSelect
            value={city}
            onChange={setCity}
            allowAll
            allowCustom
            style={{ minWidth: 190, flex: '1 1 190px' }}
          />
          <select value={subjectType} onChange={e => setSubjectType(e.target.value)} style={inputStyle}>
            <option value="all">全部对象</option>
            {Object.entries(SUBJECT_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <Segment active={sort === 'composite'} onClick={() => setSort('composite')}>综合榜</Segment>
          <Segment active={sort === 'praise'} onClick={() => setSort('praise')}>打榜排行</Segment>
          <Segment active={sort === 'people'} onClick={() => setSort('people')}>人气榜</Segment>
          <Segment active={sort === 'new'} onClick={() => setSort('new')}>新晋榜</Segment>
          <Link to="/dm-wall" style={ghostButton}>爱D墙 / 店家</Link>
        </div>
      </section>

      <section style={cityBodyStyle}>
        <ReputationPanel style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>{city === 'all' ? '城市对象档案' : `${city}对象档案`}</h2>
            <ReputationBadge tone="gold">{sort === 'praise' ? '按打榜值排序' : sort === 'people' ? '按打榜人数排序' : sort === 'new' ? '按新晋排序' : '按口碑值排序'}</ReputationBadge>
          </div>
        {loading ? (
          <p style={{ color: MUTED, padding: '36px 0' }}>加载中...</p>
        ) : error ? (
          <div style={emptyStyle}>{error}</div>
        ) : items.length === 0 ? (
          <div style={emptyStyle}>当前城市暂无可聚合的对象档案。先去红黑榜发布事件，或去爱D墙创建 DM / 店家档案。</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            {items.map((item, index) => (
              <article key={item.key} style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                  <div>
                    <span style={rankBadge}>#{index + 1}</span>
                    <h2 style={{ margin: '8px 0 6px', fontSize: 19 }}>{item.subject_name}</h2>
                    <p style={{ margin: 0, color: MUTED, fontSize: 14 }}>
                      {SUBJECT_LABEL[item.subject_type] || item.subject_type}{item.subject_city ? ` · ${item.subject_city}` : ''}
                    </p>
                  </div>
                  <span style={typeBadge}>{item.black_count > 0 ? '含争议记录' : '正向沉淀'}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
                  <Metric label="打榜值" value={item.praise_value} />
                  <Metric label="口碑值" value={item.reputation_value} />
                  <Metric label="打榜人数" value={item.praise_people} />
                </div>
                <p style={{ margin: '0 0 10px', color: MUTED, fontSize: 13, lineHeight: 1.7 }}>
                  {item.event_count} 条事件 · 红 {item.red_count} · 白 {item.white_count} · 黑 {item.black_count} · 评论 {item.comment_count}
                </p>
                {item.tags && item.tags.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                    {item.tags.map(tag => <span key={tag} style={tagStyle}>{tag}</span>)}
                  </div>
                )}
                <Link to={dossierUrl(item)} style={primaryButton}>查看档案</Link>
              </article>
            ))}
          </div>
        )}
        </ReputationPanel>
        <aside style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          <ReputationPanel>
            <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>城市趋势</h2>
            <div style={{ display: 'grid', gap: 10 }}>
              <ReputationStat label="聚合对象" value={items.length} tone="blue" />
              <ReputationStat label="事件总数" value={items.reduce((sum, item) => sum + item.event_count, 0)} tone="gold" />
              <ReputationStat label="打榜人数" value={items.reduce((sum, item) => sum + item.praise_people, 0)} tone="green" />
              <ReputationStat label="含争议记录" value={items.filter(item => item.black_count > 0).length} tone="red" />
            </div>
          </ReputationPanel>
          <section style={ruleCardStyle}>
            <h2 style={{ margin: '0 0 10px', color: '#d9a857', fontSize: 16 }}>审核规则</h2>
            <p style={{ margin: 0, color: 'rgba(255,253,248,0.82)', lineHeight: 1.7, fontSize: 13 }}>
              红黑榜事件必须有证据，涉及第三方信息要打码；相关方回应、评论和举报都会留存记录。
            </p>
          </section>
        </aside>
      </section>
    </ReputationHubShell>
  );
}

function Segment({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} style={{ ...ghostButton, background: active ? 'rgba(166,106,31,0.12)' : '#fffaf2', borderColor: active ? 'rgba(166,106,31,0.42)' : 'rgba(166,106,31,0.22)' }}>{children}</button>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ borderRadius: 10, background: '#fffaf2', border: '1px solid rgba(166,106,31,0.12)', padding: '9px 8px' }}>
      <div style={{ color: GOLD, fontSize: 20, fontWeight: 950 }}>{value}</div>
      <div style={{ color: 'rgba(71,85,105,0.62)', fontSize: 12, fontWeight: 800 }}>{label}</div>
    </div>
  );
}

const inputStyle: React.CSSProperties = { boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(166,106,31,0.20)', background: '#fff', color: INK, outline: 'none', fontSize: 14 };
const ghostButton: React.CSSProperties = { border: '1px solid rgba(166,106,31,0.22)', borderRadius: 10, background: '#fffaf2', color: GOLD, padding: '9px 13px', fontWeight: 800, cursor: 'pointer', textDecoration: 'none', fontSize: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' };
const primaryButton: React.CSSProperties = { border: 'none', borderRadius: 10, background: `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`, color: '#fffdf8', padding: '10px 14px', fontWeight: 900, cursor: 'pointer', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' };
const cardStyle: React.CSSProperties = { padding: 16, borderRadius: 14, border: '1px solid rgba(166,106,31,0.16)', background: '#fff', boxShadow: '0 10px 26px rgba(102,70,30,0.06)' };
const emptyStyle: React.CSSProperties = { padding: 28, borderRadius: 14, border: '1px dashed rgba(166,106,31,0.22)', background: '#fff', color: MUTED, textAlign: 'center', lineHeight: 1.8 };
const rankBadge: React.CSSProperties = { display: 'inline-flex', borderRadius: 999, padding: '3px 9px', background: 'rgba(166,106,31,0.10)', color: GOLD, fontSize: 12, fontWeight: 950 };
const typeBadge: React.CSSProperties = { display: 'inline-flex', borderRadius: 999, padding: '3px 9px', background: 'rgba(239,246,255,0.88)', color: '#275389', fontSize: 12, fontWeight: 900 };
const tagStyle: React.CSSProperties = { padding: '3px 8px', borderRadius: 999, background: 'rgba(239,246,255,0.88)', color: '#275389', fontSize: 12, fontWeight: 800 };
const cityHeroStyle: React.CSSProperties = { padding: 24, borderRadius: 14, background: 'linear-gradient(135deg, #eef6ff 0%, #fff8e8 100%)', border: '1px solid rgba(39,83,137,0.12)', display: 'grid', gap: 18 };
const cityFilterStyle: React.CSSProperties = { display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', padding: 12, borderRadius: 10, background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(31,41,55,0.07)' };
const cityBodyStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 18, alignItems: 'start' };
const ruleCardStyle: React.CSSProperties = { borderRadius: 14, border: '1px solid rgba(217,168,87,0.24)', background: '#1f2937', padding: 18 };
