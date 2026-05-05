import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function Navbar() {
  const isLoggedIn = !!localStorage.getItem('lc_creator');
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-cream/80 backdrop-blur-md border-b border-gold-200/40">
      <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <span className="text-xl font-serif font-black text-gold-water">灵契</span>
          <span className="hidden sm:inline text-[10px] text-gold-400/60 tracking-[0.2em] uppercase font-sans">Lingqi</span>
        </Link>

        <div className="hidden sm:flex items-center gap-1">
          <Link to="/explore" className="px-3 py-1.5 text-sm text-ink-500 hover:text-ink-800 transition-colors rounded-lg hover:bg-gold-50">发现创作者</Link>
          {isLoggedIn ? (
            <Link to="/dashboard" className="px-3 py-1.5 text-sm text-ink-500 hover:text-ink-800 transition-colors rounded-lg hover:bg-gold-50">我的主页</Link>
          ) : (
            <Link to="/login" className="ml-2 px-4 py-1.5 text-sm font-medium text-white bg-ink-800 rounded-[0.75rem] hover:bg-ink-700 transition-colors shadow-gold">入驻灵契</Link>
          )}
        </div>

        <button onClick={() => setMenuOpen(!menuOpen)} className="sm:hidden p-1 text-ink-400">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {menuOpen
              ? <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
              : <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>
            }
          </svg>
        </button>
      </div>
      {menuOpen && (
        <div className="sm:hidden border-t border-gold-200/40 bg-cream px-5 py-4 space-y-3">
          <Link to="/explore" className="block text-sm text-ink-500" onClick={() => setMenuOpen(false)}>发现创作者</Link>
          {isLoggedIn ? (
            <Link to="/dashboard" className="block text-sm text-ink-500" onClick={() => setMenuOpen(false)}>我的主页</Link>
          ) : (
            <Link to="/login" className="block text-sm font-medium text-gold-700" onClick={() => setMenuOpen(false)}>入驻灵契</Link>
          )}
        </div>
      )}
    </nav>
  );
}
