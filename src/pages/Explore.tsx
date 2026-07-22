import { useMemo, useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { Creator, PaginatedResponse } from '../types';
import { CITIES } from '../constants/cities';
import { getJsonCached } from '../lib/apiCache';
import { generatedAvatarDataUrl } from '../lib/avatar';
import { creatorEntryPath, readStoredCreatorAuth } from '../lib/authSession';
import { primaryDisplayIdentityRole } from '../lib/serviceCategories';
import { formatTravelStatus } from '../lib/travelStatus';
import { JumuluCompactHeader, JumuluPageFrame } from '../components/JumuluPageChrome';
import { jumuluCardStyle, jumuluFilterPanelStyle, jumuluPrimaryLinkStyle, jumuluSecondaryLinkStyle } from '../styles/jumuluPageStyles';

const API = '/api';
const GOLD = '#d9a857';
const PAPER = '#1f2937';
const PAPER_DIM = 'rgba(71,85,105,0.76)';

const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'player', label: '玩家' },
  { key: 'dm', label: 'DM' },
  { key: 'creator', label: '服务者' },
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
  creator: '服务者',
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
  const [searchParams] = useSearchParams();
  const entryPath = creatorEntryPath();
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [city, setCity] = useState(() => {
    const fromUrl = searchParams.get('city');
    if (fromUrl && CITIES.includes(fromUrl)) return fromUrl;
    try { return localStorage.getItem('lc:explore:last-city') || 'all'; } catch { return 'all'; }
  });
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
    try { localStorage.setItem('lc:explore:last-city', c); } catch { /* optional */ }
    setPage(1);
    setCityOpen(false);
    setCityQuery('');
  };

  useEffect(() => {
    const auth = readStoredCreatorAuth();
    if (!auth?.token || city !== 'all' || searchParams.get('city')) return;
    try { if (localStorage.getItem('lc:explore:last-city') !== null) return; } catch { /* optional */ }
    fetch(`${API}/lc/follows`, { headers: { Authorization: `Bearer ${auth.token}` } })
      .then(response => response.json())
      .then(payload => {
        const followedCity = payload.success ? payload.data?.cities?.[0] : '';
        if (!followedCity) return;
        setCity(followedCity);
        try { localStorage.setItem('lc:explore:last-city', followedCity); } catch { /* optional */ }
      })
      .catch(() => undefined);
  }, [city, searchParams]);

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
  return (
    <JumuluPageFrame currentLabel="公开主页">
      <JumuluCompactHeader
        eyebrow="主页发现"
        title="看看同城的人"
        description="默认按关注城市查看常驻本地和已声明可远征到本地的人；发布了服务的人会同时展示报价与档期。"
        aside={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Link to="/commissions" style={jumuluSecondaryLinkStyle}>查看委托</Link>
            <Link to={entryPath} style={jumuluPrimaryLinkStyle}>上架我的服务</Link>
          </div>
        }
      />

      <section style={jumuluFilterPanelStyle}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, minWidth: 0 }}>
            {FILTERS.map(({ key, label }) => {
              const active = filter === key;
              return (
                <button key={key} onClick={() => setFilterAndReset(key)}
                  style={{
                    minHeight: 36, padding: '8px 13px', borderRadius: 7, fontSize: '0.82rem',
                    cursor: 'pointer',
                    fontWeight: active ? 800 : 600,
                    border: active ? `1px solid ${GOLD}` : '1px solid rgba(217,168,87,0.14)',
                    background: active ? 'rgba(217,168,87,0.16)' : '#fff',
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
        {!loading && !error && (
          <p style={{ margin: '10px 0 0', color: PAPER_DIM, fontSize: 12 }}>
            当前显示 {filtered.length} 个公开主页{city !== 'all' ? ` · ${city}` : ''}
          </p>
        )}
      </section>

      <section>
        {error && (
          <div style={stateWrap}>
            <div style={{ fontSize: 34, marginBottom: 14, color: GOLD }}>✦</div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.3rem', fontWeight: 900, color: PAPER, marginBottom: 8 }}>
              公开主页暂时没连上
            </h2>
            <p style={{ color: PAPER_DIM, lineHeight: 1.8, marginBottom: 18 }}>
              可能是网络或服务接口短暂波动。你可以刷新重试，或者先去委托需求墙挂一条需求。
            </p>
            <p style={{ color: 'rgba(252,165,165,0.86)', fontSize: '0.84rem', marginBottom: 22 }}>{error}</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => window.location.reload()} style={textButton}>重新加载</button>
              <Link to="/commissions/new" style={jumuluSecondaryLinkStyle}>发布委托需求</Link>
            </div>
          </div>
        )}

        {loading && !error && (
          <div style={stateWrap}>
            <div style={{ width: 40, height: 40, border: '2px solid rgba(217,168,87,0.26)', borderTopColor: GOLD, borderRadius: '50%', margin: '0 auto 20px', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ color: PAPER_DIM }}>正在读取公开主页...</p>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div style={{ padding: '56px 20px', border: '1px dashed rgba(217,168,87,0.28)', borderRadius: 8, background: 'rgba(255,250,242,0.82)' }}>
            <div style={{ maxWidth: 580, margin: '0 auto', textAlign: 'center' }}>
              <div style={{ fontSize: 42, marginBottom: 16, color: GOLD }}>✦</div>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.35rem', fontWeight: 900, color: PAPER, marginBottom: 10 }}>
                {city !== 'all' ? `${city} 暂无公开主页` : filter === 'all' ? '还没有公开主页' : '这个身份暂时没有公开主页'}
              </h2>
              <p style={{ color: PAPER_DIM, lineHeight: 1.8, marginBottom: 22 }}>
                可以先完善自己的公开主页，也可以发布一条委托需求，让同城的人回应你。
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link to="/commissions/new" style={jumuluPrimaryLinkStyle}>发布委托需求</Link>
                <Link to={entryPath} style={jumuluSecondaryLinkStyle}>我要入驻</Link>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))', gap: 12 }}>
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
      </section>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </JumuluPageFrame>
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
  const displayRole = primaryDisplayIdentityRole(
    creator.role_type,
    creator.identity_roles,
    !!creator.verified_dm,
    !!creator.verified_shop,
  );
  const role = ROLE_LABEL[displayRole] || displayRole || '服务者';
  const tags = Array.isArray(creator.tags) ? creator.tags : [];
  const travelStatus = creator.travel_status ? formatTravelStatus(creator.travel_status, creator.city) : '';
  const availableCities = Array.isArray(creator.available_cities) ? creator.available_cities : [];
  const services = Array.isArray(creator.services) ? creator.services : [];

  return (
    <article className="content-card" style={{ ...jumuluCardStyle, minHeight: 168, padding: 14, display: 'grid', alignContent: 'start', gap: 10, cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <div style={{
          width: 52,
          height: 52,
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
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${creator.avatar_focus_x ?? 50}% ${creator.avatar_focus_y ?? 25}%` }}
          />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <h2 style={{ fontWeight: 900, fontSize: '1rem', color: PAPER, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
              {creator.display_name}
            </h2>
            {creator.is_realname && <span style={{ color: GOLD, fontSize: '0.74rem', flexShrink: 0 }}>⭐</span>}
          </div>
          <div style={{ fontSize: '0.78rem', color: PAPER_DIM, marginTop: 3 }}>
            {creator.city || '地点待补'} · {role}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {services.slice(0, 3).map(service => (
          <span key={service.id} style={{ padding: '5px 8px', borderRadius: 6, background: '#fffaf2', border: '1px solid rgba(217,168,87,0.2)', color: '#65401c', fontSize: '0.76rem', fontWeight: 800 }}>
            {service.service_type} · ¥{Number(service.price).toFixed(Number(service.price) % 1 === 0 ? 0 : 2)}
          </span>
        ))}
        {services.length > 3 && <span style={{ color: PAPER_DIM, fontSize: '0.74rem', alignSelf: 'center' }}>+{services.length - 3} 项</span>}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {creator.commission_match === 'local' && <Tag>本地常驻</Tag>}
        {creator.commission_match === 'expedition' && <Tag>可远征到本地</Tag>}
        {travelStatus && <Tag>{travelStatus}</Tag>}
        {availableCities.slice(0, 2).map(c => <Tag key={c}>{c}</Tag>)}
        {creator.contact_unlock_enabled && <Tag>可联系</Tag>}
      </div>

      {(creator.bio || tags.length > 0) && (
        <p style={{ margin: 0, fontSize: '0.79rem', color: PAPER_DIM, lineHeight: 1.55, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {creator.bio || tags.slice(0, 3).join(' · ')}
        </p>
      )}
    </article>
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

const stateWrap: React.CSSProperties = {
  textAlign: 'center',
  maxWidth: 560,
  margin: '42px auto 0',
  padding: '48px 22px',
  borderRadius: 8,
  border: '1px solid rgba(217,168,87,0.2)',
  background: '#fff',
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
