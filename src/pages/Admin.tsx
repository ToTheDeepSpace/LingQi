import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const API = '/api';

function getToken(): string {
  return localStorage.getItem('lc_admin_token') || '';
}

export default function Admin() {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState('');
  const [profiles, setProfiles] = useState<Record<string, unknown>[]>([]);
  const [requests, setRequests] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('profiles');

  const login = async () => {
    setError('');
    const r = await fetch(`${API}/lc/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const d = await r.json();
    if (d.success) {
      localStorage.setItem('lc_admin_token', d.data.token);
      setAuthed(true);
      loadData(d.data.token);
    } else {
      setError(d.error || '密码错误');
    }
  };

  const loadData = async (token?: string) => {
    const t = token || getToken();
    setLoading(true);
    const r = await fetch(`${API}/lc/admin/pending`, {
      headers: { Authorization: `Bearer ${t}` },
    });
    const d = await r.json();
    if (d.success) {
      setProfiles((d.data as { profiles: Record<string, unknown>[] }).profiles || []);
      setRequests((d.data as { contactRequests: Record<string, unknown>[] }).contactRequests || []);
    }
    setLoading(false);
  };

  const flagProfile = async (id: string) => {
    await fetch(`${API}/lc/admin/profile/${id}/flag`, { method: 'PUT', headers: { Authorization: `Bearer ${getToken()}` } });
    loadData();
  };
  const unflagProfile = async (id: string) => {
    await fetch(`${API}/lc/admin/profile/${id}/unflag`, { method: 'PUT', headers: { Authorization: `Bearer ${getToken()}` } });
    loadData();
  };
  const approveRequest = async (id: string) => {
    await fetch(`${API}/lc/contact-requests/${id}/approve`, { method: 'PUT', headers: { Authorization: `Bearer ${getToken()}` } });
    loadData();
  };
  const rejectRequest = async (id: string) => {
    await fetch(`${API}/lc/contact-requests/${id}/reject`, { method: 'PUT', headers: { Authorization: `Bearer ${getToken()}` } });
    loadData();
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <span className="font-serif text-3xl font-black text-gold-water">灵契</span>
            <p className="text-sm text-ink-400 mt-2">管理后台</p>
          </div>
          <div className="bg-warm-white rounded-[1rem] p-6 border border-gold-200/40 shadow-gold space-y-4">
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gold-200 rounded-[0.75rem] text-sm text-ink-800 placeholder:text-ink-300 bg-cream focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400/30 transition-colors"
              placeholder="管理密码"
              onKeyDown={e => e.key === 'Enter' && login()} />
            <button onClick={login}
              className="w-full py-3 bg-ink-800 text-white text-sm rounded-[0.75rem] hover:bg-ink-700 transition-colors font-medium">
              登录
            </button>
            {error && <p className="text-xs text-red-500 text-center">{error}</p>}
          </div>
        </div>
      </div>
    );
  }

  const profileList = profiles as Array<{ id: string; display_name: string; phone: string; created_at: string; is_visible: boolean }>;
  const requestList = requests as Array<{ id: string; requester_name: string; requester_wechat: string; requester_message?: string; lc_profiles?: { display_name?: string } }>;

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-4xl mx-auto px-5 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-serif text-xl font-bold text-ink-900">灵契管理后台</h1>
            <p className="text-sm text-ink-400 mt-1">创作者管理 & 联系申请审核</p>
          </div>
          <button onClick={() => navigate('/')}
            className="text-sm text-gold-600 hover:text-gold-500 transition-colors">
            返回首页
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 bg-warm-white rounded-[1rem] p-1.5 border border-gold-200/40 shadow-gold mb-6">
          <button onClick={() => setTab('profiles')}
            className={`flex-1 py-2.5 text-sm font-medium rounded-[0.75rem] transition-colors ${
              tab === 'profiles' ? 'bg-ink-800 text-white' : 'text-ink-500 hover:text-ink-700'
            }`}>
            创作者 ({profileList.length})
          </button>
          <button onClick={() => setTab('requests')}
            className={`flex-1 py-2.5 text-sm font-medium rounded-[0.75rem] transition-colors ${
              tab === 'requests' ? 'bg-ink-800 text-white' : 'text-ink-500 hover:text-ink-700'
            }`}>
            联系申请 ({requestList.length})
          </button>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="w-8 h-8 border-2 border-gold-300 border-t-gold-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-base text-ink-300">加载中...</p>
          </div>
        ) : (
          <>
            {tab === 'profiles' && (
              <div className="space-y-3">
                {profileList.map(p => (
                  <div key={p.id}
                    className="bg-warm-white rounded-[1rem] p-5 border border-gold-200/40 shadow-gold flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-ink-800">{p.display_name}</p>
                      <p className="text-sm text-ink-400 mt-0.5">{p.phone} · {p.created_at?.slice(0, 10)}</p>
                    </div>
                    <div className="flex gap-3">
                      {p.is_visible ? (
                        <button onClick={() => flagProfile(p.id)}
                          className="text-sm text-red-500 hover:text-red-700 transition-colors">隐藏</button>
                      ) : (
                        <button onClick={() => unflagProfile(p.id)}
                          className="text-sm text-green-600 hover:text-green-800 transition-colors">显示</button>
                      )}
                    </div>
                  </div>
                ))}
                {profileList.length === 0 && (
                  <p className="text-center text-base text-ink-300 py-20">暂无创作者</p>
                )}
              </div>
            )}

            {tab === 'requests' && (
              <div className="space-y-3">
                {requestList.map(r => (
                  <div key={r.id}
                    className="bg-warm-white rounded-[1rem] p-5 border border-gold-200/40 shadow-gold">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink-800">{r.requester_name}</p>
                        <p className="text-sm text-ink-400 mt-0.5">微信: {r.requester_wechat}</p>
                        <p className="text-sm text-ink-400">发给: {r.lc_profiles?.display_name || '未知'}</p>
                        {r.requester_message && (
                          <p className="text-sm text-ink-500 mt-1.5 bg-cream rounded-lg p-2.5">{r.requester_message}</p>
                        )}
                      </div>
                      <div className="flex gap-2.5 shrink-0">
                        <button onClick={() => approveRequest(r.id)}
                          className="px-4 py-2 bg-green-600 text-white text-sm rounded-[0.75rem] hover:bg-green-700 transition-colors font-medium">
                          通过
                        </button>
                        <button onClick={() => rejectRequest(r.id)}
                          className="px-4 py-2 bg-red-500 text-white text-sm rounded-[0.75rem] hover:bg-red-600 transition-colors font-medium">
                          拒绝
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {requestList.length === 0 && (
                  <p className="text-center text-base text-ink-300 py-20">暂无待审核申请</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
