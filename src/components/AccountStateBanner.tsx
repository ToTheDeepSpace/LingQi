import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { readStoredCreatorAuth } from '../lib/authSession';

type AccountStatus = {
  state: 'active' | 'restricted' | 'merged';
  message?: string;
  unread_count?: number;
  restriction?: { scope?: 'publish' | 'account'; reason?: string } | null;
};

export default function AccountStateBanner() {
  const [status, setStatus] = useState<AccountStatus | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const auth = readStoredCreatorAuth();
      if (!auth?.token) {
        if (alive) setStatus(null);
        return;
      }
      try {
        const response = await fetch('/api/lc/account/status', {
          headers: { Authorization: `Bearer ${auth.token}` },
        });
        const payload = await response.json();
        if (!alive || !payload.success) return;
        const next = payload.data as AccountStatus;
        setStatus(next);
        if (next.state === 'merged') {
          localStorage.removeItem('lc_creator');
          localStorage.removeItem('lc_admin_token');
          window.dispatchEvent(new Event('lc-auth-changed'));
        }
      } catch {
        if (alive) setStatus(null);
      }
    };
    void load();
    window.addEventListener('lc-auth-changed', load);
    window.addEventListener('focus', load);
    return () => {
      alive = false;
      window.removeEventListener('lc-auth-changed', load);
      window.removeEventListener('focus', load);
    };
  }, []);

  if (!status || (status.state === 'active' && !status.unread_count)) return null;
  const merged = status.state === 'merged';
  const restricted = status.state === 'restricted';
  const background = restricted ? '#fff4e6' : '#eff6ff';
  const border = restricted ? 'rgba(180,83,9,0.24)' : 'rgba(39,83,137,0.20)';
  const color = restricted ? '#7c3f0c' : '#275389';
  const label = merged
    ? '微信临时账号已合并，请重新登录原网站账号。'
    : restricted
      ? `${status.restriction?.scope === 'account' ? '账号功能受限' : '当前限制发布'}：${status.restriction?.reason || status.message || '请查看详情'}`
      : `你有 ${status.unread_count || 0} 条新的账号通知`;

  return (
    <div role="status" style={{ borderBottom: `1px solid ${border}`, background, color }}>
      <div style={{ maxWidth: 1440, minHeight: 38, margin: '0 auto', padding: '7px clamp(12px, 2vw, 20px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ minWidth: 0, fontSize: 13, lineHeight: 1.55, fontWeight: 750 }}>{label}</span>
        <Link to={merged ? '/login' : '/account-status'} style={{ flexShrink: 0, color, fontSize: 12, fontWeight: 900, textDecoration: 'underline', textUnderlineOffset: 3 }}>
          {merged ? '重新登录' : '查看与申诉'}
        </Link>
      </div>
    </div>
  );
}
