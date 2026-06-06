import { useEffect, useMemo, useState } from 'react';
import type React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { generatedAvatarDataUrl } from '../lib/avatar';

const API = '/api';
const BG = '#fffdf8';
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

type DossierEvent = {
  id: string;
  type: 'red' | 'black' | 'white';
  subject_name: string;
  subject_type: string;
  subject_city?: string | null;
  content: string;
  author_name: string;
  is_realname: boolean;
  initial_amount: number;
  likes: number;
  dislikes: number;
  joys: number;
  created_at: string;
};

type DossierData = {
  subject_name: string;
  subject_type: string;
  subject_city?: string | null;
  subject_url?: string | null;
  metrics: {
    praise_value: number;
    reputation_value: number;
    praise_people: number;
    event_count: number;
    red_count: number;
    white_count: number;
    black_count: number;
    comment_count: number;
    tags?: string[];
  };
  profile?: {
    id: string;
    display_name: string;
    avatar?: string | null;
    bio?: string | null;
    tags?: string[];
    verified_dm?: boolean;
    verified_shop?: boolean;
  } | null;
  availability?: { id: string; date: string; start_time?: string | null; city?: string | null; location?: string | null; is_booked?: boolean }[];
  role_preferences?: { id: string; script_name: string; role_name: string; role_gender?: string | null; role_tags?: string[]; is_recommended?: boolean; note?: string | null }[];
  events: DossierEvent[];
};

