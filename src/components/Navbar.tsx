import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { isTokenExpired, readStoredCreatorAuth, type StoredCreatorAuth } from '../lib/authSession';
import { preloadRoute } from '../lib/routePreload';
import BrandLogo from './BrandLogo';

const API = '/api';

type OpenMenu = 'community' | 'account' | null;

const PRIMARY_LINKS = [
  { to: '/dm', label: 'DM百科' },
  { to: '/commissions', label: 'DM委托' },
  { to: '/rankings', label: '红黑榜' },
  { to: '/scripts', label: '角色点评' },
] as const;

const COMMUNITY_LINKS = [
  { to: '/carpools', label: '拼车区', description: '按日期、城市和剧本寻找同场玩家' },
  { to: '/guides', label: '玩家攻略', description: '查找和发布真实玩家经验' },
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
  const navigate = useNavigate();
  const navRef = useRef<HTMLElement>(null);
  const [authSnapshot, setAuthSnapshot] = useState(readAuthSnapshot);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const { creatorAuth, adminToken } = authSnapshot;
  const isLoggedIn = Boolean(creatorAuth);
  const isAdmin = Boolean(adminToken);
  const isShop = Boolean(creatorAuth?.verified_shop || creatorAuth?.role === 'shop' || creatorAuth?.identity_roles?.includes('shop'));
  const identity = creatorAuth?.display_name || creatorAuth?.phone || creatorAuth?.email || (isAdmin ? '管理员' : '用户');
  const identityInitial = identity.trim().slice(0, 1) || '剧';
  const communityActive = COMMUNITY_LINKS.some(item => isNavPathActive(pathname, item.to));
  const isHome = pathname === '/';
  const currentPageLabel = locationLabelFor(pathname);
  const messageCount = creatorAuth ? unreadCount : isAdmin ? pendingCount : 0;
  const messagePath = creatorAuth ? '/account-status' : isAdmin ? '/admin' : '/login?redirect=%2Faccount-status';
  const messagePreloadPath = creatorAuth ? '/account-status' : isAdmin ? '/admin' : '/login';

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

  useEffect(() => {
    let alive = true;
    const loadUnread = async () => {
      if (!creatorAuth?.token) {
        if (alive) setUnreadCount(0);
        return;
      }
      try {
        const response = await fetch(`${API}/lc/account/status`, {
          headers: { Authorization: `Bearer ${creatorAuth.token}` },
        });
        const payload = await response.json();
        if (!alive || !payload.success) return;
        setUnreadCount(Math.max(0, Number(payload.data?.unread_count || 0)));
      } catch {
        if (alive) setUnreadCount(0);
      }
    };
    void loadUnread();
    window.addEventListener('focus', loadUnread);
    window.addEventListener('lc-auth-changed', loadUnread);
    return () => {
      alive = false;
      window.removeEventListener('focus', loadUnread);
      window.removeEventListener('lc-auth-changed', loadUnread);
    };
  }, [creatorAuth?.token]);

  const goBack = () => {
    const historyState = window.history.state as { idx?: number } | null;
    if (historyState?.idx && historyState.idx > 0) {
      navigate(-1);
      return;
    }
    navigate(fallbackPathFor(pathname));
  };

  return (
    <nav ref={navRef} className="site-nav" aria-label="主导航">
      <div className="site-nav-shell">
        {isHome ? (
          <Link
            className="site-brand-link"
            to="/"
            aria-label="剧幕录首页"
            onMouseEnter={() => preloadRoute('/')}
            onFocus={() => preloadRoute('/')}
          >
            <BrandLogo />
          </Link>
        ) : (
          <div className="site-nav-origin">
            <button
              type="button"
              className="site-back-button"
              onClick={goBack}
              aria-label="返回上一级"
            >
              <span className="site-back-chevron" aria-hidden="true">‹</span>
              <span>返回</span>
              <span className="site-back-location">· {currentPageLabel}</span>
            </button>
            <Link
              to="/"
              className="site-home-link"
              onMouseEnter={() => preloadRoute('/')}
              onFocus={() => preloadRoute('/')}
            >
              首页
            </Link>
          </div>
        )}

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
          <Link
            to={messagePath}
            className="site-message-link"
            aria-label={messageCount > 0 ? `消息，${messageCount}条未读` : '消息'}
            onMouseEnter={() => preloadRoute(messagePreloadPath)}
            onFocus={() => preloadRoute(messagePreloadPath)}
          >
            <span>消息</span>
            {messageCount > 0 && <span className="site-message-badge" aria-hidden="true">{messageCount > 99 ? '99+' : messageCount}</span>}
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
          <Link
            to={messagePath}
            className="site-mobile-message-link"
            aria-label={messageCount > 0 ? `消息，${messageCount}条未读` : '消息'}
          >
            <span>消息</span>
            {messageCount > 0 && <span className="site-message-badge" aria-hidden="true">{messageCount > 99 ? '99+' : messageCount}</span>}
          </Link>
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
        .site-nav-origin {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 3px;
        }
        .site-back-button {
          min-width: 0;
          max-width: 168px;
          display: inline-flex;
          align-items: center;
          gap: 2px;
          border: 0;
          border-radius: 10px;
          background: transparent;
          margin-left: -6px;
          padding: 8px 6px;
          color: #275389;
          font: inherit;
          font-size: 0.9rem;
          font-weight: 800;
          line-height: 1;
          cursor: pointer;
          white-space: nowrap;
        }
        .site-home-link {
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 32px;
          border-left: 1px solid rgba(31, 41, 55, 0.1);
          padding: 0 7px 0 10px;
          color: rgba(71, 85, 105, 0.74);
          text-decoration: none;
          font-size: 12px;
          font-weight: 850;
          white-space: nowrap;
        }
        .site-home-link:hover {
          color: #275389;
        }
        .site-back-chevron {
          flex: 0 0 auto;
          font-size: 28px;
          font-weight: 900;
          line-height: 0.8;
          transform: translateY(-1px);
        }
        .site-back-location {
          min-width: 0;
          overflow: hidden;
          color: rgba(71, 85, 105, 0.58);
          font-weight: 760;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .site-brand-link:focus-visible,
        .site-back-button:focus-visible,
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
        .site-message-link,
        .site-login-link {
          position: relative;
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
        .site-message-link {
          gap: 6px;
          border: 1px solid rgba(39, 83, 137, 0.18);
          background: #fff;
          color: #275389;
        }
        .site-message-link:hover {
          border-color: rgba(39, 83, 137, 0.34);
          background: rgba(239, 246, 255, 0.72);
        }
        .site-message-badge {
          min-width: 17px;
          height: 17px;
          box-sizing: border-box;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          background: #b42318;
          padding: 0 4px;
          color: #fff;
          font-size: 9px;
          font-weight: 900;
          line-height: 1;
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
          .site-back-location {
            display: none;
          }
          .site-back-button {
            max-width: none;
            margin-left: -4px;
            padding-right: 3px;
          }
          .site-home-link {
            min-height: 30px;
            padding: 0 4px 0 7px;
            font-size: 11px;
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
          .site-mobile-message-link,
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
          .site-mobile-message-link {
            gap: 5px;
            border: 1px solid rgba(39, 83, 137, 0.18);
            background: #fff;
            color: #275389;
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
  if (pathname.startsWith('/account-status')) return '消息通知';
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
  if (pathname.startsWith('/account-status')) return '/dashboard';
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
