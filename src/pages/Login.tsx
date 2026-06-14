import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
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

type LoginMode = 'sms' | 'email' | 'password';

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
  const [email, setEmail] = useState('');
  const [loginAccount, setLoginAccount] = useState('');
  const [password, setPassword] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerPasswordConfirm, setRegisterPasswordConfirm] = useState('');
  const [code, setCode] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [mode, setMode] = useState<LoginMode>('password');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [referralOwner, setReferralOwner] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const lastSentPhone = useRef('');
  const lastSentEmail = useRef('');

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

  const requestPhoneCode = useCallback(async (targetPhone: string) => {
    setSending(true);
    setError('');
    try {
      const r = await fetch(`${API}/lc/auth/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: targetPhone }),
      });
      const d = await r.json();
      if (d.success) {
        setSent(true);
        lastSentPhone.current = targetPhone;
        setError('验证码已发送，请查看短信');
      } else {
        setError(d.error || '验证码发送失败');
      }
    } catch {
      setError('网络错误');
    } finally {
      setSending(false);
    }
  }, []);

  const sendCode = async () => {
    if (!isValidPhone(phone)) {
      setError('请填写正确的手机号');
      return;
    }
    await requestPhoneCode(phoneDigits(phone));
  };

  const requestEmailCode = useCallback(async (targetEmail: string) => {
    setEmailSending(true);
    setError('');
    try {
      const r = await fetch(`${API}/lc/auth/email/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail }),
      });
      const d = await r.json();
      if (d.success) {
        setEmailSent(true);
        lastSentEmail.current = targetEmail;
        setError('邮箱验证码已发送，请查看收件箱或垃圾邮件');
      } else {
        setError(d.error || '邮箱验证码发送失败');
      }
    } catch {
      setError('网络错误');
    } finally {
      setEmailSending(false);
    }
  }, []);

  const sendEmailCode = async () => {
    if (!isValidEmail(email)) {
      setError('请填写正确的邮箱');
      return;
    }
    await requestEmailCode(email.trim().toLowerCase());
  };

  useEffect(() => {
    if (mode !== 'sms') return;
    const targetPhone = phoneDigits(phone);
    if (!/^1[3-9]\d{9}$/.test(targetPhone)) return;
    if (lastSentPhone.current === targetPhone || sending) return;
    const timer = window.setTimeout(() => { void requestPhoneCode(targetPhone); }, 700);
    return () => window.clearTimeout(timer);
  }, [mode, phone, requestPhoneCode, sending]);

  useEffect(() => {
    if (mode !== 'email') return;
    const targetEmail = email.trim().toLowerCase();
    if (!isValidEmail(targetEmail)) return;
    if (lastSentEmail.current === targetEmail || emailSending) return;
    const timer = window.setTimeout(() => { void requestEmailCode(targetEmail); }, 700);
    return () => window.clearTimeout(timer);
  }, [mode, email, emailSending, requestEmailCode]);

  const startWechatLogin = async () => {
    if (!acceptedTerms) {
      setError('请先阅读并同意用户协议和隐私政策');
      return;
    }
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
    if (mode === 'sms' && !isValidPhone(phone)) { setError('请填写正确的手机号'); return; }
    if (mode === 'sms' && !code.trim()) { setError('请填写验证码'); return; }
    if (mode === 'email' && !isValidEmail(email)) { setError('请填写正确的邮箱'); return; }
    if (mode === 'email' && !emailCode.trim()) { setError('请填写邮箱验证码'); return; }
    if ((mode === 'sms' || mode === 'email') && registerPassword.length < 6) { setError('密码至少6位'); return; }
    if ((mode === 'sms' || mode === 'email') && registerPassword !== registerPasswordConfirm) { setError('两次输入的密码不一致'); return; }
    if (mode === 'password' && !loginAccount.trim()) { setError('请填写手机号或邮箱'); return; }
    if (mode === 'password' && (!password.trim() || password.length < 4)) { setError('密码至少4位'); return; }
    if (!acceptedTerms) { setError('请先阅读并同意用户协议和隐私政策'); return; }
    setLoading(true);
    setError('');
    try {
      const endpoint = mode === 'sms' ? `${API}/lc/auth/phone` : mode === 'email' ? `${API}/lc/auth/email` : `${API}/lc/auth`;
      const body = mode === 'sms'
        ? { phone: phoneDigits(phone), code: code.trim(), password: registerPassword, passwordConfirm: registerPasswordConfirm, referralCode: referralCode || undefined }
        : mode === 'email'
          ? { email: email.trim().toLowerCase(), code: emailCode.trim(), password: registerPassword, passwordConfirm: registerPasswordConfirm, referralCode: referralCode || undefined }
          : { account: loginAccount.trim(), password: password.trim(), referralCode: referralCode || undefined };
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
        setError(d.error || '操作失败');
      }
    } catch {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page" style={{ minHeight: '100vh', display: 'flex', backgroundColor: C, color: INK }}>
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
            日常用密码登录<br />注册和敏感修改再验证<br />把每一次委托留在自己名下
          </p>
        </div>
      </div>

      <div className="login-main" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--lq-login-main-padding, 40px 20px)' }}>
        <div className="login-shell" style={{ width: '100%', maxWidth: 420 }}>
          <div className="login-logo" style={{ textAlign: 'center', marginBottom: 'var(--lq-logo-margin, 32px)' }}>
            <Link to="/" style={{ textDecoration: 'none', fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: '2rem', background: `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              灵契
            </Link>
          </div>

          <div className={`login-card ${mode !== 'password' ? 'register-card' : ''}`} style={{ backgroundColor: '#fffaf2', border: '1px solid rgba(201,146,46,0.2)', borderRadius: 'var(--lq-card-radius, 20px)', padding: 'var(--lq-card-padding, 36px 32px)', boxShadow: '0 18px 48px rgba(31,41,55,0.08)' }}>
            <div className="login-header" style={{ textAlign: 'center', marginBottom: 'var(--lq-header-margin, 24px)' }}>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: '1.5rem', marginBottom: 8, color: INK }}>
                {mode === 'sms' ? '手机注册' : mode === 'email' ? '邮箱注册' : '密码登录'}
              </h1>
              <p className="login-subtitle" style={{ fontSize: '0.85rem', color: MUTED }}>
                {mode === 'sms'
                  ? '输入手机号后会自动发送验证码，注册时设置密码'
                  : mode === 'email'
                    ? '输入邮箱后会自动发送验证码，注册时设置密码'
                    : '日常登录默认使用手机号或邮箱 + 密码'}
              </p>
            </div>

            <div className="login-tabs" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--lq-tab-gap, 8px)', marginBottom: 'var(--lq-tabs-margin, 18px)' }}>
              <button type="button" onClick={() => { setMode('password'); setError(''); }} style={{
                border: '1px solid rgba(201,146,46,0.24)', borderRadius: 'var(--lq-control-radius, 10px)', padding: 'var(--lq-tab-padding, 10px 12px)', fontSize: 'var(--lq-tab-font-size, 0.88rem)',
                background: mode === 'password' ? 'rgba(217,168,87,0.18)' : '#fff', color: mode === 'password' ? '#925f18' : MUTED, fontWeight: 800, cursor: 'pointer',
              }}>密码登录</button>
              <button type="button" onClick={() => { setMode('sms'); setError(''); }} style={{
                border: '1px solid rgba(201,146,46,0.24)', borderRadius: 'var(--lq-control-radius, 10px)', padding: 'var(--lq-tab-padding, 10px 12px)', fontSize: 'var(--lq-tab-font-size, 0.88rem)',
                background: mode === 'sms' ? 'rgba(217,168,87,0.18)' : '#fff', color: mode === 'sms' ? '#925f18' : MUTED, fontWeight: 800, cursor: 'pointer',
              }}>手机注册</button>
              <button type="button" onClick={() => { setMode('email'); setError(''); }} style={{
                border: '1px solid rgba(201,146,46,0.24)', borderRadius: 'var(--lq-control-radius, 10px)', padding: 'var(--lq-tab-padding, 10px 12px)', fontSize: 'var(--lq-tab-font-size, 0.88rem)',
                background: mode === 'email' ? 'rgba(217,168,87,0.18)' : '#fff', color: mode === 'email' ? '#925f18' : MUTED, fontWeight: 800, cursor: 'pointer',
              }}>邮箱注册</button>
            </div>

            {referralCode && (
              <div style={{ padding: '12px 14px', borderRadius: 12, marginBottom: 18, background: 'rgba(240,253,244,0.88)', border: '1px solid rgba(22,163,74,0.18)', color: '#166534', fontSize: '0.82rem', lineHeight: 1.65, fontWeight: 750 }}>
                {referralOwner ? `${referralOwner} 邀请你加入灵契` : '已识别邀请链接'}，注册后额外赠送 10 契约币。
              </div>
            )}

            <form className="login-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--lq-form-gap, 16px)' }}>
              {error && (
                <div className="login-message" style={{ padding: 'var(--lq-message-padding, 12px 16px)', backgroundColor: error.includes('已发送') ? 'rgba(240,253,244,0.92)' : 'rgba(254,242,242,0.92)', border: `1px solid ${error.includes('已发送') ? 'rgba(34,197,94,0.24)' : 'rgba(220,38,38,0.24)'}`, borderRadius: 'var(--lq-control-radius, 10px)', fontSize: '0.85rem', color: error.includes('已发送') ? '#15803d' : '#b91c1c' }}>
                  {error}
                </div>
              )}

              {mode === 'sms' ? (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'rgba(71,85,105,0.82)', marginBottom: 8 }}>手机号</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => {
                        const next = e.target.value;
                        setPhone(next);
                        if (phoneDigits(next) !== lastSentPhone.current) setSent(false);
                      }}
                      placeholder="输入手机号"
                      required
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'rgba(71,85,105,0.82)', marginBottom: 8 }}>验证码</label>
                    <input type="text" value={code} onChange={e => setCode(e.target.value)} placeholder="6位验证码" required style={inputStyle} />
                    <p style={{ margin: '8px 0 0', color: 'rgba(71,85,105,0.58)', fontSize: '0.76rem', lineHeight: 1.65 }}>
                      {sending ? '正在发送短信验证码...' : sent ? '验证码已发送。没有收到？' : '手机号填写完整后会自动发送验证码。'}
                      {isValidPhone(phone) && !sending && (
                        <button type="button" onClick={sendCode} style={{ marginLeft: 6, border: 'none', background: 'transparent', color: '#925f18', fontWeight: 850, cursor: 'pointer', padding: 0 }}>
                          {sent ? '重发' : '立即发送'}
                        </button>
                      )}
                    </p>
                  </div>
                  <PasswordSetupFields
                    password={registerPassword}
                    confirm={registerPasswordConfirm}
                    onPasswordChange={setRegisterPassword}
                    onConfirmChange={setRegisterPasswordConfirm}
                  />
                  <p className="register-footnote" style={{ margin: 0, color: 'rgba(71,85,105,0.64)', fontSize: '0.76rem', lineHeight: 1.65 }}>
                    昵称、头像、常用城市进站后再设置。昵称只是公开展示名，不是登录账号；登录账号是手机号或邮箱。
                  </p>
                </>
              ) : mode === 'email' ? (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'rgba(71,85,105,0.82)', marginBottom: 8 }}>邮箱</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => {
                        const next = e.target.value;
                        setEmail(next);
                        if (next.trim().toLowerCase() !== lastSentEmail.current) setEmailSent(false);
                      }}
                      placeholder="输入邮箱"
                      required
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'rgba(71,85,105,0.82)', marginBottom: 8 }}>邮箱验证码</label>
                    <input type="text" value={emailCode} onChange={e => setEmailCode(e.target.value)} placeholder="6位验证码" required style={inputStyle} />
                    <p style={{ margin: '8px 0 0', color: 'rgba(71,85,105,0.58)', fontSize: '0.76rem', lineHeight: 1.65 }}>
                      {emailSending ? '正在发送邮箱验证码...' : emailSent ? '验证码已发送。没有收到？' : '邮箱填写完整后会自动发送验证码。'}
                      {isValidEmail(email) && !emailSending && (
                        <button type="button" onClick={sendEmailCode} style={{ marginLeft: 6, border: 'none', background: 'transparent', color: '#925f18', fontWeight: 850, cursor: 'pointer', padding: 0 }}>
                          {emailSent ? '重发' : '立即发送'}
                        </button>
                      )}
                    </p>
                  </div>
                  <PasswordSetupFields
                    password={registerPassword}
                    confirm={registerPasswordConfirm}
                    onPasswordChange={setRegisterPassword}
                    onConfirmChange={setRegisterPasswordConfirm}
                  />
                  <p className="register-footnote" style={{ margin: 0, color: 'rgba(71,85,105,0.64)', fontSize: '0.76rem', lineHeight: 1.65 }}>
                    邮箱可先作为基础身份使用；昵称、头像、常用城市进站后再设置。昵称不是登录账号，登录账号是手机号或邮箱。
                  </p>
                </>
              ) : (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'rgba(71,85,105,0.82)', marginBottom: 8 }}>手机号或邮箱</label>
                    <input type="text" value={loginAccount} onChange={e => setLoginAccount(e.target.value)} placeholder="输入手机号或邮箱" required style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'rgba(71,85,105,0.82)', marginBottom: 8 }}>密码</label>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="输入密码" required style={inputStyle} />
                  </div>
                </>
              )}

              <label className="terms-check" style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: 'var(--lq-terms-padding, 12px 14px)',
                borderRadius: 'var(--lq-control-radius, 12px)',
                border: '1px solid rgba(201,146,46,0.2)',
                background: 'rgba(255,255,255,0.72)',
                color: MUTED,
                fontSize: '0.78rem',
                lineHeight: 1.75,
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

              <button type="submit" disabled={loading || !acceptedTerms}
                style={{
                  marginTop: 4, padding: 'var(--lq-primary-padding, 13px)', borderRadius: 'var(--lq-control-radius, 10px)', border: 'none', cursor: loading || !acceptedTerms ? 'not-allowed' : 'pointer',
                  background: loading || !acceptedTerms ? 'rgba(241,245,249,0.86)' : `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`,
                  color: loading || !acceptedTerms ? 'rgba(71,85,105,0.42)' : INK, fontWeight: 800, fontSize: '0.9rem',
                }}>
                {loading ? '处理中...' : mode === 'password' ? '登录' : '注册并进入灵契'}
              </button>

              {mode === 'password' && (
                <button type="button" onClick={startWechatLogin} disabled={loading || !acceptedTerms}
                  style={{ padding: '12px', borderRadius: 10, border: '1px solid rgba(34,197,94,0.26)', background: loading || !acceptedTerms ? 'rgba(241,245,249,0.86)' : '#f0fdf4', color: loading || !acceptedTerms ? 'rgba(71,85,105,0.42)' : '#166534', fontWeight: 850, cursor: loading || !acceptedTerms ? 'not-allowed' : 'pointer' }}>
                  微信扫码登录
                </button>
              )}

              {mode === 'password' && (
                <p style={{ fontSize: '0.82rem', color: MUTED, textAlign: 'center' }}>
                  新用户？选择邮箱注册或手机注册，设置密码后进入灵契。昵称和主页资料进站后再填。
                </p>
              )}

              <p className="auth-note" style={{ fontSize: '0.75rem', color: 'rgba(71,85,105,0.64)', textAlign: 'center', lineHeight: 1.7 }}>
                验证码只用于注册、绑定、找回或修改敏感账号信息；登录、发布、评论、举报等关键操作会依法留存必要日志。
              </p>
            </form>
          </div>

          <div className="login-back" style={{ textAlign: 'center', marginTop: 24 }}>
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
        @media (min-width: 1024px) and (max-height: 800px) {
          .login-page {
            --lq-login-main-padding: 24px 20px;
            --lq-logo-margin: 18px;
            --lq-card-padding: 26px 28px;
            --lq-header-margin: 18px;
            --lq-tabs-margin: 14px;
            --lq-form-gap: 12px;
            --lq-input-padding: 10px 13px;
            --lq-terms-padding: 10px 12px;
            --lq-primary-padding: 11px;
          }
          .login-logo { display: none !important; }
          .login-back { margin-top: 14px !important; }
        }
        @media (max-width: 640px) {
          .login-page {
            --lq-login-main-padding: 10px 12px;
            --lq-logo-margin: 8px;
            --lq-card-padding: 14px;
            --lq-card-radius: 14px;
            --lq-control-radius: 8px;
            --lq-input-padding: 9px 10px;
            --lq-input-font-size: 0.84rem;
            --lq-header-margin: 10px;
            --lq-tabs-margin: 10px;
            --lq-tab-gap: 6px;
            --lq-tab-padding: 8px 6px;
            --lq-tab-font-size: 0.78rem;
            --lq-form-gap: 9px;
            --lq-message-padding: 8px 10px;
            --lq-terms-padding: 8px 10px;
            --lq-primary-padding: 10px;
            --lq-password-gap: 8px;
          }
          .login-main { align-items: flex-start !important; }
          .login-logo a { font-size: 1.5rem !important; }
          .login-header h1 { font-size: 1.15rem !important; margin-bottom: 2px !important; }
          .register-card .login-subtitle,
          .register-card .register-footnote,
          .register-card .auth-note,
          .terms-extra,
          .login-back {
            display: none !important;
          }
          .login-form label:not(.terms-check) {
            margin-bottom: 4px !important;
            font-size: 0.72rem !important;
          }
          .login-form p {
            margin-top: 4px !important;
            line-height: 1.35 !important;
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
        }
      `}</style>
    </div>
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
      <div>
        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'rgba(71,85,105,0.82)', marginBottom: 8 }}>设置登录密码</label>
        <input type="password" value={password} onChange={e => onPasswordChange(e.target.value)} placeholder="至少6位" required style={inputStyle} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'rgba(71,85,105,0.82)', marginBottom: 8 }}>再次输入密码</label>
        <input type="password" value={confirm} onChange={e => onConfirmChange(e.target.value)} placeholder="再次输入" required style={inputStyle} />
      </div>
    </div>
  );
}
