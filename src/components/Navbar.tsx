import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { isTokenExpired, readStoredCreatorAuth, type StoredCreatorAuth } from '../lib/authSession';
import { preloadRoute } from '../lib/routePreload';
import BrandLogo from './BrandLogo';

const BG = 'rgba(255,253,248,0.94)';
const GOLD = '#d9a857';
const INK = '#1f2937';
const MUTED = 'rgba(71,85,105,0.76)';
const API = '/api';

function handleLogout() {
  localStorage.removeItem('lc_creator');
  localStorage.removeItem('lc_admin_token');
  window.dispatchEvent(new Event('lc-auth-changed'));
  window.location.href = '/';
}

function readCreatorAuth(): StoredCreatorAuth | null {
  return readStoredCreatorAuth();
}

function readAdminToken() {
  const token = localStorage.getItem('lc_admin_token') || '';
  return token && !isTokenExpired(token) ? token : '';
}

function readAuthSnapshot() {
  const creatorAuth = readCreatorAuth();
  const storedAdminToken = readAdminToken();
  const creatorAdminToken = creatorAuth?.role === 'admin' ? creatorAuth.token || '' : '';
  return {
    creatorAuth,
    adminToken: storedAdminToken || creatorAdminToken,
  };
}

export default function Navbar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [authSnapshot, setAuthSnapshot] = useState(readAuthSnapshot);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const { creatorAuth, adminToken } = authSnapshot;
  const isLoggedIn = !!creatorAuth;
  const isAdmin = !!adminToken;
  const isShop = Boolean(creatorAuth?.verified_shop || creatorAuth?.role === 'shop' || creatorAuth?.identity_roles?.includes('shop'));
  const isHome = pathname === '/';
  const mobileIdentity = creatorAuth?.display_name || creatorAuth?.phone || creatorAuth?.email || (isAdmin ? '管理员' : '');
  const currentPageLabel = locationLabelFor(pathname);
  const adminActive = pathname.startsWith('/admin');

  useEffect(() => {
    const syncAuth = () => setAuthSnapshot(readAuthSnapshot());
    window.addEventListener('storage', syncAuth);
    window.addEventListener('focus', syncAuth);
    window.addEventListener('lc-auth-changed', syncAuth);
    return () => {
      window.removeEventListener('storage', syncAuth);
      window.removeEventListener('focus', syncAuth);
      window.removeEventListener('lc-auth-changed', syncAuth);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    if (!adminToken) {
      return () => { alive = false; };
    }
    const loadPending = async () => {
      try {
        const r = await fetch(`${API}/lc/admin/pending`, { headers: { Authorization: `Bearer ${adminToken}` } });
        const d = await r.json();
        if (!alive || !d.success) return;
        const data = d.data || {};
        const pendingProfiles = (data.profiles || []).filter((p: { is_visible?: boolean; reject_reason?: string | null }) => !p.is_visible && !p.reject_reason).length;
        const total = pendingProfiles
          + (data.contactRequests || []).length
          + (data.rankings || []).length
          + (data.comments || []).length
          + (data.claims || []).length
          + (data.commissions || []).length
          + (data.transactions || []).length
          + (data.certifications || []).length
          + (data.reports || []).length
          + (data.siteMessages || []).length
          + (data.accountAppeals || []).length
          + (data.scriptContributions || []).length
          + (data.dmRatings || []).length
          + (data.storeRatings || []).length
          + (data.dmIdentityWithdrawals || []).length
          + (data.guides || []).length
          + (data.guideWithdrawals || []).length;
        const dmDossierCount = (data.dmDossiers || []).length;
        setPendingCount(total + dmDossierCount);
      } catch {
        if (alive) setPendingCount(0);
      }
    };
    void loadPending();
    const timer = window.setInterval(loadPending, 60_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [adminToken]);

  const goBack = () => {
    const historyState = window.history.state as { idx?: number } | null;
    if (historyState?.idx && historyState.idx > 0) {
      navigate(-1);
      return;
    }
    navigate(fallbackPathFor(pathname));
  };

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 50,
      backgroundColor: BG,
      borderBottom: '1px solid rgba(201,146,46,0.22)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      boxShadow: '0 10px 32px rgba(31,41,55,0.06)',
    }}>
      <div style={{
        width: '100%', boxSizing: 'border-box',
        padding: '0 16px', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 16,
      }}>

        {/* 首页显示品牌；其他页面统一显示返回上一级。 */}
        {isHome ? (
          <Link
            className="home-return-link"
            to="/"
            aria-label="剧幕录首页"
            style={brandLinkStyle}
            onMouseEnter={() => preloadRoute('/')}
            onFocus={() => preloadRoute('/')}
          >
            <BrandLogo />
          </Link>
        ) : (
          <button
            type="button"
            onClick={goBack}
            aria-label="返回上一级"
            style={backButtonStyle}
          >
            <span aria-hidden="true" style={backChevronStyle}>‹</span>
            <span>返回</span>
            <span className="hidden lg:inline" style={{ color: 'rgba(71,85,105,0.58)', fontWeight: 760 }}>· {currentPageLabel}</span>
          </button>
        )}

        <span className="lg:hidden" style={mobileLocationStyle} aria-live="polite">
          {currentPageLabel}
        </span>

        {/* 桌面导航 — 右 */}
        <div className="hidden lg:flex" style={{
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 6,
          minWidth: 0,
          flex: '1 1 auto',
          flexWrap: 'nowrap',
          whiteSpace: 'nowrap',
        }}>
          <NavLink to="/dm">DM评分</NavLink>
          <NavLink to="/stores">店家评分</NavLink>
          <NavLink to="/commissions">找/接委托</NavLink>
          <NavLink to="/carpools">拼车区</NavLink>
          <NavLink to="/rankings">红黑榜</NavLink>
          <NavLink to="/scripts">角色点评</NavLink>
          <NavLink to="/guides">攻略交易</NavLink>
          {creatorAuth && <IdentityChip tone="user">用户：{creatorAuth.display_name || creatorAuth.phone || creatorAuth.email || '已登录'}</IdentityChip>}
          {isLoggedIn
            ? <>
              <NavLink to="/dashboard">我的主页</NavLink>
              <NavLink to="/referrals">邀请</NavLink>
              <NavLink to="/certification">认证</NavLink>
              {isShop && <NavLink to="/shop/dashboard">店家后台</NavLink>}
              <button onClick={handleLogout}
                style={{
                  padding: '8px 14px', borderRadius: 8, fontSize: '0.85rem',
                  background: 'rgba(254,242,242,0.78)', border: '1px solid rgba(220,38,38,0.22)', color: '#b91c1c',
                  cursor: 'pointer', fontWeight: 500, transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(220,38,38,0.42)'; e.currentTarget.style.color = '#991b1b'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(220,38,38,0.22)'; e.currentTarget.style.color = '#b91c1c'; }}>
                退出
              </button>
            </>
            : !isAdmin && (
              <Link to="/login" className="btn-gold" style={{ marginLeft: 8, padding: '8px 20px', fontSize: '0.875rem', display: 'inline-block' }}>
                登录 / 注册
              </Link>
            )
          }
          <Link to="/admin" style={{
            marginLeft: 4, padding: '6px 12px', borderRadius: 8, fontSize: '0.78rem',
            color: adminActive || isAdmin ? '#0F1117' : 'rgba(146,95,24,0.68)',
            textDecoration: 'none',
            border: adminActive || isAdmin ? '1px solid rgba(217,168,87,0.75)' : '1px solid rgba(201,146,46,0.15)',
            background: adminActive || isAdmin ? 'linear-gradient(135deg, #f4c873 0%, #d9a857 100%)' : 'transparent',
            fontWeight: adminActive || isAdmin ? 900 : 500,
            transition: 'all 0.2s',
          }}
            aria-current={adminActive ? 'page' : undefined}
            onMouseEnter={e => { if (!isAdmin && !adminActive) { (e.currentTarget as HTMLElement).style.color = GOLD; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(201,146,46,0.4)'; } }}
            onMouseLeave={e => { if (!isAdmin && !adminActive) { (e.currentTarget as HTMLElement).style.color = 'rgba(146,95,24,0.68)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(201,146,46,0.15)'; } }}>
            管理{pendingCount > 0 ? `(${pendingCount})` : ''}
          </Link>
          {isAdmin && !isLoggedIn && (
            <button onClick={handleLogout}
              style={{
                padding: '7px 12px', borderRadius: 8, fontSize: '0.78rem',
                background: 'rgba(254,242,242,0.78)', border: '1px solid rgba(220,38,38,0.22)', color: '#b91c1c',
                cursor: 'pointer', fontWeight: 650, transition: 'all 0.2s',
              }}>
              退出
            </button>
          )}
        </div>

        {/* 移动端身份 + 菜单 — 右 */}
        <div className="flex lg:hidden" style={{ alignItems: 'center', gap: 8, minWidth: 0 }}>
          {isLoggedIn || isAdmin ? (
            <Link
              to={isAdmin ? '/admin' : '/dashboard'}
              style={mobileIdentityStyle(isAdmin)}
              onClick={() => setMenuOpen(false)}
            >
              <span style={{
                width: 7, height: 7, borderRadius: 999,
                background: isAdmin ? '#925f18' : '#15803d',
                flex: '0 0 auto',
              }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {isAdmin ? `管理员${pendingCount > 0 ? ` ${pendingCount}` : ''}` : mobileIdentity}
              </span>
            </Link>
          ) : (
            <Link to="/login" style={mobileLoginStyle} onClick={() => setMenuOpen(false)}>登录</Link>
          )}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? '关闭菜单' : '打开菜单'}
            style={{ background: 'rgba(255,250,242,0.84)', border: '1px solid rgba(201,146,46,0.18)', borderRadius: 10, cursor: 'pointer', padding: 8, color: MUTED, display: 'inline-flex' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {menuOpen
                ? <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
                : <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>
              }
            </svg>
          </button>
        </div>
      </div>

      {/* 移动端下拉菜单 */}
      {menuOpen && (
        <div style={{
          backgroundColor: BG,
          borderTop: '1px solid rgba(201,146,46,0.16)',
          padding: '12px 20px 16px',
          boxShadow: '0 18px 36px rgba(31,41,55,0.08)',
        }}>
          <MobileLink to="/dm" onClick={() => setMenuOpen(false)}>DM评分</MobileLink>
          <MobileLink to="/dm/rate" onClick={() => setMenuOpen(false)}>给DM评分</MobileLink>
          <MobileLink to="/stores" onClick={() => setMenuOpen(false)}>店家评分</MobileLink>
          <MobileLink to="/commissions" onClick={() => setMenuOpen(false)}>找/接委托</MobileLink>
          <MobileLink to="/carpools" onClick={() => setMenuOpen(false)}>拼车区</MobileLink>
          <MobileLink to="/rankings" onClick={() => setMenuOpen(false)}>红黑榜</MobileLink>
          <MobileLink to="/scripts" onClick={() => setMenuOpen(false)}>角色点评</MobileLink>
          <MobileLink to="/guides" onClick={() => setMenuOpen(false)}>攻略交易</MobileLink>
          {creatorAuth && <MobileStatus tone="user">当前用户：{creatorAuth.display_name || creatorAuth.phone || creatorAuth.email || '已登录'}</MobileStatus>}
          {isAdmin && <MobileStatus tone="admin">管理员已登录{pendingCount > 0 ? `，待审 ${pendingCount}` : ''}</MobileStatus>}
          {isLoggedIn
            ? <>
              <MobileLink to="/dashboard" onClick={() => setMenuOpen(false)}>我的主页</MobileLink>
              <MobileLink to="/referrals" onClick={() => setMenuOpen(false)}>我的邀请</MobileLink>
              <MobileLink to="/certification" onClick={() => setMenuOpen(false)}>认证</MobileLink>
              {isShop && <MobileLink to="/shop/dashboard" onClick={() => setMenuOpen(false)}>店家后台</MobileLink>}
              <button onClick={() => { setMenuOpen(false); handleLogout(); }}
                style={{
                  width: '100%', textAlign: 'left', padding: '10px 0', fontSize: '0.9rem',
                  background: 'none', border: 'none', borderBottom: '1px solid rgba(201,146,46,0.12)',
                  color: '#b91c1c', cursor: 'pointer', fontWeight: 500,
                }}>
                退出登录
              </button>
            </>
            : <MobileLink to="/login" gold onClick={() => setMenuOpen(false)}>登录 / 注册 →</MobileLink>
          }
          <MobileLink to="/admin" gold={isAdmin} onClick={() => setMenuOpen(false)}>管理后台{pendingCount > 0 ? ` (${pendingCount})` : ''}</MobileLink>
        </div>
      )}
    </nav>
  );
}

const brandLinkStyle: React.CSSProperties = {
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  flex: '0 0 auto',
  minWidth: 0,
  padding: '7px 10px',
  borderRadius: 12,
  border: '1px solid rgba(201,146,46,0.18)',
  background: 'rgba(255,250,242,0.72)',
  color: INK,
  transition: 'transform 160ms ease, box-shadow 180ms ease, border-color 180ms ease, background 180ms ease',
  willChange: 'transform',
};

const backButtonStyle: React.CSSProperties = {
  appearance: 'none',
  border: 'none',
  background: 'transparent',
  color: '#275389',
  padding: '8px 6px',
  marginLeft: -6,
  borderRadius: 10,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 2,
  cursor: 'pointer',
  fontSize: '0.9rem',
  fontWeight: 800,
  lineHeight: 1,
};

const backChevronStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 900,
  lineHeight: 0.8,
  transform: 'translateY(-1px)',
};

const mobileLoginStyle: React.CSSProperties = {
  maxWidth: 86,
  padding: '7px 10px',
  borderRadius: 999,
  border: '1px solid rgba(201,146,46,0.24)',
  background: 'rgba(255,250,242,0.92)',
  color: '#925f18',
  textDecoration: 'none',
  fontSize: '0.8rem',
  fontWeight: 900,
};

const mobileLocationStyle: React.CSSProperties = {
  minWidth: 0,
  flex: '1 1 auto',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  textAlign: 'center',
  color: '#1f2937',
  fontSize: '0.82rem',
  fontWeight: 900,
};

const mobileIdentityStyle = (admin: boolean): React.CSSProperties => ({
  maxWidth: 142,
  minWidth: 0,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '7px 10px',
  borderRadius: 999,
  border: admin ? '1px solid rgba(217,168,87,0.48)' : '1px solid rgba(22,163,74,0.22)',
  background: admin ? 'rgba(217,168,87,0.18)' : 'rgba(220,252,231,0.78)',
  color: admin ? '#925f18' : '#15803d',
  textDecoration: 'none',
  fontSize: '0.78rem',
  fontWeight: 900,
});

function IdentityChip({ children, tone }: { children: React.ReactNode; tone: 'user' | 'admin' }) {
  const admin = tone === 'admin';
  return (
    <span style={{
      maxWidth: 180,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      padding: '6px 10px',
      borderRadius: 8,
      border: admin ? '1px solid rgba(217,168,87,0.55)' : '1px solid rgba(125,147,170,0.22)',
      background: admin ? 'rgba(217,168,87,0.18)' : 'rgba(239,246,255,0.78)',
      color: admin ? '#925f18' : '#275389',
      fontSize: '0.76rem',
      fontWeight: admin ? 900 : 700,
    }}>
      {children}
    </span>
  );
}

function MobileStatus({ children, tone }: { children: React.ReactNode; tone: 'user' | 'admin' }) {
  const admin = tone === 'admin';
  return (
    <div style={{
      padding: '9px 10px',
      borderRadius: 8,
      margin: '6px 0',
      border: admin ? '1px solid rgba(217,168,87,0.42)' : '1px solid rgba(125,147,170,0.22)',
      background: admin ? 'rgba(217,168,87,0.14)' : 'rgba(239,246,255,0.78)',
      color: admin ? '#925f18' : '#275389',
      fontSize: '0.82rem',
      fontWeight: admin ? 900 : 700,
    }}>
      {children}
    </div>
  );
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  const { pathname } = useLocation();
  const active = to === '/dm'
    ? pathname === '/dm' || pathname === '/dm-wall' || pathname.startsWith('/dm/')
    : isNavPathActive(pathname, to);
  return (
    <Link to={to} aria-current={active ? 'page' : undefined} style={{
      textDecoration: 'none',
      padding: '8px 14px',
      borderRadius: 8,
      fontSize: '0.875rem',
      color: active ? '#925f18' : MUTED,
      background: active ? 'rgba(217,168,87,0.12)' : 'transparent',
      boxShadow: active ? 'inset 0 -2px 0 rgba(185,130,35,0.82)' : 'none',
      transition: 'color 0.2s, background 0.2s',
      fontWeight: active ? 900 : 650,
    }}
      onMouseEnter={e => { preloadRoute(to); e.currentTarget.style.color = INK; e.currentTarget.style.background = 'rgba(217,168,87,0.10)'; }}
      onFocus={() => preloadRoute(to)}
      onMouseLeave={e => {
        e.currentTarget.style.color = active ? '#925f18' : MUTED;
        e.currentTarget.style.background = active ? 'rgba(217,168,87,0.12)' : 'transparent';
      }}>
      {children}
    </Link>
  );
}

function MobileLink({ to, children, gold, onClick }: { to: string; children: React.ReactNode; gold?: boolean; onClick: () => void }) {
  const { pathname } = useLocation();
  const active = isNavPathActive(pathname, to);
  return (
    <Link to={to} onClick={onClick} aria-current={active ? 'page' : undefined} style={{
      display: 'block', textDecoration: 'none',
      padding: active ? '10px 10px' : '10px 0',
      fontSize: '0.9rem',
      color: active ? '#925f18' : gold ? GOLD : MUTED,
      background: active ? 'rgba(217,168,87,0.10)' : 'transparent',
      borderLeft: active ? '3px solid rgba(185,130,35,0.86)' : '3px solid transparent',
      borderBottom: '1px solid rgba(201,146,46,0.12)',
      fontWeight: active ? 900 : gold ? 600 : 400,
    }}
      onTouchStart={() => preloadRoute(to)}
      onFocus={() => preloadRoute(to)}>
      {children}
    </Link>
  );
}

function isNavPathActive(pathname: string, to: string) {
  if (to === '/dm/rate') return pathname.startsWith('/dm/rate');
  if (to === '/dm') return pathname === '/dm' || (pathname.startsWith('/dm/') && !pathname.startsWith('/dm/rate'));
  if (to === '/rankings') return pathname.startsWith('/rankings') || pathname.startsWith('/reputation');
  return pathname === to || pathname.startsWith(`${to}/`);
}

function locationLabelFor(pathname: string) {
  if (pathname === '/') return '首页';
  if (pathname.startsWith('/dm/rate')) return '给DM评分';
  if (pathname.startsWith('/dm/') && pathname !== '/dm-wall') return 'DM档案';
  if (pathname === '/dm' || pathname === '/dm-wall') return 'DM评分';
  if (pathname.startsWith('/chanto')) return '缠头榜';
  if (pathname.startsWith('/stores/rate')) return '给店家评分';
  if (pathname.startsWith('/stores/')) return '店家详情';
  if (pathname === '/stores') return '店家评分';
  if (pathname.startsWith('/commissions/new')) return '发布委托';
  if (pathname.startsWith('/commissions')) return '委托需求';
  if (pathname.startsWith('/carpools/new')) return '发布拼车';
  if (pathname.startsWith('/carpools')) return '拼车区';
  if (pathname.startsWith('/rankings/new')) return '发布评价';
  if (pathname.startsWith('/rankings')) return '红黑榜';
  if (pathname.startsWith('/reputation/city')) return '城市口碑';
  if (pathname.startsWith('/reputation/dossier')) return '口碑档案';
  if (pathname.startsWith('/scripts/rate')) return '添加角色评分';
  if (pathname.startsWith('/scripts/roles/')) return '角色评分详情';
  if (pathname.startsWith('/scripts/contribute')) return '维护剧本库';
  if (pathname.startsWith('/scripts')) return '角色点评';
  if (pathname.startsWith('/guides/new')) return '发布攻略';
  if (pathname.startsWith('/guides/income')) return '创作者收入';
  if (pathname.startsWith('/income')) return '创作者收入';
  if (pathname.startsWith('/guides')) return '攻略交易';
  if (pathname.startsWith('/dashboard/services/availability')) return '可约档期';
  if (pathname.startsWith('/dashboard/services/works')) return '作品集';
  if (pathname.startsWith('/dashboard/services')) return '服务管理';
  if (pathname.startsWith('/dashboard/profile')) return '公开资料';
  if (pathname.startsWith('/dashboard/account')) return '账号安全';
  if (pathname.startsWith('/dashboard/posts')) return '我的发布';
  if (pathname.startsWith('/dashboard')) return '我的主页';
  if (pathname.startsWith('/wallet')) return '钱包';
  if (pathname.startsWith('/referrals')) return '我的邀请';
  if (pathname.startsWith('/certification')) return '身份认证';
  if (pathname.startsWith('/shop/dashboard')) return '店家后台';
  if (pathname.startsWith('/admin')) return '管理后台';
  if (pathname.startsWith('/login')) return '登录注册';
  if (pathname.startsWith('/contact')) return '建议反馈';
  if (pathname.startsWith('/rules')) return '审核规则';
  if (pathname.startsWith('/roadmap')) return '口碑路线图';
  return '剧幕录';
}

function fallbackPathFor(pathname: string) {
  if (pathname.startsWith('/dm/rate') || (pathname.startsWith('/dm/') && pathname !== '/dm-wall') || pathname.startsWith('/chanto')) return '/dm';
  if (pathname.startsWith('/stores/')) return '/stores';
  if (pathname.startsWith('/reputation/dossier')) return '/reputation/city';
  if (pathname.startsWith('/reputation')) return '/rankings';
  if (pathname.startsWith('/explore/')) return '/explore';
  if (pathname.startsWith('/scripts/')) return '/scripts';
  if (pathname.startsWith('/boundary-votes')) return '/roadmap';
  if (pathname.startsWith('/wallet') || pathname.startsWith('/referrals') || pathname.startsWith('/certification') || pathname.startsWith('/income')) return '/dashboard';
  if (pathname.startsWith('/shop/dashboard')) return '/dashboard';
  if (pathname.startsWith('/commissions/new')) return '/commissions';
  if (pathname.startsWith('/carpools/new')) return '/carpools';
  if (pathname.startsWith('/rankings/new')) return '/rankings';
  if (
    pathname.startsWith('/rules') ||
    pathname.startsWith('/moderation') ||
    pathname.startsWith('/terms') ||
    pathname.startsWith('/privacy') ||
    pathname.startsWith('/security-assessment') ||
    pathname.startsWith('/business-license') ||
    pathname.startsWith('/contact')
  ) return '/';
  return '/';
}
