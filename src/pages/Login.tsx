import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { readStoredCreatorAuth } from '../lib/authSession';

const API = '/api';
const C = '#fffdf8';
const C2 = '#eef6ff';
const GOLD = '#d9a857';
const INK = '#1f2937';
const MUTED = 'rgba(71,85,105,0.76)';

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 'var(--lq-input-padding, 12px 16px)',
  borderRadius: 'var(--lq-control-radius, 10px)',
  fontSize: 'var(--lq-input-font-size, 0.9rem)',
  border: '1px solid rgba(201,146,46,0.28)',
  outline: 'none',
  backgroundColor: '#fff',
  color: INK,
  boxSizing: 'border-box',
};

const REFERRAL_STORAGE_KEY = 'lc_referral_code';

type LoginMode = 'password' | 'register';
type RegisterAccountKind = 'phone' | 'email';

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

function phoneDigits(input: string) {
  return input.replace(/\D/g, '');
}

function isValidPhone(input: string) {
  return /^1[3-9]\d{9}$/.test(phoneDigits(input));
}

function isValidEmail(input: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.trim());
}

function getRegisterAccountKind(input: string): RegisterAccountKind | null {
  if (isValidPhone(input)) return 'phone';
  if (isValidEmail(input)) return 'email';
  return null;
}

