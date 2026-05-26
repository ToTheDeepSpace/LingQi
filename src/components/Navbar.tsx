import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const BG = 'rgba(11,26,48,0.96)';
const GOLD = '#d9a857';
const API = '/api';

type CreatorAuth = {
  display_name?: string;
  phone?: string;
  token?: string;
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
  return {
    creatorAuth: readCreatorAuth(),
    adminToken: readAdminToken(),
  };
}

export default function Navbar() {
  const [authSnapshot, setAuthSnapshot] = useState(readAuthSnapshot);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const { creatorAuth, adminToken } = authSnapshot;
  const isLoggedIn = !!creatorAuth;
  const isAdmin = !!adminToken;

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
          + (data.commissions || []).length;
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
    <nav style={{
      position: 'sticky', top: 0, zIndex: 50,
      backgroundColor: BG,
      borderBottom: '1px solid rgba(201,146,46,0.15)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
    }}>
      <div style={{
        maxWidth: 1000, margin: '0 auto',
        padding: '0 20px', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>

        {/* Logo — 左 */}
        <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="gradient-text-gold" style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: '1.3rem' }}>
            灵契
          </span>
          <span style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(201,146,46,0.4)', fontFamily: 'var(--font-sans)' }}>
            Lingqi
          </span>
        </Link>

        {/* 桌面导航 — 右 */}
        <div className="hidden sm:flex" style={{ alignItems: 'center', gap: 8 }}>
          <NavLink to="/explore">进入灵契大厅</NavLink>
          <NavLink to="/commissions">委托需求</NavLink>
          <NavLink to="/rankings">红黑榜</NavLink>
          {creatorAuth && <IdentityChip tone="user">用户：{creatorAuth.display_name || creatorAuth.phone || '已登录'}</IdentityChip>}
          {isAdmin && <IdentityChip tone="admin">管理员{pendingCount > 0 ? ` · 待审 ${pendingCount}` : ' · 已登录'}</IdentityChip>}
          {isLoggedIn
            ? <NavLink to="/dashboard">我的主页</NavLink>
            : (
              <Link to="/login" className="btn-gold" style={{ marginLeft: 8, padding: '8px 20px', fontSize: '0.875rem', display: 'inline-block' }}>
                入驻灵契
              </Link>
            )
          }
          <Link to="/admin" style={{
            marginLeft: 4, padding: '6px 12px', borderRadius: 8, fontSize: '0.78rem',
            color: isAdmin ? '#0b1a30' : 'rgba(201,146,46,0.4)',
            textDecoration: 'none',
            border: isAdmin ? '1px solid rgba(217,168,87,0.75)' : '1px solid rgba(201,146,46,0.15)',
            background: isAdmin ? 'linear-gradient(135deg, #f4c873 0%, #d9a857 100%)' : 'transparent',
            fontWeight: isAdmin ? 900 : 500,
            transition: 'all 0.2s',
          }}
            onMouseEnter={e => { if (!isAdmin) { (e.currentTarget as HTMLElement).style.color = GOLD; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(201,146,46,0.4)'; } }}
            onMouseLeave={e => { if (!isAdmin) { (e.currentTarget as HTMLElement).style.color = 'rgba(201,146,46,0.4)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(201,146,46,0.15)'; } }}>
            管理{pendingCount > 0 ? `(${pendingCount})` : ''}
          </Link>
        </div>

        {/* 移动端汉堡 — 右 */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="sm:hidden"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: 'rgba(186,207,231,0.7)' }}>
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
          borderTop: '1px solid rgba(201,146,46,0.1)',
          padding: '12px 20px 16px',
        }}>
          <MobileLink to="/explore" onClick={() => setMenuOpen(false)}>进入灵契大厅</MobileLink>
          <MobileLink to="/commissions" onClick={() => setMenuOpen(false)}>委托需求</MobileLink>
          <MobileLink to="/rankings" onClick={() => setMenuOpen(false)}>红黑榜</MobileLink>
          {creatorAuth && <MobileStatus tone="user">当前用户：{creatorAuth.display_name || creatorAuth.phone || '已登录'}</MobileStatus>}
          {isAdmin && <MobileStatus tone="admin">管理员已登录{pendingCount > 0 ? `，待审 ${pendingCount}` : ''}</MobileStatus>}
          {isLoggedIn
            ? <MobileLink to="/dashboard" onClick={() => setMenuOpen(false)}>我的主页</MobileLink>
            : <MobileLink to="/login" gold onClick={() => setMenuOpen(false)}>入驻灵契 →</MobileLink>
          }
          <MobileLink to="/admin" gold={isAdmin} onClick={() => setMenuOpen(false)}>管理后台{pendingCount > 0 ? ` (${pendingCount})` : ''}</MobileLink>
        </div>
      )}
    </nav>
  );
}

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
      border: admin ? '1px solid rgba(217,168,87,0.5)' : '1px solid rgba(226,238,252,0.14)',
      background: admin ? 'rgba(217,168,87,0.18)' : 'rgba(255,255,255,0.055)',
      color: admin ? '#f4c873' : 'rgba(226,238,252,0.82)',
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
      border: admin ? '1px solid rgba(217,168,87,0.42)' : '1px solid rgba(226,238,252,0.12)',
      background: admin ? 'rgba(217,168,87,0.14)' : 'rgba(255,255,255,0.045)',
      color: admin ? '#f4c873' : 'rgba(226,238,252,0.78)',
      fontSize: '0.82rem',
      fontWeight: admin ? 900 : 700,
    }}>
      {children}
    </div>
  );
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} style={{ textDecoration: 'none', padding: '8px 14px', borderRadius: 8, fontSize: '0.875rem', color: 'rgba(186,207,231,0.65)', transition: 'color 0.2s' }}
      onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(186,207,231,0.65)')}>
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
      color: gold ? GOLD : 'rgba(186,207,231,0.7)',
      borderBottom: '1px solid rgba(201,146,46,0.06)',
      fontWeight: gold ? 600 : 400,
    }}>
      {children}
    </Link>
  );
}
