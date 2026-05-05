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
      <div className="max-w-6xl mx-auto px-5 pt-16 pb-20">
        {/* Header */}
        <div className="mb-10">
          <div className="gold-line mb-5" />
          <h1 className="font-serif text-3xl font-bold text-ink-900 mb-3">发现创作者</h1>
          <p className="text-base text-ink-400">找到你喜欢的卡司、Coser、摄影师、妆造师</p>
        </div>

        {/* Filter buttons */}
        <div className="flex flex-wrap gap-2.5 mb-10">
          {FILTERS.map(([role, label]) => (
            <button key={role} onClick={() => { setFilter(role); setPage(1); }}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${
                filter === role
                  ? 'bg-ink-800 text-white shadow-gold'
                  : 'bg-white text-ink-500 border border-gold-200/40 hover:border-gold-400 hover:text-ink-700'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="text-center py-20">
            <p className="text-base text-red-500 mb-4">{error}</p>
            <button onClick={() => window.location.reload()}
              className="text-sm text-gold-600 underline hover:text-gold-500">重新加载</button>
          </div>
        )}

        {/* Loading */}
        {loading && !error && (
          <div className="text-center py-24">
            <div className="w-8 h-8 border-2 border-gold-300 border-t-gold-500 rounded-full animate-spin mx-auto mb-5" />
            <p className="text-base text-ink-300">加载中...</p>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && filtered.length === 0 && (
          <div className="text-center py-24">
            <div className="text-6xl mb-6 opacity-25">🌊</div>
            <p className="text-base text-ink-300 mb-4">还没有创作者入驻</p>
            <Link to="/login" className="text-sm text-gold-600 underline hover:text-gold-500">成为第一个</Link>
          </div>
        )}

        {/* Creator grid */}
        {!loading && !error && filtered.length > 0 && (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((c) => (
                <Link key={c.id} to={`/explore/${c.id}`}
                  className="card-hover bg-warm-white rounded-[1rem] p-6 border border-gold-200/40">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-gold-100 to-gold-200 flex items-center justify-center text-lg shrink-0 border border-gold-200/60">
                      {c.avatar ? (
                        <img src={c.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gold-400">
                          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 11a4 4 0 100-8 4 4 0 000 8z" />
                        </svg>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-ink-800 text-base truncate">{c.display_name}</h3>
                      <p className="text-sm text-ink-400 mt-0.5">{c.city || '未知城市'} · {c.role_type}</p>
                    </div>
                  </div>
                  {c.tags && c.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {c.tags.map((t, i) => (
                        <span key={i} className="px-2.5 py-0.5 bg-gold-50 text-gold-700 rounded text-xs">{t}</span>
                      ))}
                    </div>
                  )}
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-5 mt-10">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-5 py-2.5 bg-white border border-gold-200 rounded-[0.75rem] text-sm text-ink-500 hover:border-gold-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  上一页
                </button>
                <span className="text-sm text-ink-400">{page} / {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-5 py-2.5 bg-white border border-gold-200 rounded-[0.75rem] text-sm text-ink-500 hover:border-gold-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  下一页
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