function normalizeRegisterAccount(input: string, kind: RegisterAccountKind) {
  return kind === 'phone' ? phoneDigits(input) : input.trim().toLowerCase();
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
  const [mode, setMode] = useState<LoginMode>('password');
  const [loginAccount, setLoginAccount] = useState('');
  const [password, setPassword] = useState('');
  const [registerAccount, setRegisterAccount] = useState('');
  const [registerCode, setRegisterCode] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerPasswordConfirm, setRegisterPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [message, setMessage] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [referralOwner, setReferralOwner] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [sentCodeTarget, setSentCodeTarget] = useState<{ kind: RegisterAccountKind; value: string } | null>(null);

  const registerKind = getRegisterAccountKind(registerAccount);
  const registerTarget = registerKind ? normalizeRegisterAccount(registerAccount, registerKind) : '';
  const sentToCurrentAccount = Boolean(
    registerKind && sentCodeTarget?.kind === registerKind && sentCodeTarget.value === registerTarget,
  );
  const isPositiveMessage = message.includes('已发送') || message.includes('请查看');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('wechat_login') || params.get('auth_error')) return;
    const current = readStoredCreatorAuth();
    if (!current) return;
    const redirect = params.get('redirect') || '/dashboard';
    navigate(redirect.startsWith('/') ? redirect : '/dashboard', { replace: true });
  }, [location.search, navigate]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const rawRef = params.get('ref');
    const normalizedRef = normalizeReferralCode(rawRef);
    if (normalizedRef) {
      localStorage.setItem(REFERRAL_STORAGE_KEY, normalizedRef);
      window.setTimeout(() => setReferralCode(normalizedRef), 0);
    } else {
      localStorage.removeItem(REFERRAL_STORAGE_KEY);
      window.setTimeout(() => setReferralCode(''), 0);
    }
    const wechatLogin = params.get('wechat_login');
    const authError = params.get('auth_error');
    if (authError) {
      window.setTimeout(() => setMessage(authError), 0);
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
      window.setTimeout(() => setMessage('微信登录结果无效，请重试'), 0);
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

  const switchMode = (nextMode: LoginMode) => {
    setMode(nextMode);
    setMessage('');
  };

  const handleRegisterAccountChange = (value: string) => {
    setRegisterAccount(value);
    setRegisterCode('');
    setSentCodeTarget(null);
    setMessage('');
  };

  const sendRegisterCode = async () => {
    if (!registerAccount.trim()) {
      setMessage('请先填写手机号或邮箱');
      return;
    }
    if (!registerKind) {
      setMessage('请填写正确的手机号或邮箱');
      return;
    }
    const endpoint = registerKind === 'phone' ? `${API}/lc/auth/send-code` : `${API}/lc/auth/email/send-code`;
    const body = registerKind === 'phone' ? { phone: registerTarget } : { email: registerTarget };

    setSendingCode(true);
    setMessage('');
    try {
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (d.success) {
        setSentCodeTarget({ kind: registerKind, value: registerTarget });
        setMessage(registerKind === 'phone' ? '验证码已发送，请查看短信' : '验证码已发送，请查看邮箱或垃圾邮件');
      } else {
        setMessage(d.error || '验证码发送失败');
      }
    } catch {
      setMessage('网络错误');
    } finally {
      setSendingCode(false);
    }
  };

  const startWechatLogin = async () => {
    if (!acceptedTerms) {
      setMessage('请先阅读并同意用户协议和隐私政策');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const params = new URLSearchParams({ redirect: '/dashboard' });
      if (referralCode) params.set('ref', referralCode);
      const r = await fetch(`${API}/lc/auth/wechat/url?${params.toString()}`);
      const d = await r.json();
      if (d.success && d.data?.url) {
        window.location.href = d.data.url;
      } else {
        setMessage(d.error || '微信扫码登录尚未配置');
      }
    } catch {
      setMessage('微信登录启动失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptedTerms) { setMessage('请先阅读并同意用户协议和隐私政策'); return; }

    if (mode === 'password') {
      if (!loginAccount.trim()) { setMessage('请填写手机号或邮箱'); return; }
      if (!password.trim() || password.length < 4) { setMessage('密码至少4位'); return; }
    } else {
      if (!registerKind) { setMessage('请填写正确的手机号或邮箱'); return; }
      if (!sentToCurrentAccount) { setMessage('请先为当前账号发送验证码'); return; }
      if (!registerCode.trim()) { setMessage('请填写验证码'); return; }
      if (registerPassword.length < 6) { setMessage('密码至少6位'); return; }
      if (registerPassword !== registerPasswordConfirm) { setMessage('两次输入的密码不一致'); return; }
    }

    setLoading(true);
    setMessage('');
    try {
      const endpoint = mode === 'register'
        ? registerKind === 'phone'
          ? `${API}/lc/auth/phone`
          : `${API}/lc/auth/email`
        : `${API}/lc/auth`;
      const body = mode === 'register'
        ? registerKind === 'phone'
          ? {
            phone: registerTarget,
            code: registerCode.trim(),
            password: registerPassword,
            passwordConfirm: registerPasswordConfirm,
            referralCode: referralCode || undefined,
          }
          : {
            email: registerTarget,
            code: registerCode.trim(),
            password: registerPassword,
            passwordConfirm: registerPasswordConfirm,
            referralCode: referralCode || undefined,
          }
        : {
          account: loginAccount.trim(),
          password: password.trim(),
          referralCode: referralCode || undefined,
        };
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (d.success) {
        storeLogin(d.data);
        if (d.data?.new_user) localStorage.setItem('lc_onboarding_pending', '1');
        localStorage.removeItem(REFERRAL_STORAGE_KEY);
        navigate('/dashboard');
      } else {
        setMessage(d.error || '操作失败');
      }
    } catch {
      setMessage('网络错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page" style={{ minHeight: '100svh', display: 'flex', backgroundColor: C, color: INK }}>
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
            日常用密码登录<br />注册时主动验证账号<br />把每一次委托留在自己名下
          </p>
        </div>
      </div>

      <div className="login-main" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--lq-login-main-padding, 40px 20px)' }}>
        <div className="login-shell" style={{ width: '100%', maxWidth: 420 }}>
          <div className="login-logo" style={{ textAlign: 'center', marginBottom: 'var(--lq-logo-margin, 28px)' }}>
            <Link to="/" style={{ textDecoration: 'none', fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: '2rem', background: `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              灵契
            </Link>
          </div>

          <div className={`login-card ${mode === 'register' ? 'register-card' : ''}`} style={{ backgroundColor: '#fffaf2', border: '1px solid rgba(201,146,46,0.2)', borderRadius: 'var(--lq-card-radius, 20px)', padding: 'var(--lq-card-padding, 32px)', boxShadow: '0 18px 48px rgba(31,41,55,0.08)' }}>
            <div className="login-header" style={{ textAlign: 'center', marginBottom: 'var(--lq-header-margin, 20px)' }}>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: '1.45rem', marginBottom: 8, color: INK }}>
                {mode === 'register' ? '注册灵契账号' : '登录灵契'}
              </h1>
              <p className="login-subtitle" style={{ fontSize: '0.84rem', color: MUTED, margin: 0, lineHeight: 1.7 }}>
                {mode === 'register' ? '手机号和邮箱合并在一个入口，验证码必须手动点击发送。' : '日常登录默认使用手机号或邮箱 + 密码。'}
              </p>
            </div>

            <div className="login-tabs" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--lq-tab-gap, 8px)', marginBottom: 'var(--lq-tabs-margin, 18px)' }}>
              <button type="button" onClick={() => switchMode('password')} style={{
                border: '1px solid rgba(201,146,46,0.24)', borderRadius: 'var(--lq-control-radius, 10px)', padding: 'var(--lq-tab-padding, 10px 12px)', fontSize: 'var(--lq-tab-font-size, 0.88rem)',
                background: mode === 'password' ? 'rgba(217,168,87,0.18)' : '#fff', color: mode === 'password' ? '#925f18' : MUTED, fontWeight: 800, cursor: 'pointer',
              }}>登录</button>
              <button type="button" onClick={() => switchMode('register')} style={{
                border: '1px solid rgba(201,146,46,0.24)', borderRadius: 'var(--lq-control-radius, 10px)', padding: 'var(--lq-tab-padding, 10px 12px)', fontSize: 'var(--lq-tab-font-size, 0.88rem)',
                background: mode === 'register' ? 'rgba(217,168,87,0.18)' : '#fff', color: mode === 'register' ? '#925f18' : MUTED, fontWeight: 800, cursor: 'pointer',
              }}>注册账号</button>
            </div>

            {referralCode && (
              <div className="referral-banner" style={{ padding: '10px 12px', borderRadius: 12, marginBottom: 14, background: 'rgba(240,253,244,0.88)', border: '1px solid rgba(22,163,74,0.18)', color: '#166534', fontSize: '0.8rem', lineHeight: 1.55, fontWeight: 750 }}>
                {referralOwner ? `${referralOwner} 邀请你加入灵契` : '已识别邀请链接'}，注册后额外赠送 10 契约币。
              </div>
            )}

            <form className="login-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--lq-form-gap, 14px)' }}>
              {mode === 'register' ? (
                <>
                  <Field label="手机号或邮箱">
                    <div className="code-row" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8 }}>
                      <input
                        type="text"
                        value={registerAccount}
                        onChange={e => handleRegisterAccountChange(e.target.value)}
                        placeholder="手机号 / 邮箱"
                        required
                        style={inputStyle}
                      />
                      <button
                        type="button"
                        onClick={sendRegisterCode}
                        disabled={sendingCode || loading || !registerAccount.trim()}
                        style={{
                          border: 'none',
                          borderRadius: 'var(--lq-control-radius, 10px)',
                          padding: '0 12px',
                          background: sendingCode || loading || !registerAccount.trim() ? 'rgba(241,245,249,0.9)' : '#1f2937',
                          color: sendingCode || loading || !registerAccount.trim() ? 'rgba(71,85,105,0.42)' : '#fff',
                          fontWeight: 850,
                          fontSize: '0.82rem',
                          cursor: sendingCode || loading || !registerAccount.trim() ? 'not-allowed' : 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {sendingCode ? '发送中' : sentToCurrentAccount ? '重发验证码' : '发送验证码'}
                      </button>
                    </div>
                    <p className="register-code-tip" style={{ margin: '6px 0 0', color: 'rgba(71,85,105,0.58)', fontSize: '0.74rem', lineHeight: 1.5 }}>
                      {registerKind === 'phone'
                        ? '将发送短信验证码。'
                        : registerKind === 'email'
                          ? '将发送邮箱验证码。'
                          : '填手机号发短信，填邮箱发邮件；不会自动发送。'}
                    </p>
                  </Field>

                  <Field label="验证码">
                    <input
                      type="text"
                      value={registerCode}
                      onChange={e => setRegisterCode(e.target.value)}
                      placeholder="6位验证码"
                      required
                      inputMode="numeric"
                      style={inputStyle}
                    />
                  </Field>

                  <PasswordSetupFields
                    password={registerPassword}
                    confirm={registerPasswordConfirm}
                    onPasswordChange={setRegisterPassword}
                    onConfirmChange={setRegisterPasswordConfirm}
                  />

                  <p className="register-footnote" style={{ margin: 0, color: 'rgba(71,85,105,0.64)', fontSize: '0.76rem', lineHeight: 1.6 }}>
                    昵称、头像、常用城市进站后再设置。昵称只是公开展示名，不是登录账号；登录账号是手机号或邮箱。
                  </p>
                </>
              ) : (
                <>
                  <Field label="手机号或邮箱">
                    <input
                      type="text"
                      value={loginAccount}
                      onChange={e => setLoginAccount(e.target.value)}
                      placeholder="输入手机号或邮箱"
                      required
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="密码">
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="输入密码"
                      required
                      style={inputStyle}
                    />
                  </Field>
                </>
              )}

              <label className="terms-check" style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: 'var(--lq-terms-padding, 11px 13px)',
                borderRadius: 'var(--lq-control-radius, 12px)',
                border: '1px solid rgba(201,146,46,0.2)',
                background: 'rgba(255,255,255,0.72)',
                color: MUTED,
                fontSize: '0.77rem',
                lineHeight: 1.7,
              }}>
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={e => setAcceptedTerms(e.target.checked)}
                  style={{ marginTop: 4, width: 16, height: 16, accentColor: GOLD, flexShrink: 0 }}
                />
                <span>
                  我已阅读并同意
                  <Link to="/terms" target="_blank" style={{ color: '#925f18', fontWeight: 850, textDecoration: 'none', margin: '0 4px' }}>《用户协议》</Link>
                  和
                  <Link to="/privacy" target="_blank" style={{ color: '#925f18', fontWeight: 850, textDecoration: 'none', margin: '0 4px' }}>《隐私政策》</Link>
                  <span className="terms-extra">，知悉红黑白榜、委托、拼车、契约币、审核和线下合作责任规则。</span>
                </span>
              </label>

              {message && (
                <div className="login-message" style={{ padding: 'var(--lq-message-padding, 10px 12px)', backgroundColor: isPositiveMessage ? 'rgba(240,253,244,0.92)' : 'rgba(254,242,242,0.92)', border: `1px solid ${isPositiveMessage ? 'rgba(34,197,94,0.24)' : 'rgba(220,38,38,0.24)'}`, borderRadius: 'var(--lq-control-radius, 10px)', fontSize: '0.83rem', color: isPositiveMessage ? '#15803d' : '#b91c1c' }}>
                  {message}
                </div>
              )}

              <button type="submit" disabled={loading || !acceptedTerms}
                style={{
                  marginTop: 2, padding: 'var(--lq-primary-padding, 12px)', borderRadius: 'var(--lq-control-radius, 10px)', border: 'none', cursor: loading || !acceptedTerms ? 'not-allowed' : 'pointer',
                  background: loading || !acceptedTerms ? 'rgba(241,245,249,0.86)' : `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`,
                  color: loading || !acceptedTerms ? 'rgba(71,85,105,0.42)' : INK, fontWeight: 850, fontSize: '0.9rem',
                }}>
                {loading ? '处理中...' : mode === 'password' ? '登录' : '注册并进入灵契'}
              </button>

              {mode === 'password' && (
                <>
                  <button type="button" onClick={startWechatLogin} disabled={loading || !acceptedTerms}
                    style={{ padding: '11px', borderRadius: 10, border: '1px solid rgba(34,197,94,0.26)', background: loading || !acceptedTerms ? 'rgba(241,245,249,0.86)' : '#f0fdf4', color: loading || !acceptedTerms ? 'rgba(71,85,105,0.42)' : '#166534', fontWeight: 850, cursor: loading || !acceptedTerms ? 'not-allowed' : 'pointer' }}>
                    微信扫码登录
                  </button>
                  <p className="auth-switch-tip" style={{ fontSize: '0.8rem', color: MUTED, textAlign: 'center', margin: 0 }}>
                    新用户先点上方“注册账号”。忘记密码时，也可以用注册入口验证手机号或邮箱后重新设置密码。
                  </p>
                </>
              )}

              <p className="auth-note" style={{ fontSize: '0.74rem', color: 'rgba(71,85,105,0.64)', textAlign: 'center', lineHeight: 1.65, margin: 0 }}>
                验证码只用于注册、绑定、找回或修改敏感账号信息；登录、发布、评论、举报等关键操作会依法留存必要日志。
              </p>
            </form>
          </div>

          <div className="login-back" style={{ textAlign: 'center', marginTop: 22 }}>
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
          .login-page {
            --lq-login-main-padding: 24px 28px;
            --lq-logo-margin: 0;
            --lq-card-padding: 26px 28px;
            --lq-header-margin: 14px;
            --lq-tabs-margin: 12px;
            --lq-form-gap: 10px;
            --lq-input-padding: 10px 12px;
            --lq-terms-padding: 9px 11px;
            --lq-primary-padding: 10px;
          }
          .login-logo { display: none !important; }
          .login-shell { max-width: 392px !important; }
          .login-back { margin-top: 12px !important; }
        }
        @media (min-width: 1024px) and (max-height: 860px) {
          .login-page {
            --lq-login-main-padding: 18px 24px;
            --lq-card-padding: 22px 24px;
            --lq-header-margin: 10px;
            --lq-tabs-margin: 10px;
            --lq-form-gap: 8px;
            --lq-input-padding: 9px 11px;
            --lq-tab-padding: 8px 10px;
            --lq-primary-padding: 9px;
          }
          .login-header h1 { font-size: 1.22rem !important; margin-bottom: 3px !important; }
          .login-subtitle,
          .register-footnote,
          .auth-note,
          .auth-switch-tip {
            display: none !important;
          }
          .login-form label:not(.terms-check) {
            margin-bottom: 5px !important;
          }
          .register-code-tip {
            margin-top: 4px !important;
            line-height: 1.35 !important;
          }
          .terms-check {
            line-height: 1.38 !important;
          }
          .login-back { display: none !important; }
        }
        @media (max-width: 640px) {
          .login-page {
            --lq-login-main-padding: 8px 12px;
            --lq-logo-margin: 6px;
            --lq-card-padding: 12px;
            --lq-card-radius: 14px;
            --lq-control-radius: 8px;
            --lq-input-padding: 8px 10px;
            --lq-input-font-size: 0.84rem;
            --lq-header-margin: 8px;
            --lq-tabs-margin: 8px;
            --lq-tab-gap: 6px;
            --lq-tab-padding: 8px 6px;
            --lq-tab-font-size: 0.78rem;
            --lq-form-gap: 8px;
            --lq-message-padding: 8px 10px;
            --lq-terms-padding: 8px 10px;
            --lq-primary-padding: 10px;
            --lq-password-gap: 8px;
          }
          .login-main { align-items: flex-start !important; }
          .login-logo a { font-size: 1.4rem !important; }
          .login-header h1 { font-size: 1.08rem !important; margin-bottom: 2px !important; }
          .login-subtitle,
          .register-footnote,
          .auth-note,
          .terms-extra,
          .login-back {
            display: none !important;
          }
          .login-form label:not(.terms-check) {
            margin-bottom: 4px !important;
            font-size: 0.72rem !important;
          }
          .register-code-tip {
            font-size: 0.7rem !important;
            line-height: 1.25 !important;
            margin-top: 3px !important;
          }
          .password-grid {
            grid-template-columns: 1fr 1fr;
          }
          .terms-check {
            line-height: 1.35 !important;
            font-size: 0.72rem !important;
            gap: 8px !important;
          }
          .terms-check input { margin-top: 1px !important; }
          .auth-switch-tip { display: none !important; }
          .code-row {
            grid-template-columns: minmax(0, 1fr) 92px !important;
          }
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'rgba(71,85,105,0.82)', marginBottom: 8 }}>{label}</span>
      {children}
    </label>
  );
}

function PasswordSetupFields({
  password,
  confirm,
  onPasswordChange,
  onConfirmChange,
}: {
  password: string;
  confirm: string;
  onPasswordChange: (value: string) => void;
  onConfirmChange: (value: string) => void;
}) {
  return (
    <div className="password-grid" style={{ display: 'grid', gap: 'var(--lq-password-gap, 12px)' }}>
      <Field label="设置登录密码">
        <input type="password" value={password} onChange={e => onPasswordChange(e.target.value)} placeholder="至少6位" required style={inputStyle} />
      </Field>
      <Field label="再次输入密码">
        <input type="password" value={confirm} onChange={e => onConfirmChange(e.target.value)} placeholder="再次输入" required style={inputStyle} />
      </Field>
    </div>
  );
}
