import { useState } from 'react';
import { Link } from 'react-router-dom';

const BG = 'rgba(11,26,48,0.96)';
const GOLD = '#d9a857';

export default function Navbar() {
  const isLoggedIn = !!localStorage.getItem('lc_creator');
  const [menuOpen, setMenuOpen] = useState(false);

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
          <NavLink to="/rankings">红黑榜</NavLink>
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
            color: 'rgba(201,146,46,0.4)', textDecoration: 'none', border: '1px solid rgba(201,146,46,0.15)',
            transition: 'all 0.2s',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = GOLD; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(201,146,46,0.4)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(201,146,46,0.4)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(201,146,46,0.15)'; }}>
            管理
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
          <MobileLink to="/rankings" onClick={() => setMenuOpen(false)}>红黑榜</MobileLink>
          {isLoggedIn
            ? <MobileLink to="/dashboard" onClick={() => setMenuOpen(false)}>我的主页</MobileLink>
            : <MobileLink to="/login" gold onClick={() => setMenuOpen(false)}>入驻灵契 →</MobileLink>
          }
          <MobileLink to="/admin" onClick={() => setMenuOpen(false)}>管理后台</MobileLink>
        </div>
      )}
    </nav>
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
