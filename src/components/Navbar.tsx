import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { preloadRoute } from '../lib/routePreload';

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

type CreatorAuth = {
  display_name?: string;
  phone?: string;
  token?: string;
  role?: string;
};

function isTokenExpired(token: string) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

function readCreatorAuth(): CreatorAuth | null {
  try {
    const stored = localStorage.getItem('lc_creator');
    if (!stored) return null;
    const data = JSON.parse(stored) as CreatorAuth;
    if (!data.token || isTokenExpired(data.token)) return null;
    return data;
  } catch {
    return null;
  }
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
  const [authSnapshot, setAuthSnapshot] = useState(readAuthSnapshot);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const { creatorAuth, adminToken } = authSnapshot;
  const isLoggedIn = !!creatorAuth;
  const isAdmin = !!adminToken;
  const isShop = creatorAuth?.role === 'shop';
  const isHome = pathname === '/';

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
          + (data.certifications || []).length;
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
        maxWidth: 1160, margin: '0 auto',
        padding: '0 20px', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 16,
      }}>

        {/* 返回首页 — 左 */}
        <Link
          to="/"
          aria-label={isHome ? '灵契首页' : '返回灵契首页'}
          style={homeLinkStyle(isHome)}
          onMouseEnter={() => preloadRoute('/')}
          onFocus={() => preloadRoute('/')}
        >
          <span aria-hidden="true" style={homeArrowStyle(isHome)}>←</span>
          <span style={{ display: 'grid', gap: 1, minWidth: 0 }}>
            <span style={homeReturnTextStyle}>{isHome ? '灵契首页' : '返回首页'}</span>
            <span className="gradient-text-gold" style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: '1.1rem', lineHeight: 1.05 }}>
              灵契
              <span style={{ marginLeft: 5, fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(146,95,24,0.58)', fontFamily: 'var(--font-sans)', WebkitTextFillColor: 'rgba(146,95,24,0.58)' }}>
                Lingqi
              </span>
            </span>
          </span>
        </Link>

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
          <NavLink to="/explore">浏览灵契师</NavLink>
          <NavLink to="/commissions">委托需求</NavLink>
          <NavLink to="/carpools">拼车区</NavLink>
          <NavLink to="/rankings">红黑榜</NavLink>
          {creatorAuth && <IdentityChip tone="user">用户：{creatorAuth.display_name || creatorAuth.phone || '已登录'}</IdentityChip>}
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
                入驻灵契
              </Link>
            )
          }
          <Link to="/admin" style={{
            marginLeft: 4, padding: '6px 12px', borderRadius: 8, fontSize: '0.78rem',
            color: isAdmin ? '#0F1117' : 'rgba(146,95,24,0.68)',
            textDecoration: 'none',
            border: isAdmin ? '1px solid rgba(217,168,87,0.75)' : '1px solid rgba(201,146,46,0.15)',
            background: isAdmin ? 'linear-gradient(135deg, #f4c873 0%, #d9a857 100%)' : 'transparent',
            fontWeight: isAdmin ? 900 : 500,
            transition: 'all 0.2s',
          }}
            onMouseEnter={e => { if (!isAdmin) { (e.currentTarget as HTMLElement).style.color = GOLD; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(201,146,46,0.4)'; } }}
            onMouseLeave={e => { if (!isAdmin) { (e.currentTarget as HTMLElement).style.color = 'rgba(146,95,24,0.68)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(201,146,46,0.15)'; } }}>
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

        {/* 移动端汉堡 — 右 */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="lg:hidden"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: MUTED }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {menuOpen
              ? <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
              : <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>
            }
          </svg>
        </button>
      </div>

      {/* 移动端下拉菜单 */}
      {menuOpen && (
        <div style={{
          backgroundColor: BG,
          borderTop: '1px solid rgba(201,146,46,0.16)',
          padding: '12px 20px 16px',
          boxShadow: '0 18px 36px rgba(31,41,55,0.08)',
        }}>
          <MobileLink to="/explore" onClick={() => setMenuOpen(false)}>浏览灵契师</MobileLink>
          <MobileLink to="/commissions" onClick={() => setMenuOpen(false)}>委托需求</MobileLink>
          <MobileLink to="/carpools" onClick={() => setMenuOpen(false)}>拼车区</MobileLink>
          <MobileLink to="/rankings" onClick={() => setMenuOpen(false)}>红黑榜</MobileLink>
          {creatorAuth && <MobileStatus tone="user">当前用户：{creatorAuth.display_name || creatorAuth.phone || '已登录'}</MobileStatus>}
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
            : <MobileLink to="/login" gold onClick={() => setMenuOpen(false)}>入驻灵契 →</MobileLink>
          }
          <MobileLink to="/admin" gold={isAdmin} onClick={() => setMenuOpen(false)}>管理后台{pendingCount > 0 ? ` (${pendingCount})` : ''}</MobileLink>
        </div>
      )}
    </nav>
  );
}

const homeLinkStyle = (isHome: boolean): React.CSSProperties => ({
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 9,
  flex: '0 0 auto',
  minWidth: 0,
  padding: '7px 12px 7px 8px',
  borderRadius: 14,
  border: isHome ? '1px solid rgba(201,146,46,0.22)' : '1px solid rgba(201,146,46,0.42)',
  background: isHome ? 'rgba(255,250,242,0.72)' : 'linear-gradient(135deg, rgba(255,250,242,0.98), rgba(238,246,255,0.92))',
  boxShadow: isHome ? 'none' : '0 10px 24px rgba(146,95,24,0.12)',
  color: INK,
});

const homeArrowStyle = (isHome: boolean): React.CSSProperties => ({
  width: 32,
  height: 32,
  borderRadius: 10,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: '0 0 auto',
  background: isHome ? 'rgba(217,168,87,0.14)' : 'linear-gradient(135deg, #d9a857 0%, #c9922e 100%)',
  color: isHome ? '#925f18' : '#fffdf8',
  border: isHome ? '1px solid rgba(201,146,46,0.18)' : '1px solid rgba(146,95,24,0.22)',
  fontSize: 18,
  fontWeight: 900,
  lineHeight: 1,
});

const homeReturnTextStyle: React.CSSProperties = {
  color: 'rgba(39,83,137,0.82)',
  fontSize: 11,
  fontWeight: 900,
  lineHeight: 1.05,
};

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
  return (
    <Link to={to} style={{ textDecoration: 'none', padding: '8px 14px', borderRadius: 8, fontSize: '0.875rem', color: MUTED, transition: 'color 0.2s, background 0.2s', fontWeight: 650 }}
      onMouseEnter={e => { preloadRoute(to); e.currentTarget.style.color = INK; e.currentTarget.style.background = 'rgba(217,168,87,0.10)'; }}
      onFocus={() => preloadRoute(to)}
      onMouseLeave={e => { e.currentTarget.style.color = MUTED; e.currentTarget.style.background = 'transparent'; }}>
      {children}
    </Link>
  );
}

function MobileLink({ to, children, gold, onClick }: { to: string; children: React.ReactNode; gold?: boolean; onClick: () => void }) {
  return (
    <Link to={to} onClick={onClick} style={{
      display: 'block', textDecoration: 'none',
      padding: '10px 0',
      fontSize: '0.9rem',
      color: gold ? GOLD : MUTED,
      borderBottom: '1px solid rgba(201,146,46,0.12)',
      fontWeight: gold ? 600 : 400,
    }}
      onTouchStart={() => preloadRoute(to)}
      onFocus={() => preloadRoute(to)}>
      {children}
    </Link>
  );
}
