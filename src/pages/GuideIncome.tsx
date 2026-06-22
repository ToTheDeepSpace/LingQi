import { useCallback, useEffect, useMemo, useState } from 'react';
import type React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { readStoredCreatorAuth } from '../lib/authSession';

const API = '/api';
const BG = '#fffdf8';
const INK = '#1f2937';
const GOLD = '#d9a857';
const MUTED = 'rgba(71,85,105,0.76)';

type IncomeEntry = {
  id: string;
  guide_id?: string | null;
  source_type: string;
  gross_amount: number;
  platform_fee: number;
  creator_amount: number;
  status: string;
  available_at: string;
  created_at: string;
};

type Withdrawal = {
  id: string;
  amount: number;
  account_type: string;
  account_name: string;
  account_identifier: string;
  status: string;
  admin_note?: string | null;
  created_at: string;
};

export default function GuideIncome() {
  const navigate = useNavigate();
  const auth = useMemo(() => readStoredCreatorAuth(), []);
  const [entries, setEntries] = useState<IncomeEntry[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ accountType: 'alipay', accountName: '', accountIdentifier: '' });

  const loadData = useCallback(async () => {
    if (!auth) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/lc/guides/income/me`, { headers: { Authorization: `Bearer ${auth.token}` } });
      const d = await r.json();
      if (d.success) {
        setEntries(d.data?.entries || []);
        setWithdrawals(d.data?.withdrawals || []);
        setTotals(d.data?.totals || {});
      } else {
        setMessage(d.error || '加载失败');
      }
    } catch {
      setMessage('网络错误');
    } finally {
      setLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    if (!auth) { navigate('/login?redirect=/guides/income'); return; }
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [auth, navigate, loadData]);

  const requestWithdrawal = async () => {
    if (!auth) return;
    setMessage('');
    const amount = totals.withdrawable || 0;
    if (amount < 30) {
      setMessage('可提现收入不足 30');
      return;
    }
    const r = await fetch(`${API}/lc/guides/withdrawals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify({ ...form, amount }),
    });
    const d = await r.json();
    if (!r.ok || !d.success) {
      setMessage(d.error || '提交失败');
      return;
    }
    setMessage('提现申请已提交，管理员打款后会更新状态');
    await loadData();
  };

  if (!auth) return null;

  return (
    <main style={{ minHeight: '100vh', background: BG, color: INK }}>
      <section style={{ maxWidth: 980, margin: '0 auto', padding: '24px 18px 70px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18 }}>
          <div>
            <Link to="/guides" style={{ color: '#275389', textDecoration: 'none', fontWeight: 850 }}>‹ 返回攻略交易</Link>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.7rem', marginTop: 10 }}>创作者收入</h1>
            <p style={{ color: MUTED }}>这里是攻略和礼物产生的创作者收入，不是你的契约币钱包。</p>
          </div>
          <Link to="/guides/new" style={goldButton}>发布攻略</Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
          {[
            ['冻结中', totals.frozen || 0],
            ['可提现', totals.withdrawable || 0],
            ['提现中', totals.withdraw_requested || 0],
            ['已打款', totals.withdraw_paid || 0],
          ].map(([label, value]) => (
            <div key={label} style={cardStyle}>
              <div style={{ color: '#925f18', fontWeight: 900, fontSize: '1.5rem' }}>{value as number}</div>
              <div style={{ color: MUTED, fontSize: '0.82rem' }}>{label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(260px, 340px)', gap: 14 }}>
          <section style={cardStyle}>
            <h2 style={{ marginBottom: 10 }}>收入流水</h2>
            {loading ? <p style={{ color: MUTED }}>加载中...</p> : entries.length === 0 ? <p style={{ color: MUTED }}>暂无收入</p> : (
              <div style={{ display: 'grid', gap: 8 }}>
                {entries.map(entry => (
                  <div key={entry.id} style={{ borderBottom: '1px solid rgba(201,146,46,0.12)', paddingBottom: 8 }}>
                    <strong>{entry.creator_amount} 创作者收入</strong>
                    <div style={{ color: MUTED, fontSize: '0.8rem', lineHeight: 1.7 }}>
                      毛额 {entry.gross_amount} · 平台服务费 {entry.platform_fee} · 状态 {statusLabel(entry.status)} · 可用时间 {entry.available_at?.slice(0, 10)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <aside style={cardStyle}>
            <h2 style={{ marginBottom: 8 }}>申请提现</h2>
            <p style={{ color: MUTED, fontSize: '0.82rem', lineHeight: 1.7 }}>第一版只支持一次性申请全部可提现收入，管理员审核后手工或半自动打款。</p>
            <select value={form.accountType} onChange={e => setForm({ ...form, accountType: e.target.value })} style={inputStyle}>
              <option value="alipay">支付宝</option>
              <option value="wechat">微信</option>
              <option value="bank">银行卡</option>
              <option value="other">其他</option>
            </select>
            <input value={form.accountName} onChange={e => setForm({ ...form, accountName: e.target.value })} placeholder="收款人姓名" style={inputStyle} />
            <input value={form.accountIdentifier} onChange={e => setForm({ ...form, accountIdentifier: e.target.value })} placeholder="账号 / 卡号 / 备注" style={inputStyle} />
            {message && <p style={{ color: message.includes('失败') || message.includes('不足') || message.includes('错误') ? '#b91c1c' : '#166534' }}>{message}</p>}
            <button type="button" onClick={() => void requestWithdrawal()} style={goldButton}>申请提现 {totals.withdrawable || 0}</button>
            <h3 style={{ margin: '18px 0 8px' }}>提现记录</h3>
            {withdrawals.length === 0 ? <p style={{ color: MUTED }}>暂无提现申请</p> : withdrawals.map(item => (
              <div key={item.id} style={{ fontSize: '0.82rem', color: MUTED, borderTop: '1px solid rgba(201,146,46,0.12)', padding: '8px 0' }}>
                {item.amount} · {statusLabel(item.status)} · {item.created_at?.slice(0, 10)}
                {item.admin_note ? <div>备注：{item.admin_note}</div> : null}
              </div>
            ))}
          </aside>
        </div>
      </section>
    </main>
  );
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    frozen: '冻结中',
    withdrawable: '可提现',
    withdraw_requested: '提现中',
    withdraw_paid: '已打款',
    forfeited: '已扣回',
    pending: '待处理',
    paid: '已打款',
    rejected: '已拒绝',
  };
  return labels[status] || status;
}

const cardStyle: React.CSSProperties = {
  border: '1px solid rgba(201,146,46,0.16)',
  borderRadius: 14,
  padding: 16,
  background: 'rgba(255,255,255,0.82)',
  boxShadow: '0 14px 32px rgba(31,41,55,0.05)',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  marginTop: 8,
  border: '1px solid rgba(201,146,46,0.22)',
  borderRadius: 12,
  padding: '10px 12px',
  background: 'rgba(255,250,242,0.72)',
  color: INK,
};

const goldButton: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginTop: 10,
  padding: '10px 14px',
  borderRadius: 12,
  border: 'none',
  background: `linear-gradient(135deg, ${GOLD}, #c9922e)`,
  color: INK,
  fontWeight: 900,
  textDecoration: 'none',
  cursor: 'pointer',
};