export default function ReputationDossier() {
  const [params] = useSearchParams();
  const subjectName = params.get('subjectName') || '';
  const subjectType = params.get('subjectType') || '';
  const city = params.get('city') || '';
  const [data, setData] = useState<DossierData | null>(null);
  const [loadedKey, setLoadedKey] = useState('');
  const [error, setError] = useState('');

  const requestKey = useMemo(() => `${subjectName}|${subjectType}|${city}`, [subjectName, subjectType, city]);
  const loading = loadedKey !== requestKey;

  useEffect(() => {
    if (!subjectName || !subjectType) return;
    const controller = new AbortController();
    const query = new URLSearchParams({ subjectName, subjectType });
    if (city) query.set('city', city);
    fetch(`${API}/lc/reputation/dossier?${query}`, { signal: controller.signal })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setData(d.data);
          setError('');
        } else {
          setData(null);
          setError(d.error || '档案加载失败');
        }
      })
      .catch(error => {
        if (error?.name !== 'AbortError') {
          setData(null);
          setError('网络错误，档案暂时加载失败');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadedKey(requestKey);
      });
    return () => controller.abort();
  }, [subjectName, subjectType, city, requestKey]);

  const recommendedRoles = useMemo(() => (data?.role_preferences || []).filter(item => item.is_recommended), [data]);
  const availableSlots = useMemo(() => (data?.availability || []).filter(item => !item.is_booked).slice(0, 6), [data]);

  if (!subjectName || !subjectType) {
    return <main style={pageStyle}><div style={emptyStyle}>缺少档案对象。请从城市口碑榜进入。</div></main>;
  }

  return (
    <main style={pageStyle}>
      <section style={{ background: 'linear-gradient(135deg, #fffaf2 0%, #eef6ff 100%)', borderBottom: '1px solid rgba(166,106,31,0.16)', padding: '42px 20px 30px' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <Link to="/reputation/city" style={topLink}>返回城市口碑榜</Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginTop: 20 }}>
            <img src={data?.profile?.avatar || generatedAvatarDataUrl(subjectName, `${subjectType}:${subjectName}:${city}`)} alt="" style={{ width: 84, height: 84, borderRadius: 18, objectFit: 'cover', border: '1px solid rgba(166,106,31,0.20)', background: '#fffaf2' }} />
            <div>
              <p style={{ margin: '0 0 6px', color: '#92400e', fontWeight: 900, fontSize: 13 }}>{subjectType === 'dm' ? '爱D墙' : '对象档案'}</p>
              <h1 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 'clamp(2rem, 5vw, 3rem)', lineHeight: 1.15 }}>{subjectName}</h1>
              <p style={{ margin: '8px 0 0', color: MUTED }}>
                {SUBJECT_LABEL[subjectType] || subjectType}{city ? ` · ${city}` : ''}{data?.profile?.verified_dm ? ' · 已认证 DM' : ''}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section style={{ maxWidth: 1080, margin: '0 auto', padding: '24px 20px 82px' }}>
        {loading ? (
          <p style={{ color: MUTED, padding: '36px 0' }}>加载中...</p>
        ) : error ? (
          <div style={emptyStyle}>{error}</div>
        ) : data ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
              <Metric label="打榜值" value={data.metrics.praise_value} />
              <Metric label="口碑值" value={data.metrics.reputation_value} />
              <Metric label="打榜人数" value={data.metrics.praise_people} />
              <Metric label="事件数" value={data.metrics.event_count} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(260px, 0.8fr)', gap: 14, alignItems: 'start' }}>
              <section style={cardStyle}>
                <h2 style={sectionTitle}>事件沉淀</h2>
                <p style={{ margin: '0 0 14px', color: MUTED, lineHeight: 1.7, fontSize: 14 }}>
                  红黑榜主榜仍然记录具体事件；这里把与这个对象有关的事件聚合起来，作为新人判断口碑的档案。
                </p>
                <div style={{ display: 'grid', gap: 10 }}>
                  {data.events.length === 0 ? (
                    <div style={emptyStyle}>暂无事件记录。</div>
                  ) : data.events.map(event => (
                    <article key={event.id} style={{ borderRadius: 12, border: '1px solid rgba(166,106,31,0.12)', background: '#fffaf2', padding: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                        <span style={{ ...pillStyle, color: event.type === 'black' ? '#475569' : event.type === 'red' ? '#b91c1c' : GOLD }}>
                          {event.type === 'red' ? '红榜事件' : event.type === 'black' ? '黑榜事件' : '白榜记录'}
                        </span>
                        <span style={{ color: 'rgba(71,85,105,0.58)', fontSize: 13 }}>
                          {event.is_realname ? `实名玩家 ${event.author_name}` : event.author_name} · {event.created_at?.slice(0, 10)}
                        </span>
                      </div>
                      <p style={{ margin: '0 0 10px', color: 'rgba(31,41,55,0.86)', lineHeight: 1.75 }}>{event.content}</p>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', color: 'rgba(71,85,105,0.68)', fontSize: 13 }}>
                        <span>打榜 {event.likes || 0}</span>
                        <span>欢乐 {event.joys || 0}</span>
                        {event.dislikes > 0 && <span>争议 {event.dislikes}</span>}
                        <Link to="/rankings" style={{ color: GOLD, textDecoration: 'none', fontWeight: 800 }}>去事件榜</Link>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <aside style={{ display: 'grid', gap: 14 }}>
                <section style={cardStyle}>
                  <h2 style={sectionTitle}>{subjectType === 'dm' ? '爱D墙信息' : '档案信息'}</h2>
                  {data.profile ? (
                    <>
                      {data.profile.bio && <p style={{ color: MUTED, lineHeight: 1.7, margin: '0 0 10px' }}>{data.profile.bio}</p>}
                      <Link to={`/explore/${data.profile.id}`} style={primaryButton}>查看灵契主页</Link>
                    </>
                  ) : (
                    <p style={{ color: MUTED, lineHeight: 1.7, margin: 0 }}>这个对象暂未认领主页，后续可以通过爱D墙或身份认证绑定。</p>
                  )}
                  {data.subject_url && <a href={normalizeExternalUrl(data.subject_url)} target="_blank" rel="noreferrer" style={{ ...ghostButton, marginTop: 10 }}>外部主页</a>}
                </section>

                {availableSlots.length > 0 && (
                  <section style={cardStyle}>
                    <h2 style={sectionTitle}>最近可约档期</h2>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {availableSlots.map(slot => (
                        <div key={slot.id} style={{ borderRadius: 10, background: '#fffaf2', border: '1px solid rgba(166,106,31,0.12)', padding: '8px 10px', color: MUTED, fontSize: 14 }}>
                          {slot.date}{slot.start_time ? ` ${slot.start_time}` : ''}{slot.city ? ` · ${slot.city}` : ''}{slot.location ? ` · ${slot.location}` : ''}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {recommendedRoles.length > 0 && (
                  <section style={cardStyle}>
                    <h2 style={sectionTitle}>推荐角色</h2>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {recommendedRoles.slice(0, 8).map(role => (
                        <div key={role.id} style={{ borderRadius: 10, background: '#fffaf2', border: '1px solid rgba(166,106,31,0.12)', padding: '8px 10px' }}>
                          <strong style={{ color: INK }}>{role.role_name}</strong>
                          <p style={{ color: MUTED, margin: '4px 0 0', fontSize: 13 }}>{role.script_name}{role.role_gender ? ` · ${role.role_gender}` : ''}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {data.metrics.tags && data.metrics.tags.length > 0 && (
                  <section style={cardStyle}>
                    <h2 style={sectionTitle}>玩家标签</h2>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {data.metrics.tags.map(tag => <span key={tag} style={tagStyle}>{tag}</span>)}
                    </div>
                  </section>
                )}
              </aside>
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div style={metricStyle}>
      <div style={{ color: GOLD, fontSize: 24, fontWeight: 950 }}>{value}</div>
      <div style={{ color: 'rgba(71,85,105,0.62)', fontSize: 13, fontWeight: 800 }}>{label}</div>
    </div>
  );
}

function normalizeExternalUrl(url: string) {
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

const pageStyle: React.CSSProperties = { minHeight: '100vh', background: BG, color: INK };
const topLink: React.CSSProperties = { color: '#275389', textDecoration: 'none', fontSize: 14, fontWeight: 800 };
const cardStyle: React.CSSProperties = { padding: 16, borderRadius: 14, border: '1px solid rgba(166,106,31,0.16)', background: '#fff', boxShadow: '0 10px 26px rgba(102,70,30,0.06)' };
const metricStyle: React.CSSProperties = { borderRadius: 14, background: '#fff', border: '1px solid rgba(166,106,31,0.14)', padding: 14, boxShadow: '0 10px 26px rgba(102,70,30,0.05)' };
const sectionTitle: React.CSSProperties = { margin: '0 0 10px', fontFamily: 'var(--font-serif)', fontSize: '1.18rem', fontWeight: 900 };
const emptyStyle: React.CSSProperties = { padding: 24, borderRadius: 14, border: '1px dashed rgba(166,106,31,0.22)', background: '#fff', color: MUTED, textAlign: 'center', lineHeight: 1.8 };
const pillStyle: React.CSSProperties = { padding: '3px 9px', borderRadius: 999, background: 'rgba(166,106,31,0.08)', border: '1px solid rgba(166,106,31,0.14)', fontSize: 12, fontWeight: 900 };
const tagStyle: React.CSSProperties = { padding: '3px 8px', borderRadius: 999, background: 'rgba(239,246,255,0.88)', color: '#275389', fontSize: 12, fontWeight: 800 };
const primaryButton: React.CSSProperties = { border: 'none', borderRadius: 10, background: `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`, color: '#fffdf8', padding: '10px 14px', fontWeight: 900, cursor: 'pointer', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' };
const ghostButton: React.CSSProperties = { border: '1px solid rgba(166,106,31,0.22)', borderRadius: 10, background: '#fffaf2', color: GOLD, padding: '9px 13px', fontWeight: 800, cursor: 'pointer', textDecoration: 'none', fontSize: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' };
