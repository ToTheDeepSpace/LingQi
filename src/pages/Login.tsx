import { useEffect, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { CITIES } from '../constants/cities';

const API = '/api';
const C = '#fffdf8';
const C2 = '#eef6ff';
const GOLD = '#d9a857';
const INK = '#1f2937';
const MUTED = 'rgba(71,85,105,0.76)';

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  borderRadius: 10,
  fontSize: '0.9rem',
  border: '1px solid rgba(201,146,46,0.28)',
  outline: 'none',
  backgroundColor: '#fff',
  color: INK,
  boxSizing: 'border-box',
};

const QUICK_ACTIVITY_CITIES = ['北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '南京'];
const REFERRAL_STORAGE_KEY = 'lc_referral_code';

type LoginMode = 'sms' | 'password';

function storeLogin(data: Record<string, unknown>) {
  localStorage.setItem('lc_creator', JSON.stringify(data));
  if (data.role === 'admin' && typeof data.token === 'string') {
    localStorage.setItem('lc_admin_token', data.token);
    localStorage.setItem('lc_admin_last_login_at', new Date().toISOString());
  } else {
    localStorage.removeItem('lc_admin_token');
  }
  window.dispatchEvent(new Event('lc-auth-changed'));
}

function normalizeReferralCode(input: string | null) {
  return (input || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
}

function decodeWechatPayload(payload: string) {
  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return JSON.parse(decodeURIComponent(escape(atob(padded))));
  } catch {
    try {
      return JSON.parse(atob(payload));
    } catch {
      return null;
    }
  }
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [activityCities, setActivityCities] = useState<string[]>([]);
  const [mode, setMode] = useState<LoginMode>('sms');
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [referralOwner, setReferralOwner] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const rawRef = params.get('ref');
    const storedRef = localStorage.getItem(REFERRAL_STORAGE_KEY);
    const normalizedRef = normalizeReferralCode(rawRef || storedRef);
    if (rawRef && normalizedRef) localStorage.setItem(REFERRAL_STORAGE_KEY, normalizedRef);
    if (normalizedRef) window.setTimeout(() => setReferralCode(normalizedRef), 0);
    const wechatLogin = params.get('wechat_login');
    const authError = params.get('auth_error');
    if (authError) {
      window.setTimeout(() => setError(authError), 0);
      window.history.replaceState(null, '', '/login');
      return;
    }
    if (!wechatLogin) return;
    const data = decodeWechatPayload(wechatLogin);
    if (data?.token) {
      storeLogin(data);
      localStorage.removeItem(REFERRAL_STORAGE_KEY);
      const redirect = params.get('redirect') || '/dashboard';
      navigate(redirect.startsWith('/') ? redirect : '/dashboard', { replace: true });
    } else {
      window.setTimeout(() => setError('微信登录结果无效，请重试'), 0);
      window.history.replaceState(null, '', '/login');
    }
  }, [location.search, navigate]);

  useEffect(() => {
    if (!referralCode) {
      window.setTimeout(() => setReferralOwner(''), 0);
      return;
    }
    let alive = true;
    fetch(`${API}/lc/referrals/resolve/${encodeURIComponent(referralCode)}`)
      .then(r => r.json())
      .then(d => {
        if (!alive) return;
        setReferralOwner(d.success && d.data?.display_name ? d.data.display_name : '');
      })
      .catch(() => {
        if (alive) setReferralOwner('');
      });
    return () => { alive = false; };
  }, [referralCode]);

  const sendCode = async () => {
    if (!phone.trim() || phone.replace(/\D/g, '').length !== 11) {
      setError('请填写正确的手机号');
      return;
    }
    setSending(true);
    setError('');
    try {
      const r = await fetch(`${API}/lc/auth/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const d = await r.json();
      if (d.success) {
        setSent(true);
        setError('验证码已发送，请查看短信');
      } else {
        setError(d.error || '验证码发送失败');
      }
    } catch {
      setError('网络错误');
    } finally {
      setSending(false);
    }
  };

  const startWechatLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ redirect: '/dashboard' });
      if (referralCode) params.set('ref', referralCode);
      const r = await fetch(`${API}/lc/auth/wechat/url?${params.toString()}`);
      const d = await r.json();
      if (d.success && d.data?.url) {
        window.location.href = d.data.url;
      } else {
        setError(d.error || '微信扫码登录尚未配置');
      }
    } catch {
      setError('微信登录启动失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || phone.replace(/\D/g, '').length !== 11) { setError('请填写正确的手机号'); return; }
    if (mode === 'sms' && !code.trim()) { setError('请填写验证码'); return; }
    if (mode === 'password' && (!password.trim() || password.length < 4)) { setError('密码至少4位'); return; }
    if (mode === 'password' && isRegister && !name.trim()) { setError('请填写昵称'); return; }
    setLoading(true);
    setError('');
    try {
      const r = await fetch(mode === 'sms' ? `${API}/lc/auth/phone` : `${API}/lc/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'sms'
          ? { phone: phone.trim(), code: code.trim(), displayName: name.trim() || undefined, activityCities, referralCode: referralCode || undefined }
          : { phone: phone.trim(), password: password.trim(), displayName: name.trim() || undefined, activityCities, referralCode: referralCode || undefined }),
      });
      const d = await r.json();
      if (d.success) {
        storeLogin(d.data);
        localStorage.removeItem(REFERRAL_STORAGE_KEY);
        navigate('/dashboard');
      } else {
        if (mode === 'password' && !isRegister && d.error?.includes('未设置密码')) {
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

  return (
    <div style={{ minHeight: '100vh', display: 'flex', backgroundColor: C, color: INK }}>
      <div style={{
        display: 'none',
        width: '45%',
        flexShrink: 0,
        backgroundColor: C2,
        alignItems: 'center',
        justifyContent: 'center',
        borderRight: '1px solid rgba(201,146,46,0.18)',
        position: 'relative',
        overflow: 'hidden',
      }} className="lg-flex">
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 70% 55% at 50% 45%, rgba(201,146,46,0.14) 0%, transparent 65%)', pointerEvents: 'none' }} />
        {[500, 360, 220].map((s) => (
          <div key={s} style={{ position: 'absolute', width: s, height: s, borderRadius: '50%', border: '1px solid rgba(201,146,46,0.08)', pointerEvents: 'none', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
        ))}
        <div style={{ position: 'relative', textAlign: 'center', maxWidth: 300 }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: '5rem', background: `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 24 }}>
            灵契
          </div>
          <div style={{ width: 48, height: 2, background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`, margin: '0 auto 32px' }} />
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: '1.15rem', color: MUTED, lineHeight: 2 }}>
            用手机号验证身份<br />用微信快速登录<br />把每一次委托留在自己名下
          </p>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <Link to="/" style={{ textDecoration: 'none', fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: '2rem', background: `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              灵契
            </Link>
          </div>

          <div style={{ backgroundColor: '#fffaf2', border: '1px solid rgba(201,146,46,0.2)', borderRadius: 20, padding: '36px 32px', boxShadow: '0 18px 48px rgba(31,41,55,0.08)' }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: '1.5rem', marginBottom: 8, color: INK }}>
                {mode === 'sms' ? '手机号验证登录' : isRegister ? '创建账号' : '密码登录'}
              </h1>
              <p style={{ fontSize: '0.85rem', color: MUTED }}>
                {mode === 'sms' ? '注册和登录都先验证手机号，发布内容再进入审核' : '旧账号仍可使用密码登录'}
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18 }}>
              <button type="button" onClick={() => { setMode('sms'); setError(''); }} style={{
                border: '1px solid rgba(201,146,46,0.24)', borderRadius: 10, padding: '10px 12px',
                background: mode === 'sms' ? 'rgba(217,168,87,0.18)' : '#fff', color: mode === 'sms' ? '#925f18' : MUTED, fontWeight: 800, cursor: 'pointer',
              }}>验证码</button>
              <button type="button" onClick={() => { setMode('password'); setError(''); }} style={{
                border: '1px solid rgba(201,146,46,0.24)', borderRadius: 10, padding: '10px 12px',
                background: mode === 'password' ? 'rgba(217,168,87,0.18)' : '#fff', color: mode === 'password' ? '#925f18' : MUTED, fontWeight: 800, cursor: 'pointer',
              }}>密码备用</button>
            </div>

            {referralCode && (
              <div style={{ padding: '12px 14px', borderRadius: 12, marginBottom: 18, background: 'rgba(240,253,244,0.88)', border: '1px solid rgba(22,163,74,0.18)', color: '#166534', fontSize: '0.82rem', lineHeight: 1.65, fontWeight: 750 }}>
                {referralOwner ? `${referralOwner} 邀请你加入灵契` : '已识别邀请链接'}，注册后额外赠送 10 契约币。
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {error && (
                <div style={{ padding: '12px 16px', backgroundColor: error.includes('已发送') ? 'rgba(240,253,244,0.92)' : 'rgba(254,242,242,0.92)', border: `1px solid ${error.includes('已发送') ? 'rgba(34,197,94,0.24)' : 'rgba(220,38,38,0.24)'}`, borderRadius: 10, fontSize: '0.85rem', color: error.includes('已发送') ? '#15803d' : '#b91c1c' }}>
                  {error}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'rgba(71,85,105,0.82)', marginBottom: 8 }}>手机号</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="输入手机号" required style={inputStyle} />
              </div>

              {mode === 'sms' ? (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'rgba(71,85,105,0.82)', marginBottom: 8 }}>验证码</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 112px', gap: 8 }}>
                      <input type="text" value={code} onChange={e => setCode(e.target.value)} placeholder="6位验证码" required style={inputStyle} />
                      <button type="button" onClick={sendCode} disabled={sending} style={{ border: '1px solid rgba(201,146,46,0.32)', borderRadius: 10, background: '#fff', color: '#925f18', fontWeight: 800, cursor: sending ? 'not-allowed' : 'pointer' }}>
                        {sending ? '发送中' : sent ? '重发' : '获取'}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'rgba(71,85,105,0.82)', marginBottom: 8 }}>昵称 / 艺名（首次登录可填）</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="不填则使用手机号后四位生成昵称" style={inputStyle} />
                  </div>
                  <CityPreferenceField cities={activityCities} onChange={setActivityCities} />
                </>
              ) : (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'rgba(71,85,105,0.82)', marginBottom: 8 }}>密码</label>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={isRegister ? '设置密码（至少4位）' : '输入密码'} required style={inputStyle} />
                  </div>
                  {isRegister && (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'rgba(71,85,105,0.82)', marginBottom: 8 }}>昵称 / 艺名</label>
                      <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="你希望别人怎么称呼你" required style={inputStyle} />
                    </div>
                  )}
                  {isRegister && <CityPreferenceField cities={activityCities} onChange={setActivityCities} />}
                </>
              )}

              <button type="submit" disabled={loading}
                style={{
                  marginTop: 4, padding: '13px', borderRadius: 10, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                  background: loading ? 'rgba(241,245,249,0.86)' : `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`,
                  color: loading ? 'rgba(71,85,105,0.42)' : INK, fontWeight: 800, fontSize: '0.9rem',
                }}>
                {loading ? '处理中...' : mode === 'sms' ? '验证并登录' : isRegister ? '注册并登录' : '登录'}
              </button>

              <button type="button" onClick={startWechatLogin} disabled={loading}
                style={{ padding: '12px', borderRadius: 10, border: '1px solid rgba(34,197,94,0.26)', background: '#f0fdf4', color: '#166534', fontWeight: 850, cursor: loading ? 'not-allowed' : 'pointer' }}>
                微信扫码登录
              </button>

              {mode === 'password' && (
                <p style={{ fontSize: '0.82rem', color: MUTED, textAlign: 'center' }}>
                  {isRegister ? (
                    <>已有账号？<button type="button" onClick={() => { setIsRegister(false); setError(''); }}
                      style={{ background: 'none', border: 'none', color: '#925f18', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 800, textDecoration: 'underline' }}>去登录</button></>
                  ) : (
                    <>没有密码账号？<button type="button" onClick={() => { setIsRegister(true); setError(''); }}
                      style={{ background: 'none', border: 'none', color: '#925f18', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 800, textDecoration: 'underline' }}>创建密码账号</button></>
                  )}
                </p>
              )}

              <p style={{ fontSize: '0.75rem', color: 'rgba(71,85,105,0.64)', textAlign: 'center', lineHeight: 1.7 }}>
                验证码用于确认手机号归属；登录、发布、评论、举报等关键操作会依法留存必要日志。
              </p>
            </form>
          </div>

          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <Link to="/" style={{ fontSize: '0.8rem', color: 'rgba(39,83,137,0.78)', textDecoration: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.color = GOLD)}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(39,83,137,0.78)')}>
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

function CityPreferenceField({ cities, onChange }: { cities: string[]; onChange: (value: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const addCity = (value = draft) => {
    const next = value.trim().slice(0, 40);
    if (!next) return;
    if (cities.includes(next)) {
      setDraft('');
      return;
    }
    onChange([...cities, next].slice(0, 8));
    setDraft('');
  };
  const removeCity = (value: string) => onChange(cities.filter(item => item !== value));

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'rgba(71,85,105,0.82)', marginBottom: 8 }}>
        主要活动城市（可多选，用于默认展示同城红黑榜）
      </label>
      {cities.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {cities.map(item => (
            <button
              key={item}
              type="button"
              onClick={() => removeCity(item)}
              style={{
                border: '1px solid rgba(217,168,87,0.32)',
                borderRadius: 999,
                padding: '5px 9px',
                background: 'rgba(217,168,87,0.12)',
                color: '#925f18',
                fontSize: '0.76rem',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              {item} ×
            </button>
          ))}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 72px', gap: 8 }}>
        <input
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addCity();
            }
          }}
          placeholder="例如：北京、上海、保定"
          list="lc-login-city-options"
          style={inputStyle}
        />
        <button
          type="button"
          onClick={() => addCity()}
          style={{
            border: '1px solid rgba(201,146,46,0.32)',
            borderRadius: 10,
            background: '#fff',
            color: '#925f18',
            fontWeight: 850,
            cursor: 'pointer',
          }}
        >
          添加
        </button>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {QUICK_ACTIVITY_CITIES.map(item => (
          <button
            key={item}
            type="button"
            onClick={() => addCity(item)}
            disabled={cities.includes(item)}
            style={{
              border: '1px solid rgba(201,146,46,0.18)',
              borderRadius: 999,
              padding: '4px 8px',
              background: cities.includes(item) ? 'rgba(148,163,184,0.12)' : '#fff',
              color: cities.includes(item) ? 'rgba(71,85,105,0.42)' : 'rgba(39,83,137,0.78)',
              fontSize: '0.72rem',
              fontWeight: 750,
              cursor: cities.includes(item) ? 'default' : 'pointer',
            }}
          >
            {item}
          </button>
        ))}
      </div>
      <p style={{ margin: 0, color: 'rgba(71,85,105,0.56)', fontSize: '0.72rem', lineHeight: 1.55 }}>
        之后可以在个人后台继续修改；未选择时默认看全部城市。
      </p>
      <datalist id="lc-login-city-options">
        {CITIES.map(item => <option key={item} value={item} />)}
      </datalist>
    </div>
  );
}
