import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { Creator, PaginatedResponse } from '../types';

const API = '/api';

const FILTERS = [
  ['all', '全部'],
  ['creator', '卡司/DM'],
  ['coser', 'Coser'],
  ['photographer', '摄影师'],
  ['makeup', '妆造师'],
] as const;

const ROLE_EMOJI: Record<string, string> = {
  creator: '🎭',
  coser: '⭐',
  photographer: '📸',
  makeup: '💄',
};

export default function Explore() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    setLoading(true);
    setError('');
    fetch(`${API}/lc/creators?page=${page}&limit=12`)
      .then(r => {
        if (!r.ok) throw new Error(`请求失败 (${r.status})`);
        return r.json();
      })
      .then(d => {
        if (d.success) {
          const paged = d.data as PaginatedResponse<Creator>;
          setCreators(paged.items || []);
          setTotalPages(paged.totalPages || 1);
        } else {
          setError(d.error || '加载失败');
        }
      })
      .catch(e => setError(e.message || '网络错误'))
      .finally(() => setLoading(false));
  }, [page]);

  const filtered = filter === 'all' ? creators : creators.filter(c => c.role_type === filter);

  return (
    <div className="min-h-screen bg-cream">
      {/* 顶部深色 Header */}
      <div className="bg-hero-dark relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03] bg-dot-pattern" />
        <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full bg-gradient-to-bl from-gold-400/5 to-transparent blur-2xl" />
        <div className="relative max-w-6xl mx-auto px-5 py-16 lg:py-20">
          <div className="fade-in-up">
            <div className="gold-line mb-5" />
            <h1 className="font-serif text-3xl lg:text-4xl font-bold text-white mb-3">发现创作者</h1>
            <p className="text-base lg:text-lg text-ink-200/50">找到你喜欢的卡司、Coser、摄影师、妆造师</p>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-cream to-transparent" />
      </div>

      <div className="max-w-6xl mx-auto px-5 pb-20 -mt-6 relative z-10">
        {/* 筛选按钮 */}
        <div className="flex flex-wrap gap-2.5 mb-10">
          {FILTERS.map(([role, label]) => (
            <button key={role} onClick={() => { setFilter(role); setPage(1); }}
              className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${
                filter === role
                  ? 'bg-gradient-to-r from-ink-800 to-ink-700 text-white shadow-card'
                  : 'glass-card hover:border-gold-400/50 text-ink-500 hover:text-ink-700'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="text-center py-24">
            <p className="text-base text-red-500 mb-4">{error}</p>
            <button onClick={() => window.location.reload()}
              className="text-sm text-gold-600 underline hover:text-gold-500">重新加载</button>
          </div>
        )}

        {/* Loading */}
        {loading && !error && (
          <div className="text-center py-32">
            <div className="w-10 h-10 border-2 border-gold-300 border-t-gold-500 rounded-full animate-spin mx-auto mb-6" />
            <p className="text-base text-ink-300">正在发现创作者...</p>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && filtered.length === 0 && (
          <div className="text-center py-32">
            <div className="text-6xl mb-6 opacity-20">🌊</div>
            <p className="text-lg text-ink-300 mb-4">还没有创作者入驻</p>
            <Link to="/login"
              className="inline-block px-6 py-2.5 bg-gradient-to-r from-gold-500 to-gold-400 text-white text-sm font-medium rounded-[0.75rem] hover:from-gold-400 hover:to-gold-300 transition-all shadow-md shadow-gold-500/20">
              成为第一个
            </Link>
          </div>
        )}

        {/* Creator grid */}
        {!loading && !error && filtered.length > 0 && (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((c, i) => (
                <Link key={c.id} to={`/explore/${c.id}`}
                  className="glass-card glass-card-hover rounded-[1.25rem] p-6 group fade-in-up"
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  {/* 头像区域 */}
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gold-100 to-gold-200 flex items-center justify-center shrink-0 border border-gold-200/50 overflow-hidden group-hover:shadow-md transition-shadow">
                      {c.avatar ? (
                        <img src={c.avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-2xl">{ROLE_EMOJI[c.role_type || ''] || '🎭'}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-ink-800 text-base truncate">{c.display_name}</h3>
                      <p className="text-sm text-ink-400 mt-1">{c.city || '未知城市'} · {c.role_type}</p>
                    </div>
                  </div>

                  {/* 简介预览 */}
                  {c.bio && (
                    <p className="text-sm text-ink-500 leading-relaxed line-clamp-2 mb-4">
                      {c.bio}
                    </p>
                  )}

                  {/* 标签 */}
                  {c.tags && c.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {c.tags.slice(0, 4).map((t, i) => (
                        <span key={i} className="tag-pill">{t}</span>
                      ))}
                      {c.tags.length > 4 && (
                        <span className="text-xs text-ink-300 self-center">+{c.tags.length - 4}</span>
                      )}
                    </div>
                  )}
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-6 mt-12">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-6 py-2.5 glass-card rounded-[0.75rem] text-sm text-ink-500 hover:text-ink-700 hover:border-gold-400/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                  ← 上一页
                </button>
                <span className="text-sm text-ink-400 font-medium">{page} / {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-6 py-2.5 glass-card rounded-[0.75rem] text-sm text-ink-500 hover:text-ink-700 hover:border-gold-400/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                  下一页 →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
