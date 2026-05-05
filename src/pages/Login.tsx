import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const API = '/api';

export default function Login() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || phone.length < 5) { setError('请填写正确的手机号'); return; }
    if (!password.trim() || password.length < 4) { setError('密码至少4位'); return; }
    if (isRegister && !name.trim()) { setError('请填写昵称'); return; }

    setLoading(true);
    setError('');

    try {
      const r = await fetch(`${API}/lc/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), password: password.trim(), displayName: name.trim() || undefined }),
      });
      const d = await r.json();
      if (d.success) {
        localStorage.setItem('lc_creator', JSON.stringify(d.data));
        navigate('/dashboard');
      } else {
        if (!isRegister && d.error?.includes('未设置密码')) {
          setIsRegister(true);
          setError('该手机号尚未注册，请设置昵称和密码完成注册');
        } else {
          setError(d.error || '操作失败');
        }
      }
    } catch {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  };

  const roleBadges = ['卡司/DM', 'Coser', '摄影师', '妆造师'];

  return (
    <div className="min-h-screen flex">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-[42%] xl:w-[45%] bg-gradient-to-br from-ink-900 via-ink-800 to-ink-700 items-center justify-center p-16 relative overflow-hidden">
        {/* Gold dot pattern */}
        <div className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage: 'radial-gradient(circle, #d9a857 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }} />
        {/* Decorative ripples */}
        <div className="ripple-bg w-[600px] h-[600px] border-gold-400/8" />
        <div className="ripple-bg w-[350px] h-[350px] border-gold-400/6" style={{ animationDelay: '3s' }} />

        <div className="relative text-center text-white max-w-sm">
          <div className="mb-10">
            <span className="text-7xl font-serif font-black text-gold-water">灵契</span>
            <div className="gold-line mx-auto mt-6 opacity-40" />
          </div>
          <p className="text-xl text-ink-200/80 leading-relaxed">
            让每个把纸片人<br />带到现实的人<br />都被看见
          </p>
          <div className="mt-12 flex flex-wrap gap-x-4 gap-y-2 justify-center text-sm text-ink-300/50">
            {roleBadges.map((role, i) => (
              <span key={role}>
                {role}
                {i < roleBadges.length - 1 && <span className="ml-4 text-ink-400/20">·</span>}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center px-8 py-12 bg-cream lg:bg-white">
        <div className="w-full max-w-[400px]">
          {/* Mobile-only brand header */}
          <div className="text-center mb-8 lg:hidden">
            <Link to="/" className="font-serif text-2xl font-black text-gold-water">灵契</Link>
          </div>

          <div className="mb-8">
            <h1 className="font-serif text-[1.75rem] font-bold text-ink-800">
              {isRegister ? '创建账号' : '欢迎回来'}
            </h1>
            <p className="text-sm text-ink-400 mt-2">
              {isRegister ? '填写信息，创建你的创作者主页' : '登录你的创作者主页'}
            </p>
          </div>

          <form onSubmit={handleSubmit}
            className="bg-warm-white rounded-[1rem] p-6 lg:p-8 border border-gold-200/40 shadow-gold space-y-5">
            {error && (
              <div className="p-3 bg-red-50 text-red-600 rounded-[0.75rem] text-sm border border-red-100">
                {error}
              </div>
            )}

            <div>
              <label className="text-xs text-ink-500 mb-1.5 block font-medium">手机号</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                className="w-full px-4 py-3 border border-gold-200 rounded-[0.75rem] text-sm text-ink-800 placeholder:text-ink-300 bg-cream focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400/30 transition-colors"
                placeholder="输入手机号" required />
            </div>

            <div>
              <label className="text-xs text-ink-500 mb-1.5 block font-medium">密码</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gold-200 rounded-[0.75rem] text-sm text-ink-800 placeholder:text-ink-300 bg-cream focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400/30 transition-colors"
                placeholder={isRegister ? '设置密码（至少4位）' : '输入密码'} required />
            </div>

            {isRegister && (
              <div>
                <label className="text-xs text-ink-500 mb-1.5 block font-medium">昵称 / 艺名</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  className="w-full px-4 py-3 border border-gold-200 rounded-[0.75rem] text-sm text-ink-800 placeholder:text-ink-300 bg-cream focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400/30 transition-colors"
                  placeholder="你希望别人怎么称呼你" required />
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3 bg-gold-500 text-white rounded-[0.75rem] font-medium hover:bg-gold-400 disabled:opacity-50 transition-colors text-sm">
              {loading ? '处理中...' : isRegister ? '注册并登录' : '登录'}
            </button>

            <p className="text-xs text-ink-400 text-center pt-1">
              {isRegister ? (
                <>已有账号？<button type="button" onClick={() => { setIsRegister(false); setError(''); }} className="text-gold-600 underline hover:text-gold-500">去登录</button></>
              ) : (
                <>没有账号？<button type="button" onClick={() => { setIsRegister(true); setError(''); }} className="text-gold-600 underline hover:text-gold-500">立即注册</button></>
              )}
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
