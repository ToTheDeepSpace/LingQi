import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const API = '/api';
const C    = '#0b1a30';
const C2   = '#0f2239';
const GOLD = '#d9a857';

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 16px', borderRadius: 10, fontSize: '0.9rem',
  border: '1px solid rgba(201,146,46,0.2)', outline: 'none',
  backgroundColor: 'rgba(255,255,255,0.04)', color: '#fff',
  boxSizing: 'border-box',
};

export default function Login() {
  const navigate = useNavigate();
  const [phone, setPhone]         = useState('');
  const [password, setPassword]   = useState('');
  const [name, setName]           = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || phone.length < 5) { setError('请填写正确的手机号'); return; }
    if (!password.trim() || password.length < 4) { setError('密码至少4位'); return; }
    if (isRegister && !name.trim()) { setError('请填写昵称'); return; }
    setLoading(true); setError('');
    try {
      const r = await fetch(`${API}/lc/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), password: password.trim(), displayName: name.trim() || undefined }),
      });
      const d = await r.json();
      if (d.success) {
        localStorage.setItem('lc_creator', JSON.stringify(d.data));
        window.dispatchEvent(new Event('lc-auth-changed'));
        navigate('/dashboard');
      } else {
        if (!isRegister && d.error?.includes('未设置密码')) {
          setIsRegister(true);
          setError('该手机号尚未注册，请设置昵称和密码完成注册');
        } else {
          setError(d.error || '操作失败');
        }
      }
    } catch { setError('网络错误'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', backgroundColor: C }}>

      {/* ── 左侧品牌面板 ── */}
      <div style={{
        display: 'none',
        width: '45%', flexShrink: 0,
        backgroundColor: C2, alignItems: 'center', justifyContent: 'center',
        borderRight: '1px solid rgba(201,146,46,0.12)',
        position: 'relative', overflow: 'hidden',
      }} className="lg-flex">
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 70% 55% at 50% 45%, rgba(201,146,46,0.09) 0%, transparent 65%)', pointerEvents: 'none' }} />
        {[500, 360, 220].map((s) => (
          <div key={s} style={{ position: 'absolute', width: s, height: s, borderRadius: '50%', border: '1px solid rgba(201,146,46,0.08)', pointerEvents: 'none', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
        ))}
        <div style={{ position: 'relative', textAlign: 'center', maxWidth: 300 }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: '5rem', background: `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 24 }}>
            灵契
          </div>
          <div style={{ width: 48, height: 2, background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`, margin: '0 auto 32px' }} />
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: '1.15rem', color: 'rgba(226,238,252,0.78)', lineHeight: 2 }}>
            让每一次附身<br />都有名字、口碑<br />和被委托的理由
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 40 }}>
            {['灵契师', '委托人', '配套服务', '红黑榜'].map(r => (
              <span key={r} style={{ padding: '5px 14px', borderRadius: 999, fontSize: '0.8rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(201,146,46,0.18)', color: 'rgba(226,238,252,0.72)' }}>
                {r}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── 右侧表单面板 ── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <div style={{ width: '100%', maxWidth: 420 }}>

          {/* 移动端品牌标识 */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <Link to="/" style={{ textDecoration: 'none', fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: '2rem', background: `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              灵契
            </Link>
          </div>

          <div style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,146,46,0.15)', borderRadius: 20, padding: '36px 32px' }}>
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: '1.5rem', marginBottom: 8, color: '#fff' }}>
                {isRegister ? '创建账号' : '欢迎回来'}
              </h1>
              <p style={{ fontSize: '0.85rem', color: 'rgba(226,238,252,0.68)' }}>
                {isRegister ? '注册后即可使用，发布内容再进入审核' : '登录你的灵契账号'}
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {error && (
                <div style={{ padding: '12px 16px', backgroundColor: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 10, fontSize: '0.85rem', color: '#f87171' }}>
                  {error}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'rgba(186,207,231,0.7)', marginBottom: 8 }}>手机号</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="输入手机号" required style={inputStyle} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'rgba(186,207,231,0.7)', marginBottom: 8 }}>密码</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={isRegister ? '设置密码（至少4位）' : '输入密码'} required style={inputStyle} />
              </div>

              {isRegister && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'rgba(186,207,231,0.7)', marginBottom: 8 }}>昵称 / 艺名</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="你希望别人怎么称呼你" required style={inputStyle} />
                </div>
              )}

              <button type="submit" disabled={loading}
                style={{
                  marginTop: 8, padding: '13px', borderRadius: 10, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                  background: loading ? 'rgba(255,255,255,0.06)' : `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`,
                  color: loading ? 'rgba(186,207,231,0.4)' : C, fontWeight: 700, fontSize: '0.9rem',
                }}>
                {loading ? '处理中...' : isRegister ? '注册并登录' : '登录'}
              </button>

              <p style={{ fontSize: '0.82rem', color: 'rgba(226,238,252,0.68)', textAlign: 'center' }}>
                {isRegister ? (
                  <>已有账号？<button type="button" onClick={() => { setIsRegister(false); setError(''); }}
                    style={{ background: 'none', border: 'none', color: '#f4c873', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, textDecoration: 'underline' }}>去登录</button></>
                ) : (
                  <>没有账号？<button type="button" onClick={() => { setIsRegister(true); setError(''); }}
                    style={{ background: 'none', border: 'none', color: '#f4c873', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, textDecoration: 'underline' }}>立即注册</button></>
                )}
              </p>

              {isRegister && (
                <p style={{ fontSize: '0.75rem', color: 'rgba(226,238,252,0.64)', textAlign: 'center', lineHeight: 1.7 }}>
                  账号注册后立即可用；红黑榜内容、评论和相关方申请会先进入人工审核
                </p>
              )}
            </form>
          </div>

          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <Link to="/" style={{ fontSize: '0.8rem', color: 'rgba(226,238,252,0.7)', textDecoration: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.color = GOLD)}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(226,238,252,0.7)')}>
              ← 返回首页
            </Link>
          </div>
        </div>
      </div>

      <style>{`
        @media (min-width: 1024px) {
          .lg-flex { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
