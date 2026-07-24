import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { isTokenExpired, readStoredCreatorAuth, type StoredCreatorAuth } from '../lib/authSession';
import { preloadRoute } from '../lib/routePreload';
import BrandLogo from './BrandLogo';

const API = '/api';

type OpenMenu = 'community' | 'account' | null;

const PRIMARY_LINKS = [
  { to: '/dm', label: 'DM评分' },
  { to: '/stores', label: '店家评分' },
  { to: '/scripts', label: '角色点评' },
  { to: '/scripts/contribute', label: '剧本库' },
] as const;

const COMMUNITY_LINKS = [
  { to: '/rankings', label: '红黑榜', description: '查看具体事件和相关回应' },
  { to: '/carpools', label: '拼车区', description: '按日期和城市找同场玩家' },
  { to: '/commissions', label: '委托需求', description: '发布或承接沉浸式娱乐委托' },
  { to: '/guides', label: '攻略交易', description: '查找和发布玩家攻略' },
] as const;

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
  const navRef = useRef<HTMLElement>(null);
  const [authSnapshot, setAuthSnapshot] = useState(readAuthSnapshot);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const { creatorAuth, adminToken } = authSnapshot;
  const isLoggedIn = Boolean(creatorAuth);
  const isAdmin = Boolean(adminToken);
  const isShop = Boolean(creatorAuth?.verified_shop || creatorAuth?.role === 'shop' || creatorAuth?.identity_roles?.includes('shop'));
  const identity = creatorAuth?.display_name || creatorAuth?.phone || creatorAuth?.email || (isAdmin ? '管理员' : '用户');
  const identityInitial = identity.trim().slice(0, 1) || '剧';
  const communityActive = COMMUNITY_LINKS.some(item => isNavPathActive(pathname, item.to));

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
    const closeMenus = (event: PointerEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) setOpenMenu(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenMenu(null);
    };
    window.addEventListener('pointerdown', closeMenus);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('pointerdown', closeMenus);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    if (!adminToken) {
      return () => { alive = false; };
    }
    const loadPending = async () => {
      try {
        const response = await fetch(`${API}/lc/admin/pending`, { headers: { Authorization: `Bearer ${adminToken}` } });
        const payload = await response.json();
        if (!alive || !payload.success) return;
        const data = payload.data || {};
        const pendingProfiles = (data.profiles || []).filter((profile: { is_visible?: boolean; reject_reason?: string | null }) => !profile.is_visible && !profile.reject_reason).length;
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
          + (data.guideWithdrawals || []).length
          + (data.dmDossiers || []).length;
        setPendingCount(total);
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
    <nav ref={navRef} className="site-nav" aria-label="主导航">
      <div className="site-nav-shell">
        <Link
          className="site-brand-link"
          to="/"
          aria-label="剧幕录首页"
          onMouseEnter={() => preloadRoute('/')}
          onFocus={() => preloadRoute('/')}
        >
          <BrandLogo />
        </Link>

        <div className="site-nav-primary">
          {PRIMARY_LINKS.map(item => <DesktopNavLink key={item.to} to={item.to} onNavigate={() => setOpenMenu(null)}>{item.label}</DesktopNavLink>)}
          <div className="site-nav-menu-anchor">
            <button
              type="button"
              className={`site-nav-link site-nav-menu-button${communityActive ? ' is-active' : ''}`}
              aria-expanded={openMenu === 'community'}
              aria-haspopup="menu"
              onClick={() => setOpenMenu(openMenu === 'community' ? null : 'community')}
            >
              社区
              <span className="site-nav-caret" aria-hidden="true">⌄</span>
            </button>
            {openMenu === 'community' && (
              <div className="site-nav-dropdown site-community-menu" role="menu">
                {COMMUNITY_LINKS.map(item => (
                  <Link
                    key={item.to}
                    to={item.to}
                    role="menuitem"
                    className={`site-community-link${isNavPathActive(pathname, item.to) ? ' is-active' : ''}`}
                    onClick={() => setOpenMenu(null)}
                    onMouseEnter={() => preloadRoute(item.to)}
                    onFocus={() => preloadRoute(item.to)}
                  >
                    <strong>{item.label}</strong>
                    <span>{item.description}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="site-nav-actions">
          <Link to="/dm/rate" className="site-rate-link" onMouseEnter={() => preloadRoute('/dm/rate')} onFocus={() => preloadRoute('/dm/rate')}>
            去评分
          </Link>
          {isLoggedIn || isAdmin ? (
            <div className="site-nav-menu-anchor">
              <button
                type="button"
                className={`site-account-button${openMenu === 'account' ? ' is-open' : ''}`}
                aria-expanded={openMenu === 'account'}
                aria-haspopup="menu"
                onClick={() => setOpenMenu(openMenu === 'account' ? null : 'account')}
              >
                <span className="site-account-avatar" aria-hidden="true">{identityInitial}</span>
                <span className="site-account-name">{identity}</span>
                <span className="site-nav-caret" aria-hidden="true">⌄</span>
              </button>
              {openMenu === 'account' && (
                <div className="site-nav-dropdown site-account-menu" role="menu">
                  {creatorAuth && <AccountMenuLink to="/dashboard" onNavigate={() => setOpenMenu(null)}>我的主页</AccountMenuLink>}
                  {creatorAuth && <AccountMenuLink to="/certification" onNavigate={() => setOpenMenu(null)}>身份认证</AccountMenuLink>}
                  {creatorAuth && <AccountMenuLink to="/referrals" onNavigate={() => setOpenMenu(null)}>我的邀请</AccountMenuLink>}
                  {isShop && <AccountMenuLink to="/shop/dashboard" onNavigate={() => setOpenMenu(null)}>店家后台</AccountMenuLink>}
                  {isAdmin && <AccountMenuLink to="/admin" onNavigate={() => setOpenMenu(null)}>管理后台{pendingCount > 0 ? `（${pendingCount}）` : ''}</AccountMenuLink>}
                  <button type="button" role="menuitem" className="site-account-logout" onClick={handleLogout}>退出登录</button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" className="site-login-link">登录</Link>
          )}
        </div>

        <div className="site-nav-mobile-actions">
          <Link to="/dm/rate" className="site-mobile-rate-link">评分</Link>
          <button
            type="button"
            className="site-mobile-menu-button"
            aria-expanded={mobileOpen}
            aria-controls="site-mobile-menu"
            onClick={() => setMobileOpen(value => !value)}
          >
            {mobileOpen ? '关闭' : '菜单'}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div id="site-mobile-menu" className="site-mobile-menu">
          <div className="site-mobile-primary">
            {PRIMARY_LINKS.map(item => <MobileNavLink key={item.to} to={item.to} onNavigate={() => setMobileOpen(false)}>{item.label}</MobileNavLink>)}
          </div>
          <div className="site-mobile-group">
            <span className="site-mobile-group-title">社区</span>
            {COMMUNITY_LINKS.map(item => <MobileNavLink key={item.to} to={item.to} onNavigate={() => setMobileOpen(false)}>{item.label}</MobileNavLink>)}
          </div>
          <div className="site-mobile-group">
            <span className="site-mobile-group-title">账号</span>
            {creatorAuth ? (
              <>
                <MobileNavLink to="/dashboard" onNavigate={() => setMobileOpen(false)}>我的主页</MobileNavLink>
                <MobileNavLink to="/certification" onNavigate={() => setMobileOpen(false)}>身份认证</MobileNavLink>
                <MobileNavLink to="/referrals" onNavigate={() => setMobileOpen(false)}>我的邀请</MobileNavLink>
                {isShop && <MobileNavLink to="/shop/dashboard" onNavigate={() => setMobileOpen(false)}>店家后台</MobileNavLink>}
              </>
            ) : !isAdmin && <MobileNavLink to="/login" onNavigate={() => setMobileOpen(false)}>登录 / 注册</MobileNavLink>}
            {isAdmin && <MobileNavLink to="/admin" onNavigate={() => setMobileOpen(false)}>管理后台{pendingCount > 0 ? `（${pendingCount}）` : ''}</MobileNavLink>}
            {(isLoggedIn || isAdmin) && <button type="button" className="site-mobile-logout" onClick={handleLogout}>退出登录</button>}
          </div>
        </div>
      )}

      <style>{`
        .site-nav {
          position: sticky;
          top: 0;
          z-index: 60;
          border-bottom: 1px solid rgba(31, 41, 55, 0.08);
          background: rgba(255, 253, 248, 0.96);
          color: #1f2937;
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
        }
        .site-nav-shell {
          width: 100%;
          height: 60px;
          box-sizing: border-box;
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          align-items: center;
          gap: 22px;
          padding: 0 clamp(16px, 2.2vw, 32px);
        }
        .site-brand-link {
          display: inline-flex;
          align-items: center;
          color: #1f2937;
          text-decoration: none;
          border-radius: 6px;
        }
        .site-brand-link:focus-visible,
        .site-nav a:focus-visible,
        .site-nav button:focus-visible {
          outline: 2px solid rgba(39, 83, 137, 0.5);
          outline-offset: 3px;
        }
        .site-nav-primary,
        .site-nav-actions {
          display: flex;
          align-items: stretch;
          min-width: 0;
          height: 100%;
        }
        .site-nav-primary {
          justify-content: flex-start;
          gap: 4px;
        }
        .site-nav-actions {
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
        }
        .site-nav-link {
          position: relative;
          min-width: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          border: 0;
          background: transparent;
          padding: 0 13px;
          color: rgba(71, 85, 105, 0.78);
          text-decoration: none;
          font: inherit;
          font-size: 14px;
          font-weight: 720;
          cursor: pointer;
          white-space: nowrap;
        }
        .site-nav-link::after {
          content: "";
          position: absolute;
          right: 12px;
          bottom: 0;
          left: 12px;
          height: 2px;
          background: transparent;
        }
        .site-nav-link:hover {
          color: #1f2937;
        }
        .site-nav-link.is-active {
          color: #925f18;
          font-weight: 900;
        }
        .site-nav-link.is-active::after {
          background: #b57b21;
        }
        .site-nav-menu-anchor {
          position: relative;
          display: inline-flex;
          align-items: center;
        }
        .site-nav-caret {
          display: inline-flex;
          transform: translateY(-1px);
          font-size: 13px;
          line-height: 1;
        }
        .site-nav-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          z-index: 80;
          border: 1px solid rgba(31, 41, 55, 0.1);
          border-radius: 8px;
          background: #fffdf8;
          box-shadow: 0 16px 34px rgba(31, 41, 55, 0.12);
          overflow: hidden;
        }
        .site-community-menu {
          right: auto;
          left: 0;
          width: 290px;
          padding: 6px;
        }
        .site-community-link {
          display: grid;
          gap: 3px;
          padding: 10px 11px;
          border-radius: 6px;
          color: #1f2937;
          text-decoration: none;
        }
        .site-community-link:hover,
        .site-community-link.is-active {
          background: rgba(239, 246, 255, 0.92);
        }
        .site-community-link strong {
          font-size: 13px;
        }
        .site-community-link span {
          color: rgba(71, 85, 105, 0.72);
          font-size: 11px;
          line-height: 1.45;
        }
        .site-rate-link,
        .site-login-link {
          min-height: 36px;
          box-sizing: border-box;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          padding: 0 15px;
          text-decoration: none;
          font-size: 13px;
          font-weight: 900;
        }
        .site-rate-link {
          border: 1px solid #275389;
          background: #275389;
          color: #fff;
        }
        .site-login-link {
          border: 1px solid rgba(39, 83, 137, 0.18);
          background: #fff;
          color: #275389;
        }
        .site-account-button {
          min-height: 38px;
          max-width: 190px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1px solid transparent;
          border-radius: 6px;
          background: transparent;
          padding: 0 8px 0 5px;
          color: #1f2937;
          font: inherit;
          cursor: pointer;
        }
        .site-account-button:hover,
        .site-account-button.is-open {
          border-color: rgba(31, 41, 55, 0.09);
          background: #fff;
        }
        .site-account-avatar {
          width: 28px;
          height: 28px;
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: #1f2937;
          color: #fffdf8;
          font-size: 12px;
          font-weight: 900;
        }
        .site-account-name {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 13px;
          font-weight: 780;
        }
        .site-account-menu {
          width: 190px;
          padding: 6px;
        }
        .site-account-link,
        .site-account-logout {
          width: 100%;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          min-height: 36px;
          border: 0;
          border-radius: 6px;
          background: transparent;
          padding: 0 10px;
          color: #1f2937;
          text-decoration: none;
          font: inherit;
          font-size: 13px;
          font-weight: 720;
          cursor: pointer;
        }
        .site-account-link:hover {
          background: rgba(239, 246, 255, 0.9);
        }
        .site-account-logout {
          margin-top: 4px;
          border-top: 1px solid rgba(31, 41, 55, 0.08);
          border-radius: 0 0 6px 6px;
          color: #b91c1c;
        }
        .site-nav-mobile-actions,
        .site-mobile-menu {
          display: none;
        }
        @media (max-width: 980px) {
          .site-nav-shell {
            grid-template-columns: minmax(0, 1fr) auto;
            height: 56px;
            gap: 10px;
            padding: 0 12px;
          }
          .site-brand-link img {
            width: 27px !important;
            height: 27px !important;
          }
          .site-brand-link strong {
            font-size: 1.02rem !important;
          }
          .site-nav-primary,
          .site-nav-actions {
            display: none;
          }
          .site-nav-mobile-actions {
            display: flex;
            align-items: center;
            gap: 7px;
          }
          .site-mobile-rate-link,
          .site-mobile-menu-button {
            min-height: 34px;
            box-sizing: border-box;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border-radius: 6px;
            padding: 0 11px;
            font: inherit;
            font-size: 12px;
            font-weight: 900;
            text-decoration: none;
          }
          .site-mobile-rate-link {
            border: 1px solid #275389;
            background: #275389;
            color: #fff;
          }
          .site-mobile-menu-button {
            border: 1px solid rgba(39, 83, 137, 0.18);
            background: #fff;
            color: #275389;
          }
          .site-mobile-menu {
            max-height: calc(100dvh - 56px);
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 14px;
            overflow-y: auto;
            border-top: 1px solid rgba(31, 41, 55, 0.07);
            background: #fffdf8;
            padding: 14px 16px 18px;
          }
          .site-mobile-primary,
          .site-mobile-group {
            min-width: 0;
            display: grid;
            align-content: start;
            gap: 2px;
          }
          .site-mobile-group-title {
            padding: 6px 8px;
            color: rgba(71, 85, 105, 0.58);
            font-size: 10px;
            font-weight: 900;
          }
          .site-mobile-link,
          .site-mobile-logout {
            min-height: 36px;
            box-sizing: border-box;
            display: flex;
            align-items: center;
            border: 0;
            border-radius: 6px;
            background: transparent;
            padding: 0 8px;
            color: rgba(31, 41, 55, 0.82);
            text-align: left;
            text-decoration: none;
            font: inherit;
            font-size: 13px;
            font-weight: 700;
          }
          .site-mobile-link.is-active {
            background: rgba(239, 246, 255, 0.9);
            color: #275389;
            font-weight: 900;
          }
          .site-mobile-logout {
            color: #b91c1c;
          }
        }
        @media (max-width: 620px) {
          .site-mobile-menu {
            grid-template-columns: 1fr 1fr;
          }
          .site-mobile-primary {
            grid-column: 1 / -1;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            padding-bottom: 8px;
            border-bottom: 1px solid rgba(31, 41, 55, 0.08);
          }
        }
      `}</style>
    </nav>
  );
}

function DesktopNavLink({ to, children, onNavigate }: { to: string; children: React.ReactNode; onNavigate: () => void }) {
  const { pathname } = useLocation();
  const active = isNavPathActive(pathname, to);
  return (
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      className={`site-nav-link${active ? ' is-active' : ''}`}
      onClick={onNavigate}
      onMouseEnter={() => preloadRoute(to)}
      onFocus={() => preloadRoute(to)}
    >
      {children}
    </Link>
  );
}

function AccountMenuLink({ to, children, onNavigate }: { to: string; children: React.ReactNode; onNavigate: () => void }) {
  return (
    <Link to={to} role="menuitem" className="site-account-link" onClick={onNavigate} onMouseEnter={() => preloadRoute(to)} onFocus={() => preloadRoute(to)}>
      {children}
    </Link>
  );
}

function MobileNavLink({ to, children, onNavigate }: { to: string; children: React.ReactNode; onNavigate: () => void }) {
  const { pathname } = useLocation();
  const active = isNavPathActive(pathname, to);
  return (
    <Link
      to={to}
      className={`site-mobile-link${active ? ' is-active' : ''}`}
      aria-current={active ? 'page' : undefined}
      onClick={onNavigate}
      onTouchStart={() => preloadRoute(to)}
      onFocus={() => preloadRoute(to)}
    >
      {children}
    </Link>
  );
}

function isNavPathActive(pathname: string, to: string) {
  if (to === '/dm') return pathname === '/dm' || pathname === '/dm-wall' || pathname.startsWith('/dm/');
  if (to === '/scripts') {
    return (pathname === '/scripts' || pathname.startsWith('/scripts/roles/') || pathname.startsWith('/scripts/rate'))
      && !pathname.startsWith('/scripts/contribute');
  }
  if (to === '/scripts/contribute') return pathname.startsWith('/scripts/contribute');
  if (to === '/rankings') return pathname.startsWith('/rankings') || pathname.startsWith('/reputation');
  return pathname === to || pathname.startsWith(`${to}/`);
}
