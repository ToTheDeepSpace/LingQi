import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const API = '/api';
const C = '#0F1117';
const GOLD = '#d9a857';
const RED = '#f87171';

type Transaction = {
  id: string;
  type: 'recharge' | 'spend';
  amount: number;
  description: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
};

function getAuth() {
  try {
    const stored = localStorage.getItem('lc_creator');
    if (!stored) return null;
    const data = JSON.parse(stored);
    if (!data?.token) return null;
    const payload = JSON.parse(atob(data.token.split('.')[1]));
    if (payload.exp * 1000 < Date.now()) return null;
    return data;
  } catch { return null; }
}

export default function Wallet() {
  const navigate = useNavigate();
  const auth = getAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const [amount, setAmount] = useState(50);
  const [paymentProof, setPaymentProof] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [rechargeError, setRechargeError] = useState('');

  const fetchWallet = useCallback(() => {
    if (!auth) return;
    setLoading(true);
    fetch(`${API}/lc/wallet`, { headers: { Authorization: `Bearer ${auth.token}` } })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setBalance(d.data.balance);
          setTransactions(d.data.transactions || []);
        }
      })
      .finally(() => setLoading(false));
  }, [auth]);

  useEffect(() => {
    if (!auth) { navigate('/login'); return; }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchWallet();
  }, [auth, navigate, fetchWallet]);

  const submitRecharge = async () => {
    if (!auth) return;
    if (!paymentProof.trim()) return setRechargeError('请填写支付凭证（微信/支付宝转账截图链接或单号）');
    setSubmitting(true);
    setRechargeError('');
    try {
      const r = await fetch(`${API}/lc/wallet/recharge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify({ amount, paymentProof: paymentProof.trim() }),
      });
      const d = await r.json();
      if (d.success) {
        setDone(true);
        fetchWallet();
      } else {
        setRechargeError(d.error || '提交失败');
      }
    } catch { setRechargeError('网络错误'); }
    finally { setSubmitting(false); }
  };

  if (!auth) return null;

  return (
    <div style={{ backgroundColor: C, minHeight: '100vh', color: '#fff' }}>
      <div style={{ backgroundColor: '#1A1D27', borderBottom: '1px solid rgba(201,146,46,0.12)', padding: '32px 20px' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: '1.5rem', marginBottom: 4 }}>我的契约币</h1>
            <p style={{ fontSize: '0.82rem', color: 'rgba(186,207,231,0.55)' }}>契约币用于红黑榜发布、投票、评论</p>
          </div>
          <div style={{
            padding: '16px 24px', borderRadius: 14,
            border: '1px solid rgba(201,146,46,0.25)', background: 'rgba(201,146,46,0.06)',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: '0.75rem', color: 'rgba(186,207,231,0.45)', marginBottom: 4 }}>当前契约币</p>
            <p style={{ fontSize: '1.8rem', fontWeight: 900, color: GOLD }}>
              {balance === null ? '...' : balance}
            </p>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 20px 80px' }}>
        {/* 充值区 */}
        <div style={{
          padding: 28, borderRadius: 16, marginBottom: 32,
          border: '1px solid rgba(201,146,46,0.15)', background: 'rgba(255,255,255,0.03)',
        }}>
          <h2 style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: 8 }}>充值</h2>
          <p style={{ fontSize: '0.82rem', color: 'rgba(186,207,231,0.55)', lineHeight: 1.7, marginBottom: 20 }}>
            转账到指定账户后，填写支付凭证并提交。管理员审核后到账。
          </p>

          {done ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
              <p style={{ color: 'rgba(186,207,231,0.75)', marginBottom: 16 }}>充值申请已提交，等待管理员审核</p>
              <button onClick={() => { setDone(false); setPaymentProof(''); }}
                style={{ padding: '10px 24px', borderRadius: 10, border: `1px solid ${GOLD}`, background: 'none', color: GOLD, cursor: 'pointer', fontWeight: 600 }}>
                再次充值
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <p style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: 8, color: 'rgba(186,207,231,0.7)' }}>
                  充值契约币 · <span style={{ color: GOLD }}>{amount}</span>
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  {[20, 50, 100, 200, 500].map(a => (
                    <button key={a} onClick={() => setAmount(a)}
                      style={{
                        padding: '8px 18px', borderRadius: 10, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
                        border: amount === a ? `1px solid ${GOLD}` : '1px solid rgba(201,146,46,0.15)',
                        background: amount === a ? 'rgba(201,146,46,0.12)' : 'transparent',
                        color: amount === a ? GOLD : 'rgba(186,207,231,0.45)',
                      }}>{a} 契约币</button>
                  ))}
                </div>
              </div>
              <div>
                <p style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: 8, color: 'rgba(186,207,231,0.7)' }}>
                  支付凭证 <span style={{ color: RED }}>*</span>
                </p>
                <textarea value={paymentProof} onChange={e => setPaymentProof(e.target.value)}
                  placeholder="微信/支付宝转账截图链接，或转账单号..." rows={3}
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: 10, fontSize: '0.85rem',
                    border: '1px solid rgba(201,146,46,0.2)', background: 'rgba(255,255,255,0.05)',
                    color: '#fff', resize: 'none', outline: 'none', boxSizing: 'border-box',
                  }} />
              </div>
              {rechargeError && (
                <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#fca5a5', fontSize: '0.82rem' }}>
                  {rechargeError}
                </div>
              )}
              <button onClick={submitRecharge} disabled={submitting}
                style={{
                  padding: '14px 0', borderRadius: 12, fontWeight: 700, fontSize: '0.95rem',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  background: submitting ? 'rgba(201,146,46,0.15)' : `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`,
                  color: submitting ? 'rgba(201,146,46,0.4)' : C, border: 'none',
                }}>
                {submitting ? '提交中...' : '提交充值申请'}
              </button>
            </div>
          )}
        </div>

        {/* 交易记录 */}
        <h2 style={{ fontWeight: 800, fontSize: '1rem', marginBottom: 16 }}>交易记录</h2>
        {loading ? (
          <p style={{ color: 'rgba(186,207,231,0.4)', fontSize: '0.85rem' }}>加载中...</p>
        ) : transactions.length === 0 ? (
          <p style={{ color: 'rgba(186,207,231,0.35)', fontSize: '0.85rem', textAlign: 'center', padding: '40px 0' }}>暂无交易记录</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {transactions.map(tx => (
              <div key={tx.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
                padding: '12px 16px', borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)',
              }}>
                <div>
                  <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>{tx.description}</p>
                  <p style={{ fontSize: '0.72rem', color: 'rgba(186,207,231,0.4)' }}>{tx.created_at?.slice(0, 10)}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{
                    fontSize: '0.9rem', fontWeight: 700,
                    color: tx.amount > 0 ? '#34d399' : (tx.type === 'recharge' && tx.status === 'pending' ? GOLD : RED),
                  }}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount} 契约币
                  </p>
                  {tx.type === 'recharge' && (
                    <span style={{
                      padding: '2px 8px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 600,
                      background: tx.status === 'approved' ? 'rgba(52,211,153,0.1)' : tx.status === 'pending' ? 'rgba(201,146,46,0.1)' : 'rgba(248,113,113,0.08)',
                      color: tx.status === 'approved' ? '#34d399' : tx.status === 'pending' ? GOLD : RED,
                    }}>{tx.status === 'approved' ? '已到账' : tx.status === 'pending' ? '审核中' : '已拒绝'}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
