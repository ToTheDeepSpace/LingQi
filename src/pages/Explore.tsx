import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { Creator, PaginatedResponse } from '../types';
import { CITIES } from '../constants/cities';
import InfoTip from '../components/InfoTip';
import { getJsonCached } from '../lib/apiCache';
import { generatedAvatarDataUrl } from '../lib/avatar';
import { creatorEntryPath } from '../lib/authSession';

const API = '/api';
const C = '#fffdf8';
const C2 = '#eef6ff';
const GOLD = '#d9a857';
const PAPER = '#1f2937';
const PAPER_DIM = 'rgba(71,85,105,0.76)';

const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'player', label: '玩家' },
  { key: 'dm', label: 'DM' },
  { key: 'creator', label: '灵契师' },
  { key: 'photographer', label: '摄影师' },
  { key: 'makeup', label: '妆造师' },
  { key: 'costume', label: '服装商' },
  { key: 'prop', label: '道具师' },
];

const ROLE_LABEL: Record<string, string> = {
  player: '玩家',
  dm: 'DM',
  shop: '店家',
  store: '店家',
  creator: '灵契师',
  photographer: '摄影师',
  makeup: '妆造师',
  costume: '服装商',
  prop: '道具师',
  coser: 'Coser',
};

const POPULAR_CITIES = ['北京', '上海', '广州', '深圳', '杭州', '成都', '重庆', '武汉', '南京', '长沙', '西安', '天津'];

const cityScrollStyle: React.CSSProperties = {
  maxHeight: 260,
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  WebkitOverflowScrolling: 'touch',
};

