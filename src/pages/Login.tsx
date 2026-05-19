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
      {/* ============ 左侧品牌面板 (深色系) ============ */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[48%] bg-hero-dark items-center justify-center p-16 relative overflow-hidden">
        {/* 金色纹理 */}
        <div className="absolute inset-0 opacity-[0.04] bg-dot-pattern" />

        {/* 光晕 */}
        <div className="absolute top-1/3 -right-20 w-[500px] h-[500px] rounded-full bg-gradient-to-bl from-gold-500/10 via-gold-400/5 to-transparent blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-gradient-to-tr from-ink-600/15 to-transparent blur-3xl" />

        {/* 装饰圈 */}
        <div className="ripple-bg w-[500px] h-[500px] border-gold-400/8" />
        <div className="ripple-bg w-[300px] h-[300px] border-gold-400/5" style={{ animationDelay: '3s' }} />

        <div className="relative text-center text-white max-w-sm fade-in-up">
          <div className="mb-12">
            <span className="text-7xl font-serif font-black gradient-text">灵契</span>
            <div className="gold-line mx-auto mt-8 opacity-50" />
          </div>
          <p className="text-2xl text-ink-200/70 leading-relaxed font-serif">
            让每个把纸片人<br />带到现实的人<br />都被看见
          </p>
          <div className="mt-14 flex flex-wrap gap-x-5 gap-y-2.5 justify-center text-sm text-ink-300/40">
            {roleBadges.map((role, i) => (
              <span key={role} className="px-3 py-1 rounded-full bg-white/5 border border-white/5">
                {role}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ============ 右侧表单面板 ============ */}
      <div className="flex-1 flex items-center justify-center px-8 py-16 bg-gradient-to-br from-cream to-ink-50/30">
        <div className="w-full max-w-[420px]">
          {/* 移动端品牌标识 */}
          <div className="text-center mb-8 lg:hidden">
            <Link to="/" className="font-serif text-3xl font-black gradient-text">灵契</Link>
          </div>

          <div className="glass-card rounded-[1.5rem] p-8 lg:p-10 space-y-6">
            {/* Header */}
            <div className="text-center mb-2">
              <h1 className="font-serif text-2xl font-bold text-ink-800">
                {isRegister ? '创建账号' : '欢迎回来'}
              </h1>
              <p className="text-sm text-ink-400 mt-2.5">
                {isRegister ? '填写信息，创建你的创作者主页' : '登录你的创作者主页'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="p-3.5 bg-red-50 text-red-600 rounded-[0.75rem] text-sm border border-red-100 animate-fade-in">
                  {error}
                </div>
              )}

              <div>
                <label className="text-xs text-ink-500 mb-1.5 block font-semibold">手机号</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  className="w-full px-4 py-3 input-enhanced rounded-[0.75rem] text-sm text-ink-800 placeholder:text-ink-300 bg-cream/80"
                  placeholder="输入手机号" required />
              </div>

              <div>
                <label className="text-xs text-ink-500 mb-1.5 block font-semibold">密码</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-3 input-enhanced rounded-[0.75rem] text-sm text-ink-800 placeholder:text-ink-300 bg-cream/80"
                  placeholder={isRegister ? '设置密码（至少4位）' : '输入密码'} required />
              </div>

              {isRegister && (
                <div className="animate-fade-in">
                  <label className="text-xs text-ink-500 mb-1.5 block font-semibold">昵称 / 艺名</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)}
                    className="w-full px-4 py-3 input-enhanced rounded-[0.75rem] text-sm text-ink-800 placeholder:text-ink-300 bg-cream/80"
                    placeholder="你希望别人怎么称呼你" required />
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full py-3.5 bg-gradient-to-r from-gold-500 to-gold-400 text-white rounded-[0.75rem] font-semibold hover:from-gold-400 hover:to-gold-300 disabled:opacity-50 transition-all text-sm shadow-md shadow-gold-500/20 hover:shadow-lg hover:shadow-gold-500/30">
                {loading ? '处理中...' : isRegister ? '注册并登录' : '登录'}
              </button>

              <p className="text-xs text-ink-400 text-center pt-2">
                {isRegister ? (
                  <>已有账号？<button type="button" onClick={() => { setIsRegister(false); setError(''); }} className="text-gold-600 font-medium underline hover:text-gold-500">去登录</button></>
                ) : (
                  <>没有账号？<button type="button" onClick={() => { setIsRegister(true); setError(''); }} className="text-gold-600 font-medium underline hover:text-gold-500">立即注册</button></>
                )}
              </p>
            </form>
          </div>

          {/* 底部链接 */}
          <div className="text-center mt-6">
            <Link to="/" className="text-xs text-ink-300 hover:text-gold-500 transition-colors">
              ← 返回首页
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
