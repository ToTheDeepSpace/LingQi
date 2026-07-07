import { useEffect, useState } from 'react';
import type { CSSProperties, FormEvent, ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  type AuthAccountKind,
  type AuthConfig,
  type AuthStep,
  getAuthAccountKind,
  getNextAuthStep,
  normalizeAuthAccount,
  shouldShowWechatLogin,
} from '../lib/authFlow';
import { readStoredCreatorAuth } from '../lib/authSession';
import { getPostLoginRedirect, ONBOARDING_DISMISSED_KEY, ONBOARDING_PENDING_KEY } from '../lib/postLoginFlow';

const API = '/api';
const C = '#fffdf8';
const C2 = '#eef6ff';
const GOLD = '#d9a857';
const INK = '#1f2937';
const MUTED = 'rgba(71,85,105,0.76)';

const inputStyle: CSSProperties = {
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

type SentCodeTarget = {
  kind: AuthAccountKind;
  value: string;
  step: Extract<AuthStep, 'register' | 'reset'>;
};

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
  const [step, setStep] = useState<AuthStep>('account');
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupPasswordConfirm, setSetupPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [message, setMessage] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [referralOwner, setReferralOwner] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [sentCodeTarget, setSentCodeTarget] = useState<SentCodeTarget | null>(null);
  const [authConfig, setAuthConfig] = useState<AuthConfig | null>(null);

  const accountKind = getAuthAccountKind(account);
  const accountTarget = accountKind ? normalizeAuthAccount(account, accountKind) : '';
  const codeStep = step === 'reset' ? 'reset' : 'register';
  const sentToCurrentAccount = Boolean(
    accountKind &&
    sentCodeTarget?.kind === accountKind &&
    sentCodeTarget.value === accountTarget &&
    sentCodeTarget.step === codeStep,
  );
  const isPositiveMessage = /已发送|请查看|已经注册|还没有注册|设置密码|创建账号/.test(message);
  const showWechatLogin = shouldShowWechatLogin(authConfig);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('wechat_login') || params.get('auth_error')) return;
    const current = readStoredCreatorAuth();
    if (!current) return;
    navigate(getPostLoginRedirect(params.get('redirect')), { replace: true });
  }, [location.search, navigate]);

  useEffect(() => {
    let alive = true;
    fetch(`${API}/lc/auth/config`)
      .then(r => r.json())
      .then(d => {
        if (alive && d.success) setAuthConfig(d.data || null);
      })
      .catch(() => {
        if (alive) setAuthConfig(null);
      });
    return () => { alive = false; };
  }, []);

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
      navigate(getPostLoginRedirect(params.get('redirect')), { replace: true });
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

  const clearSecrets = () => {
    setPassword('');
    setCode('');
    setSetupPassword('');
    setSetupPasswordConfirm('');
    setSentCodeTarget(null);
  };

  const handleAccountChange = (value: string) => {
    setAccount(value);
    setStep('account');
    setMessage('');
    clearSecrets();
  };

  const goBackToAccount = () => {
    setStep('account');
    setMessage('');
    clearSecrets();
  };

  const ensureAccount = () => {
    if (!account.trim()) {
      setMessage('请先填写手机号或邮箱');
      return null;
    }
    if (!accountKind) {
      setMessage('请填写正确的手机号或邮箱');
      return null;
    }
    return { kind: accountKind, value: accountTarget };
  };

  const identifyAccount = async () => {
    const normalized = ensureAccount();
    if (!normalized) return null;
    setLoading(true);
    setMessage('');
    try {
      const r = await fetch(`${API}/lc/auth/identify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account: normalized.value }),
      });
      const d = await r.json();
      if (!d.success) {
        setMessage(d.error || '账号识别失败');
        return null;
      }
      const next = getNextAuthStep({
        exists: Boolean(d.data?.exists),
        hasPassword: Boolean(d.data?.has_password),
      });
      setStep(next.step);
      setMessage(next.message);
      clearSecrets();
      return { ...d.data, step: next.step as AuthStep };
    } catch {
      setMessage('网络错误');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const sendCode = async () => {
    const normalized = ensureAccount();
    if (!normalized) return;
    if (step !== 'register' && step !== 'reset') {
      setMessage('请先确认账号状态');
      return;
    }

    setSendingCode(true);
    setMessage('');
    try {
      const identifyResp = await fetch(`${API}/lc/auth/identify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account: normalized.value }),
      });
      const identifyData = await identifyResp.json();
      if (!identifyData.success) {
        setMessage(identifyData.error || '账号识别失败');
        return;
      }
      const exists = Boolean(identifyData.data?.exists);
      const hasPassword = Boolean(identifyData.data?.has_password);
      if (step === 'register' && exists) {
        const next = getNextAuthStep({ exists, hasPassword });
        setStep(next.step);
        setMessage(next.message);
        clearSecrets();
        return;
      }
      if (step === 'reset' && !exists) {
        const next = getNextAuthStep({ exists, hasPassword });
        setStep(next.step);
        setMessage(next.message);
        clearSecrets();
        return;
      }

      const endpoint = normalized.kind === 'phone' ? `${API}/lc/auth/send-code` : `${API}/lc/auth/email/send-code`;
      const body = normalized.kind === 'phone' ? { phone: normalized.value } : { email: normalized.value };
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (d.success) {
        setSentCodeTarget({ kind: normalized.kind, value: normalized.value, step: codeStep });
        setMessage(normalized.kind === 'phone' ? '验证码已发送，请查看短信' : '验证码已发送，请查看邮箱或垃圾邮件');
      } else {
        setMessage(d.error || '验证码发送失败');
      }
    } catch {
      setMessage('网络错误');
    } finally {
      setSendingCode(false);
    }
  };

  const startReset = () => {
    const normalized = ensureAccount();
    if (!normalized) return;
    setStep('reset');
    setMessage('验证账号后设置新密码。');
    setPassword('');
    setCode('');
    setSetupPassword('');
    setSetupPasswordConfirm('');
    setSentCodeTarget(null);
  };

  const startWechatLogin = async () => {
    if (!showWechatLogin) return;
    if (!acceptedTerms) {
      setMessage('请先阅读并同意用户协议和隐私政策');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const currentParams = new URLSearchParams(location.search);
      const params = new URLSearchParams({ redirect: getPostLoginRedirect(currentParams.get('redirect')) });
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (step === 'account') {
      await identifyAccount();
      return;
    }
    if (!acceptedTerms) { setMessage('请先阅读并同意用户协议和隐私政策'); return; }
    const normalized = ensureAccount();
    if (!normalized) return;

    if (step === 'password') {
      if (!password.trim() || password.length < 4) { setMessage('密码至少4位'); return; }
    } else {
      if (!sentToCurrentAccount) { setMessage('请先为当前账号发送验证码'); return; }
      if (!code.trim()) { setMessage('请填写验证码'); return; }
      if (setupPassword.length < 6) { setMessage('密码至少6位'); return; }
      if (setupPassword !== setupPasswordConfirm) { setMessage('两次输入的密码不一致'); return; }
    }

    setLoading(true);
    setMessage('');
    try {
      const endpoint = step === 'password'
        ? `${API}/lc/auth`
        : step === 'reset'
          ? `${API}/lc/auth/reset-password`
          : normalized.kind === 'phone'
            ? `${API}/lc/auth/phone`
            : `${API}/lc/auth/email`;
      const body = step === 'password'
        ? {
          account: normalized.value,
          password: password.trim(),
          referralCode: referralCode || undefined,
        }
        : step === 'reset'
          ? {
            account: normalized.value,
            code: code.trim(),
            password: setupPassword,
            passwordConfirm: setupPasswordConfirm,
          }
          : normalized.kind === 'phone'
            ? {
              phone: normalized.value,
              code: code.trim(),
              password: setupPassword,
              passwordConfirm: setupPasswordConfirm,
              referralCode: referralCode || undefined,
            }
            : {
              email: normalized.value,
              code: code.trim(),
              password: setupPassword,
              passwordConfirm: setupPasswordConfirm,
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
        if (d.data?.new_user) {
          localStorage.setItem(ONBOARDING_PENDING_KEY, '1');
          localStorage.removeItem(ONBOARDING_DISMISSED_KEY);
        }
        localStorage.removeItem(REFERRAL_STORAGE_KEY);
        const params = new URLSearchParams(location.search);
        navigate(getPostLoginRedirect(params.get('redirect')));
      } else {
        setMessage(d.error || '操作失败');
        if (r.status === 409 && /已经注册|已注册/.test(String(d.error || ''))) {
          const next = getNextAuthStep({ exists: true, hasPassword: !/没有设置/.test(String(d.error || '')) });
          setStep(next.step);
        }
      }
    } catch {
      setMessage('网络错误');
    } finally {
      setLoading(false);
    }
  };

  const title = step === 'account'
    ? '进入灵契'
    : step === 'password'
      ? '输入密码'
      : step === 'reset'
        ? '重设登录密码'
        : '创建灵契账号';
  const subtitle = step === 'account'
    ? '用手机号或邮箱继续。老用户直接登录，新用户按提示注册。'
    : step === 'password'
      ? '这个账号已经注册，直接用密码登录。'
      : step === 'reset'
        ? '验证手机号或邮箱后设置新密码。'
        : '新账号需要验证码，并在注册时设置登录密码。';
  const submitText = loading
    ? '处理中...'
    : step === 'account'
      ? '继续'
      : step === 'password'
        ? '登录'
        : step === 'reset'
          ? '重设密码并进入灵契'
          : '注册并进入灵契';
  const submitDisabled = loading || (step !== 'account' && !acceptedTerms);

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
            手机号或邮箱继续<br />老用户直接登录<br />新用户按提示注册
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

          <div className="login-card" style={{ backgroundColor: '#fffaf2', border: '1px solid rgba(201,146,46,0.2)', borderRadius: 'var(--lq-card-radius, 20px)', padding: 'var(--lq-card-padding, 32px)', boxShadow: '0 18px 48px rgba(31,41,55,0.08)' }}>
            <div className="login-header" style={{ textAlign: 'center', marginBottom: 'var(--lq-header-margin, 20px)' }}>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: '1.45rem', marginBottom: 8, color: INK }}>
                {title}
              </h1>
              <p className="login-subtitle" style={{ fontSize: '0.84rem', color: MUTED, margin: 0, lineHeight: 1.7 }}>
                {subtitle}
              </p>
            </div>

            {referralCode && (
              <div className="referral-banner" style={{ padding: '10px 12px', borderRadius: 12, marginBottom: 14, background: 'rgba(240,253,244,0.88)', border: '1px solid rgba(22,163,74,0.18)', color: '#166534', fontSize: '0.8rem', lineHeight: 1.55, fontWeight: 750 }}>
                {referralOwner ? `${referralOwner} 邀请你加入灵契` : '已识别邀请链接'}，注册后额外赠送 10 契约币。
              </div>
            )}

            <form className="login-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--lq-form-gap, 14px)' }}>
              {step === 'account' ? (
                <Field label="手机号或邮箱">
                  <input
                    type="text"
                    value={account}
                    onChange={e => handleAccountChange(e.target.value)}
                    placeholder="手机号 / 邮箱"
                    required
                    style={inputStyle}
                  />
                </Field>
              ) : (
                <div className="account-summary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 10px', borderRadius: 'var(--lq-control-radius, 10px)', border: '1px solid rgba(201,146,46,0.2)', background: 'rgba(255,255,255,0.68)', color: MUTED, fontSize: '0.8rem' }}>
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 800, color: INK }}>{accountTarget || account}</span>
                  <button type="button" onClick={goBackToAccount} style={{ border: 'none', background: 'transparent', color: '#925f18', fontWeight: 850, cursor: 'pointer', flexShrink: 0, padding: 0 }}>换账号</button>
                </div>
              )}

              {step === 'password' && (
                <Field label={(
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <span>密码</span>
                    <button type="button" onClick={startReset} className="text-action" style={{ border: 'none', background: 'transparent', color: '#925f18', fontWeight: 850, fontSize: '0.76rem', cursor: 'pointer', padding: 0 }}>忘记密码？</button>
                  </span>
                )}>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="输入密码"
                    required
                    style={inputStyle}
                  />
                </Field>
              )}

              {(step === 'register' || step === 'reset') && (
                <>
                  <Field label="验证码">
                    <div className="code-row" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8 }}>
                      <input
                        type="text"
                        value={code}
                        onChange={e => setCode(e.target.value)}
                        placeholder="6位验证码"
                        required
                        inputMode="numeric"
                        style={inputStyle}
                      />
                      <button
                        type="button"
                        onClick={sendCode}
                        disabled={sendingCode || loading || !accountTarget}
                        style={{
                          border: 'none',
                          borderRadius: 'var(--lq-control-radius, 10px)',
                          padding: '0 12px',
                          background: sendingCode || loading || !accountTarget ? 'rgba(241,245,249,0.9)' : '#1f2937',
                          color: sendingCode || loading || !accountTarget ? 'rgba(71,85,105,0.42)' : '#fff',
                          fontWeight: 850,
                          fontSize: '0.82rem',
                          cursor: sendingCode || loading || !accountTarget ? 'not-allowed' : 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {sendingCode ? '发送中' : sentToCurrentAccount ? '重发验证码' : '发送验证码'}
                      </button>
                    </div>
                    <p className="register-code-tip" style={{ margin: '6px 0 0', color: 'rgba(71,85,105,0.58)', fontSize: '0.74rem', lineHeight: 1.5 }}>
                      {accountKind === 'phone' ? '将发送短信验证码。' : '将发送邮箱验证码；不会自动发送。'}
                    </p>
                  </Field>

                  <PasswordSetupFields
                    password={setupPassword}
                    confirm={setupPasswordConfirm}
                    onPasswordChange={setSetupPassword}
                    onConfirmChange={setSetupPasswordConfirm}
                    firstLabel={step === 'reset' ? '新登录密码' : '设置登录密码'}
                  />

                  {step === 'register' && (
                    <p className="register-footnote" style={{ margin: 0, color: 'rgba(71,85,105,0.64)', fontSize: '0.76rem', lineHeight: 1.6 }}>
                      昵称、头像、常用城市进站后再设置。昵称只是公开展示名，不是登录账号；登录账号是手机号或邮箱。
                    </p>
                  )}
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

              <button type="submit" disabled={submitDisabled}
                style={{
                  marginTop: 2, padding: 'var(--lq-primary-padding, 12px)', borderRadius: 'var(--lq-control-radius, 10px)', border: 'none', cursor: submitDisabled ? 'not-allowed' : 'pointer',
                  background: submitDisabled ? 'rgba(241,245,249,0.86)' : `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`,
                  color: submitDisabled ? 'rgba(71,85,105,0.42)' : INK, fontWeight: 850, fontSize: '0.9rem',
                }}>
                {submitText}
              </button>

              {step === 'account' && showWechatLogin && (
                <button type="button" onClick={startWechatLogin} disabled={loading || !acceptedTerms}
                  style={{ padding: '11px', borderRadius: 10, border: '1px solid rgba(34,197,94,0.26)', background: loading || !acceptedTerms ? 'rgba(241,245,249,0.86)' : '#f0fdf4', color: loading || !acceptedTerms ? 'rgba(71,85,105,0.42)' : '#166534', fontWeight: 850, cursor: loading || !acceptedTerms ? 'not-allowed' : 'pointer' }}>
                  微信扫码登录
                </button>
              )}

              {step !== 'account' && step !== 'password' && (
                <button type="button" onClick={goBackToAccount} className="auth-hint text-action" style={{ border: 'none', background: 'transparent', color: '#925f18', fontWeight: 850, cursor: 'pointer', padding: 0, fontSize: '0.78rem' }}>
                  我有其他账号，返回重新输入
                </button>
              )}

              <p className="auth-note" style={{ fontSize: '0.74rem', color: 'rgba(71,85,105,0.64)', textAlign: 'center', lineHeight: 1.65, margin: 0 }}>
                验证码只用于注册、找回、绑定或修改敏感账号信息；日常登录默认用账号和密码。
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
            --lq-form-gap: 8px;
            --lq-input-padding: 9px 11px;
            --lq-primary-padding: 9px;
          }
          .login-header h1 { font-size: 1.22rem !important; margin-bottom: 3px !important; }
          .login-subtitle,
          .register-footnote,
          .auth-note,
          .auth-hint {
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
          .auth-hint { display: none !important; }
          .code-row {
            grid-template-columns: minmax(0, 1fr) 92px !important;
          }
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
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
  firstLabel = '设置登录密码',
}: {
  password: string;
  confirm: string;
  onPasswordChange: (value: string) => void;
  onConfirmChange: (value: string) => void;
  firstLabel?: string;
}) {
  return (
    <div className="password-grid" style={{ display: 'grid', gap: 'var(--lq-password-gap, 12px)' }}>
      <Field label={firstLabel}>
        <input type="password" value={password} onChange={e => onPasswordChange(e.target.value)} placeholder="至少6位" required style={inputStyle} />
      </Field>
      <Field label="再次输入密码">
        <input type="password" value={confirm} onChange={e => onConfirmChange(e.target.value)} placeholder="再次输入" required style={inputStyle} />
      </Field>
    </div>
  );
}