export default function Explore() {
  const entryPath = creatorEntryPath();
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [city, setCity] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [cityOpen, setCityOpen] = useState(false);
  const [cityQuery, setCityQuery] = useState('');

  useEffect(() => {
    let alive = true;
    const loadCreators = async () => {
      setLoading(true);
      setError('');
      const cityParam = city !== 'all' ? `&city=${encodeURIComponent(city)}` : '';
      try {
        const { ok, status, data: d } = await getJsonCached<{ success: boolean; data?: PaginatedResponse<Creator>; error?: string }>(
          `${API}/lc/creators?page=${page}&limit=12${cityParam}`,
          undefined,
          20_000,
        );
        if (!ok) throw new Error(`请求失败 (${status})`);
        if (!alive) return;
        if (d.success) {
          const paged = d.data || { items: [], totalPages: 1 };
          setCreators(paged.items || []);
          setTotalPages(paged.totalPages || 1);
        } else setError(d.error || '加载失败');
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : '网络错误');
      } finally {
        if (alive) setLoading(false);
      }
    };
    void loadCreators();
    return () => {
      alive = false;
    };
  }, [page, city]);

  const setFilterAndReset = (f: string) => {
    setFilter(f);
    setPage(1);
  };

  const setCityAndReset = (c: string) => {
    setCity(c);
    setPage(1);
    setCityOpen(false);
    setCityQuery('');
  };

  const hasIdentity = (creator: Creator, key: string) => {
    const identityRoles = Array.isArray(creator.identity_roles) ? creator.identity_roles : [];
    const roles = new Set([
      creator.role_type,
      creator.role,
      ...identityRoles,
      creator.verified_dm ? 'dm' : '',
      creator.verified_shop ? 'shop' : '',
    ].filter(Boolean));
    return roles.has(key);
  };
  const filtered = filter === 'all' ? creators : creators.filter(c => hasIdentity(c, filter));
  const creatorCountText = loading ? '正在加载' : `${filtered.length} 位可委托`;

  return (
    <div style={{ backgroundColor: C, minHeight: '100vh', color: PAPER }}>
      <div style={{
        background: `radial-gradient(circle at 16% 0%, rgba(217,168,87,0.16), transparent 34%), linear-gradient(135deg, ${C2}, #fffaf2)`,
        borderBottom: '1px solid rgba(217,168,87,0.2)',
        padding: '52px 20px 34px',
      }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <div className="gold-line" style={{ marginBottom: 16 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24, flexWrap: 'wrap' }}>
            <div style={{ maxWidth: 690 }}>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: 'clamp(1.85rem, 4vw, 2.75rem)', marginBottom: 10, color: PAPER }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  灵契师主页
                  <InfoTip>这里只展示已经提交并通过服务审核的人。查看主页、档期、可接城市和社交展示；想要指定角色或日期，也可以先去委托需求墙挂一段愿望。</InfoTip>
                </span>
              </h1>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link to="/commissions" style={secondaryAction}>委托需求墙</Link>
              <Link to={entryPath} className="btn-gold" style={{ padding: '10px 20px', textDecoration: 'none', fontSize: '0.9rem' }}>
                入驻灵契
              </Link>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginTop: 28 }}>
            <Metric label="当前筛选" value={filter === 'all' ? '全部身份' : FILTERS.find(f => f.key === filter)?.label || filter} />
            <Metric label="城市" value={city === 'all' ? '全国' : city} />
            <Metric label="结果" value={creatorCountText} />
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '28px 20px 80px' }}>
        <div style={{ display: 'flex', gap: 14, marginBottom: 24, alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, minWidth: 0 }}>
            {FILTERS.map(({ key, label }) => {
              const active = filter === key;
              return (
                <button key={key} onClick={() => setFilterAndReset(key)}
                  style={{
                    minHeight: 36,
                    padding: '8px 15px',
                    borderRadius: 999,
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    fontWeight: active ? 800 : 600,
                    border: active ? `1px solid ${GOLD}` : '1px solid rgba(217,168,87,0.14)',
                    background: active ? 'rgba(217,168,87,0.16)' : 'rgba(255,255,255,0.82)',
                    color: active ? '#925f18' : 'rgba(71,85,105,0.78)',
                  }}>
                  {label}
                </button>
              );
            })}
          </div>

          <SearchableCitySelect
            open={cityOpen}
            city={city}
            query={cityQuery}
            onToggle={() => setCityOpen(!cityOpen)}
            onQuery={setCityQuery}
            onSelect={setCityAndReset}
            onClose={() => setCityOpen(false)}
          />
        </div>

        {error && (
          <div style={stateWrap}>
            <div style={{ fontSize: 34, marginBottom: 14, color: GOLD }}>✦</div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.3rem', fontWeight: 900, color: PAPER, marginBottom: 8 }}>
              灵契师主页暂时没连上
            </h2>
            <p style={{ color: PAPER_DIM, lineHeight: 1.8, marginBottom: 18 }}>
              可能是网络或服务接口短暂波动。你可以刷新重试，或者先去委托需求墙挂一条需求。
            </p>
            <p style={{ color: 'rgba(252,165,165,0.86)', fontSize: '0.84rem', marginBottom: 22 }}>{error}</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => window.location.reload()} style={textButton}>重新加载</button>
              <Link to="/commissions/new" style={secondaryAction}>发布委托需求</Link>
            </div>
          </div>
        )}

        {loading && !error && (
          <div style={stateWrap}>
            <div style={{ width: 40, height: 40, border: '2px solid rgba(217,168,87,0.26)', borderTopColor: GOLD, borderRadius: '50%', margin: '0 auto 20px', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ color: PAPER_DIM }}>正在召唤灵契师...</p>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div style={{ padding: '56px 20px', border: '1px dashed rgba(217,168,87,0.28)', borderRadius: 8, background: 'rgba(255,250,242,0.82)' }}>
            <div style={{ maxWidth: 580, margin: '0 auto', textAlign: 'center' }}>
              <div style={{ fontSize: 42, marginBottom: 16, color: GOLD }}>✦</div>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.35rem', fontWeight: 900, color: PAPER, marginBottom: 10 }}>
                {city !== 'all' ? `${city} 暂无公开主页` : filter === 'all' ? '还在等待第一批灵契师' : '这个身份暂时没有公开主页'}
              </h2>
              <p style={{ color: PAPER_DIM, lineHeight: 1.8, marginBottom: 22 }}>
                可以先发布一条委托需求，让合适的人来回应你；也可以自己入驻，提交服务并通过审核后再出现在这里。
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link to="/commissions/new" className="btn-gold" style={{ padding: '10px 20px', textDecoration: 'none' }}>发布委托需求</Link>
                <Link to={entryPath} style={secondaryAction}>我要入驻</Link>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
              {filtered.map(c => (
                <Link key={c.id} to={`/explore/${c.id}`} style={{ textDecoration: 'none' }}>
                  <CreatorCard creator={c} />
                </Link>
              ))}
            </div>

            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginTop: 42 }}>
                <PageBtn onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>上一页</PageBtn>
                <span style={{ fontSize: '0.875rem', color: PAPER_DIM }}>{page} / {totalPages}</span>
                <PageBtn onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>下一页</PageBtn>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function SearchableCitySelect({
  open, city, query, onToggle, onQuery, onSelect, onClose,
}: {
  open: boolean;
  city: string;
  query: string;
  onToggle: () => void;
  onQuery: (value: string) => void;
  onSelect: (city: string) => void;
  onClose: () => void;
}) {
  const matchedCities = useMemo(() => {
    const q = query.trim();
    if (!q) return CITIES;
    return CITIES.filter(c => c.includes(q));
  }, [query]);

  return (
    <div style={{ position: 'relative', marginLeft: 'auto' }}>
      <button onClick={onToggle}
        style={{
          minHeight: 36,
          padding: '8px 15px',
          borderRadius: 999,
          fontSize: '0.875rem',
          cursor: 'pointer',
          border: city !== 'all' ? `1px solid ${GOLD}` : '1px solid rgba(217,168,87,0.22)',
          background: city !== 'all' ? 'rgba(217,168,87,0.14)' : 'rgba(255,255,255,0.82)',
          color: city !== 'all' ? '#925f18' : 'rgba(71,85,105,0.78)',
          fontWeight: 800,
          whiteSpace: 'nowrap',
        }}>
        {city === 'all' ? '全部城市' : city} ▾
      </button>

      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={onClose} />
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            zIndex: 50,
            width: 'min(360px, calc(100vw - 32px))',
            padding: 12,
            borderRadius: 8,
            background: '#fffdf8',
            border: '1px solid rgba(217,168,87,0.28)',
            boxShadow: '0 18px 48px rgba(31,41,55,0.16)',
          }}
            onWheel={e => e.stopPropagation()}
            onTouchMove={e => e.stopPropagation()}>
            <input
              autoFocus
              value={query}
              onChange={e => onQuery(e.target.value)}
              placeholder="搜索城市，例如：保定、上海"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid rgba(217,168,87,0.24)',
                background: '#fff',
                color: PAPER,
                outline: 'none',
                marginBottom: 10,
              }}
            />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              <CityOption active={city === 'all'} onClick={() => onSelect('all')}>全部</CityOption>
              {POPULAR_CITIES.map(c => (
                <CityOption key={c} active={city === c} onClick={() => onSelect(c)}>{c}</CityOption>
              ))}
            </div>
            <div style={{ height: 1, background: 'rgba(217,168,87,0.18)', marginBottom: 8 }} />
            <div style={{ ...cityScrollStyle, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 4 }}>
              {matchedCities.length > 0 ? matchedCities.map(c => (
                <button key={c} onClick={() => onSelect(c)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: 'none',
                    cursor: 'pointer',
                    background: city === c ? 'rgba(217,168,87,0.16)' : 'transparent',
                    color: city === c ? '#925f18' : 'rgba(71,85,105,0.78)',
                    fontSize: '0.84rem',
                    fontWeight: city === c ? 800 : 500,
                    textAlign: 'left',
                  }}>
                  {c}
                </button>
              )) : (
                <p style={{ gridColumn: '1 / -1', color: 'rgba(71,85,105,0.62)', fontSize: '0.84rem', padding: '16px 4px' }}>
                  没搜到这个城市，可以先选全部城市。
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function CreatorCard({ creator }: { creator: Creator }) {
  const displayRole = creator.verified_dm && (!creator.role_type || creator.role_type === 'player')
    ? 'dm'
    : creator.role_type || creator.identity_roles?.[0] || '';
  const role = ROLE_LABEL[displayRole] || displayRole || '灵契师';
  const tags = Array.isArray(creator.tags) ? creator.tags : [];
  const travelStatus = creator.travel_status;
  const availableCities = Array.isArray(creator.available_cities) ? creator.available_cities : [];

  return (
    <article className="content-card" style={{
      minHeight: 210,
      background: 'linear-gradient(180deg, #ffffff, #fffaf2)',
      border: '1px solid rgba(217,168,87,0.2)',
      borderRadius: 8,
      padding: 18,
      transition: 'transform 0.18s ease, border-color 0.18s ease, background 0.18s ease',
      cursor: 'pointer',
      boxShadow: '0 12px 30px rgba(31,41,55,0.06)',
    }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'linear-gradient(180deg, #ffffff, #fff7ed)';
        e.currentTarget.style.borderColor = 'rgba(217,168,87,0.42)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'linear-gradient(180deg, #ffffff, #fffaf2)';
        e.currentTarget.style.borderColor = 'rgba(217,168,87,0.2)';
        e.currentTarget.style.transform = 'none';
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
        <div style={{
          width: 58,
          height: 58,
          borderRadius: 8,
          flexShrink: 0,
          background: 'linear-gradient(135deg, rgba(217,168,87,0.24), rgba(107,63,160,0.16))',
          border: '1px solid rgba(217,168,87,0.28)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          fontSize: 23,
          color: GOLD,
          fontWeight: 900,
        }}>
          <img
            src={creator.avatar || generatedAvatarDataUrl(creator.display_name, creator.id)}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <h2 style={{ fontWeight: 900, fontSize: '1rem', color: PAPER, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
              {creator.display_name}
            </h2>
            {creator.is_realname && <span style={{ color: GOLD, fontSize: '0.74rem', flexShrink: 0 }}>⭐</span>}
          </div>
          <div style={{ fontSize: '0.8rem', color: PAPER_DIM, marginTop: 4 }}>
            {creator.city || '地点待补'} · {role}
          </div>
        </div>
      </div>

      {creator.bio ? (
        <p style={{ fontSize: '0.86rem', color: 'rgba(71,85,105,0.76)', lineHeight: 1.75, marginBottom: 14, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {creator.bio}
        </p>
      ) : (
        <p style={{ fontSize: '0.86rem', color: 'rgba(71,85,105,0.64)', lineHeight: 1.75, marginBottom: 14 }}>
          主页资料还在补全中，可以先查看档期、服务与联系方式入口。
        </p>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
        {travelStatus && <Tag>{travelStatus}</Tag>}
        {creator.contact_unlock_enabled && <Tag>预约意向金</Tag>}
        {availableCities.slice(0, 2).map(c => <Tag key={c}>{c}</Tag>)}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {tags.slice(0, 4).map(t => <Tag key={t} muted>{t}</Tag>)}
        {tags.length > 4 && <span style={{ color: 'rgba(71,85,105,0.58)', fontSize: '0.75rem', alignSelf: 'center' }}>+{tags.length - 4}</span>}
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: '1px solid rgba(217,168,87,0.18)', background: 'rgba(255,255,255,0.76)', borderRadius: 8, padding: '12px 14px' }}>
      <div style={{ color: 'rgba(71,85,105,0.62)', fontSize: '0.76rem', marginBottom: 4 }}>{label}</div>
      <div style={{ color: PAPER, fontWeight: 900, fontSize: '0.96rem' }}>{value}</div>
    </div>
  );
}

function CityOption({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{ padding: '6px 10px', borderRadius: 999, border: active ? `1px solid ${GOLD}` : '1px solid rgba(217,168,87,0.18)', background: active ? 'rgba(217,168,87,0.16)' : '#fff', color: active ? '#925f18' : 'rgba(71,85,105,0.74)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: active ? 800 : 600 }}>
      {children}
    </button>
  );
}

function Tag({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <span style={{ padding: '4px 9px', borderRadius: 999, fontSize: '0.73rem', background: muted ? 'rgba(239,246,255,0.86)' : 'rgba(217,168,87,0.12)', border: muted ? '1px solid rgba(125,147,170,0.16)' : '1px solid rgba(217,168,87,0.22)', color: muted ? '#275389' : '#925f18' }}>
      {children}
    </span>
  );
}

function PageBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        minHeight: 38,
        padding: '9px 18px',
        borderRadius: 8,
        fontSize: '0.875rem',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: 'rgba(255,255,255,0.82)',
        border: '1px solid rgba(217,168,87,0.16)',
        color: disabled ? 'rgba(71,85,105,0.36)' : PAPER_DIM,
      }}>
      {children}
    </button>
  );
}

const secondaryAction: React.CSSProperties = {
  padding: '10px 18px',
  borderRadius: 8,
  border: '1px solid rgba(217,168,87,0.28)',
  color: GOLD,
  textDecoration: 'none',
  fontSize: '0.9rem',
  fontWeight: 800,
};

const stateWrap: React.CSSProperties = {
  textAlign: 'center',
  maxWidth: 560,
  margin: '42px auto 0',
  padding: '48px 22px',
  borderRadius: 8,
  border: '1px solid rgba(217,168,87,0.2)',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.9), rgba(255,250,242,0.82))',
};

const textButton: React.CSSProperties = {
  background: 'rgba(217,168,87,0.14)',
  border: '1px solid rgba(217,168,87,0.32)',
  borderRadius: 8,
  color: GOLD,
  cursor: 'pointer',
  fontWeight: 800,
  fontSize: '0.875rem',
  padding: '10px 18px',
};
