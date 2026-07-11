import { useEffect, useMemo, useState } from 'react';
import type React from 'react';
import { Link } from 'react-router-dom';
import { calculateChantoSplit, CHANTO_DAILY_LIMIT, CHANTO_FREEZE_DAYS, CHANTO_MAX_AMOUNT, CHANTO_MIN_AMOUNT, isValidChantoAmount } from '../lib/chanto';

const API = '/api';
const INK = '#1f2937';
const MUTED = 'rgba(71,85,105,0.72)';
const GOLD = '#a66a1f';
const PRESETS = [10, 30, 50, 100];

type Props = {
  open: boolean;
  token: string;
  dossierId: string;
  dmName: string;
  ratingId?: string | null;
  onClose: () => void;
  onSuccess?: (result: { amount: number; receiverAmount: number; availableAt?: string }) => void;
};

function errorText(value: unknown, fallback: string) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'message' in value) return String((value as { message?: unknown }).message || fallback);
  return fallback;
}

function makeRequestKey() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `dm-gift-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function DmGiftModal({ open, token, dossierId, dmName, ratingId, onClose, onSuccess }: Props) {
  const [amount, setAmount] = useState('30');
  const [paidBalance, setPaidBalance] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [requestKey, setRequestKey] = useState(makeRequestKey);
  const numericAmount = Number(amount);
  const amountValid = isValidChantoAmount(numericAmount);
  const enough = paidBalance === null || paidBalance >= numericAmount;
  const receiverAmount = useMemo(() => amountValid ? calculateChantoSplit(numericAmount).receiverAmount : 0, [amountValid, numericAmount]);

  useEffect(() => {
    if (!open || !token) return;
    fetch(`${API}/lc/wallet`, { headers: { Authorization: `Bearer ${token}` } })
      .then(response => response.json())
      .then(body => {
        if (body.success) setPaidBalance(Number(body.data?.paid_balance || 0));
      })
      .catch(() => setPaidBalance(null));
  }, [open, token]);

  if (!open) return null;

  const closeModal = () => {
    setError('');
    onClose();
  };

  const submit = async () => {
    if (!amountValid) return setError(`请输入 ${CHANTO_MIN_AMOUNT}-${CHANTO_MAX_AMOUNT} 的整数榜金`);
    if (!enough) return setError('充值榜金不足；赠送榜金不能转换成可提现缠头');
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch(`${API}/lc/dm-dossiers/${encodeURIComponent(dossierId)}/gifts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          amount: numericAmount,
          message: message.trim() || null,
          isAnonymous: anonymous,
          ratingId: ratingId || null,
          requestKey,
        }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(errorText(body.error, '缠头发送失败'));
      setPaidBalance(Number(body.data?.paid_balance || 0));
      onSuccess?.({ amount: numericAmount, receiverAmount: Number(body.data?.receiver_amount || receiverAmount), availableAt: body.data?.available_at });
      setMessage('');
      setRequestKey(makeRequestKey());
      closeModal();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '缠头发送失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div role="presentation" onMouseDown={event => event.target === event.currentTarget && closeModal()} style={overlayStyle}>
      <section role="dialog" aria-modal="true" aria-labelledby="dm-gift-title" style={dialogStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'start' }}>
          <div>
            <p style={{ margin: '0 0 5px', color: GOLD, fontSize: 12, fontWeight: 900 }}>缠头</p>
            <h2 id="dm-gift-title" style={{ margin: 0, fontSize: 21 }}>支持 {dmName}</h2>
          </div>
          <button type="button" onClick={closeModal} aria-label="关闭" style={closeButton}>×</button>
        </div>

        <p style={{ margin: '12px 0 14px', color: MUTED, fontSize: 13, lineHeight: 1.65 }}>
          缠头是给已认证 DM 的自愿支持。平台收取 20% 服务费，剩余 {receiverAmount || '--'} 将进入对方收入并在 {CHANTO_FREEZE_DAYS} 天后可提现。
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 7 }}>
          {PRESETS.map(value => <button key={value} type="button" onClick={() => setAmount(String(value))} style={presetButton(numericAmount === value)}>{value}</button>)}
        </div>
        <label style={fieldStyle}>
          <span style={labelStyle}>缠头榜金</span>
          <input inputMode="numeric" value={amount} onChange={event => setAmount(event.target.value.replace(/\D/g, '').slice(0, 4))} style={inputStyle} />
        </label>
        <label style={fieldStyle}>
          <span style={labelStyle}>附言（选填，仅收款方可见）</span>
          <input value={message} maxLength={200} onChange={event => setMessage(event.target.value)} placeholder="写一句支持的话" style={inputStyle} />
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', color: MUTED, fontSize: 13 }}>
          <input type="checkbox" checked={anonymous} onChange={event => setAnonymous(event.target.checked)} />
          榜单与公开支持记录中匿名
        </label>

        <div style={{ marginTop: 13, padding: '9px 11px', borderRadius: 7, background: '#fff8e8', color: '#8a5a19', fontSize: 12, lineHeight: 1.6 }}>
          可用充值榜金：{paidBalance === null ? '查询中' : paidBalance}。赠送榜金不能用于缠头，单次上限 {CHANTO_MAX_AMOUNT}、每日上限 {CHANTO_DAILY_LIMIT}。请按实际意愿理性支持。
        </div>
        {error && <p style={{ margin: '10px 0 0', color: '#b91c1c', fontSize: 13, fontWeight: 800 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button type="button" onClick={closeModal} style={secondaryButton}>取消</button>
          {!enough ? <Link to="/wallet" style={{ ...primaryButton, textAlign: 'center', textDecoration: 'none' }}>充值榜金</Link> : <button type="button" disabled={submitting || !amountValid} onClick={() => void submit()} style={{ ...primaryButton, opacity: submitting || !amountValid ? 0.55 : 1 }}>{submitting ? '发送中...' : `送出 ${amountValid ? numericAmount : '--'} 缠头`}</button>}
        </div>
      </section>
    </div>
  );
}

const overlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 1000, display: 'grid', placeItems: 'center', padding: 14, background: 'rgba(15,23,42,0.48)' };
const dialogStyle: React.CSSProperties = { width: 'min(100%, 440px)', maxHeight: 'calc(100vh - 28px)', overflowY: 'auto', boxSizing: 'border-box', padding: 18, borderRadius: 8, border: '1px solid rgba(166,106,31,0.18)', background: '#fffdf8', color: INK, boxShadow: '0 24px 70px rgba(15,23,42,0.24)' };
const closeButton: React.CSSProperties = { width: 30, height: 30, border: '1px solid rgba(31,41,55,0.12)', borderRadius: 6, background: '#fff', color: MUTED, fontSize: 20, cursor: 'pointer' };
const fieldStyle: React.CSSProperties = { display: 'grid', gap: 6, marginTop: 12 };
const labelStyle: React.CSSProperties = { color: MUTED, fontSize: 12, fontWeight: 850 };
const inputStyle: React.CSSProperties = { width: '100%', minHeight: 42, boxSizing: 'border-box', border: '1px solid rgba(31,41,55,0.14)', borderRadius: 7, background: '#fff', color: INK, padding: '9px 11px', fontSize: 14 };
const presetButton = (active: boolean): React.CSSProperties => ({ minHeight: 39, borderRadius: 7, border: active ? '1px solid #a66a1f' : '1px solid rgba(31,41,55,0.12)', background: active ? '#fff4d6' : '#fff', color: active ? '#8a5a19' : INK, fontWeight: 900, cursor: 'pointer' });
const secondaryButton: React.CSSProperties = { flex: 1, minHeight: 42, border: '1px solid rgba(31,41,55,0.14)', borderRadius: 7, background: '#fff', color: INK, fontWeight: 850, cursor: 'pointer' };
const primaryButton: React.CSSProperties = { flex: 1.5, minHeight: 42, border: 0, borderRadius: 7, background: INK, color: '#fff', fontWeight: 900, cursor: 'pointer', padding: '11px 13px' };
