import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function Navbar() {
  const isLoggedIn = !!localStorage.getItem('lc_creator');
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className={`sticky top-0 z-50 transition-all duration-300 ${
      scrolled
        ? 'bg-cream/85 backdrop-blur-xl border-b border-gold-200/50 shadow-gold'
        : 'bg-cream/60 backdrop-blur-lg border-b border-gold-200/20'
    }`}>
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <span className="text-xl font-serif font-black gradient-text">灵契</span>
          <span className="hidden sm:inline text-[10px] text-gold-400/60 tracking-[0.2em] uppercase font-sans group-hover:text-gold-400 transition-colors">
            Lingqi
          </span>
        </Link>

        <div className="hidden sm:flex items-center gap-1.5">
          <Link to="/explore"
            className="px-4 py-2 text-sm text-ink-500 hover:text-ink-800 transition-all rounded-lg hover:bg-gold-50/80">
            发现创作者
          </Link>
          {isLoggedIn ? (
            <Link to="/dashboard"
              className="px-4 py-2 text-sm text-ink-500 hover:text-ink-800 transition-all rounded-lg hover:bg-gold-50/80">
              我的主页
            </Link>
          ) : (
            <Link to="/login"
              className="ml-2 px-5 py-2 text-sm font-medium text-white bg-gradient-to-r from-gold-500 to-gold-400 rounded-[0.75rem] hover:from-gold-400 hover:to-gold-300 transition-all shadow-md shadow-gold-500/20 hover:shadow-lg hover:shadow-gold-500/30">
              入驻灵契
            </Link>
          )}
        </div>

        <button onClick={() => setMenuOpen(!menuOpen)} className="sm:hidden p-2 text-ink-500 hover:text-ink-800 transition-colors">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {menuOpen
              ? <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
              : <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>
            }
          </svg>
        </button>
      </div>
      {menuOpen && (
        <div className="sm:hidden border-t border-gold-200/40 bg-cream/95 backdrop-blur-xl px-5 py-4 space-y-3 animate-fade-in">
          <Link to="/explore" className="block text-sm text-ink-600 py-1.5" onClick={() => setMenuOpen(false)}>发现创作者</Link>
          {isLoggedIn ? (
            <Link to="/dashboard" className="block text-sm text-ink-600 py-1.5" onClick={() => setMenuOpen(false)}>我的主页</Link>
          ) : (
            <Link to="/login" className="block text-sm font-medium text-gold-600 py-1.5" onClick={() => setMenuOpen(false)}>入驻灵契</Link>
          )}
        </div>
      )}
    </nav>
  );
}
