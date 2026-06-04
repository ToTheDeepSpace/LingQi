import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

const API = '/api';
const C = '#fffdf8';
const GOLD = '#d9a857';
const RED = '#b91c1c';
const INK = '#1f2937';
const MUTED = 'rgba(71,85,105,0.76)';

type Transaction = {
  id: string;
  type: 'recharge' | 'spend';
  amount: number;
  description: string;
  status: 'pending' | 'approved' | 'rejected';
  gateway?: string | null;
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
  const auth = useMemo(() => getAuth(), []);
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const [amountInput, setAmountInput] = useState('50');
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');
  const [showReturnNotice, setShowReturnNotice] = useState(() => new URLSearchParams(window.location.search).get('alipay') === 'return');
  const rechargeAmount = Number(amountInput);
  const amountValid = Number.isInteger(rechargeAmount) && rechargeAmount >= 10 && rechargeAmount <= 5000;
  const amountError = amountInput.trim() && !amountValid
    ? (rechargeAmount > 5000 ? '单次最多 5000 契约币' : '最低 10 契约币，且只能输入整数')
    : '';

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
    if (showReturnNotice) {
      const timer = window.setTimeout(fetchWallet, 3000);
      return () => window.clearTimeout(timer);
    }
  }, [auth, navigate, fetchWallet, showReturnNotice]);

  const startAlipayRecharge = async () => {
    if (!auth) return;
    if (!amountValid) {
      setPayError(amountError || '请输入有效充值金额');
      return;
    }
    setPaying(true);
    setPayError('');
    try {
      const r = await fetch(`${API}/lc/wallet/alipay/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify({ amount: rechargeAmount }),
      });
      const d = await r.json();
      if (d.success && d.data?.pay_url) {
        window.location.href = d.data.pay_url;
      } else {
        setPayError(d.error || '创建支付订单失败');
      }
    } catch { setPayError('网络错误'); }
    finally { setPaying(false); }
  };

  const getRechargeStatus = (tx: Transaction) => {
    if (tx.status === 'approved') return '已到账';
    if (tx.status === 'rejected') return '已拒绝';
    if (tx.gateway === 'alipay') return '待支付/确认中';
    return '审核中';
  };

  if (!auth) return null;

  return (
    <div style={{ backgroundColor: C, minHeight: '100vh', color: INK }}>
      <div style={{ background: 'linear-gradient(135deg, #eef6ff, #fffaf2)', borderBottom: '1px solid rgba(201,146,46,0.2)', padding: '32px 20px' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: '1.5rem', marginBottom: 4 }}>我的契约币</h1>
            <p style={{ fontSize: '0.82rem', color: MUTED }}>契约币用于红黑榜发布、投票、评论</p>
          </div>
          <div style={{
            padding: '16px 24px', borderRadius: 14,
            border: '1px solid rgba(201,146,46,0.28)', background: 'rgba(255,255,255,0.78)',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: '0.75rem', color: 'rgba(71,85,105,0.58)', marginBottom: 4 }}>当前契约币</p>
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
          border: '1px solid rgba(201,146,46,0.22)', background: '#fffaf2',
          boxShadow: '0 16px 40px rgba(31,41,55,0.07)',
        }}>
          <h2 style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: 8 }}>充值</h2>
          <p style={{ fontSize: '0.82rem', color: MUTED, lineHeight: 1.7, marginBottom: 20 }}>
            输入充值金额后跳转支付宝收银台，最低 10 契约币。支付成功后由支付宝异步通知自动到账，不再需要上传凭证。
          </p>

          {showReturnNotice && (
            <div style={{
              padding: '12px 14px', borderRadius: 12, marginBottom: 16,
              background: 'rgba(240,253,244,0.9)', border: '1px solid rgba(21,128,61,0.2)',
              color: '#166534', fontSize: '0.82rem', lineHeight: 1.7,
            }}>
              已从支付宝返回。余额通常会在支付宝通知到达后自动刷新；如果刚付完暂时没变，等 1 分钟再刷新。
              <button onClick={() => setShowReturnNotice(false)}
                style={{ marginLeft: 10, border: 'none', background: 'transparent', color: '#15803d', fontWeight: 800, cursor: 'pointer' }}>
                知道了
              </button>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <p style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: 8, color: 'rgba(71,85,105,0.78)' }}>
                充值契约币 · <span style={{ color: GOLD }}>{amountInput || '--'}</span>
              </p>
              <input
                type="number"
                min={10}
                max={5000}
                step={1}
                value={amountInput}
                onChange={e => setAmountInput(e.target.value)}
                placeholder="输入充值金额，最低 10"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: amountError ? `1px solid ${RED}` : '1px solid rgba(201,146,46,0.22)',
                  background: '#fff',
                  color: INK,
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  outline: 'none',
                  marginBottom: 10,
                }}
              />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                {[10, 20, 50, 100, 200, 500].map(a => (
                  <button key={a} onClick={() => setAmountInput(String(a))}
                    style={{
                      padding: '8px 18px', borderRadius: 10, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
                      border: rechargeAmount === a ? `1px solid ${GOLD}` : '1px solid rgba(201,146,46,0.15)',
                      background: rechargeAmount === a ? 'rgba(201,146,46,0.12)' : '#fff',
                      color: rechargeAmount === a ? '#925f18' : 'rgba(71,85,105,0.66)',
                    }}>{a} 契约币</button>
                ))}
              </div>
              {amountError && <p style={{ color: RED, fontSize: '0.76rem', fontWeight: 700 }}>{amountError}</p>}
            </div>

            <div style={{
              padding: '12px 14px',
              borderRadius: 12,
              border: '1px solid rgba(201,146,46,0.18)',
              background: 'rgba(255,255,255,0.72)',
              color: MUTED,
              fontSize: '0.8rem',
              lineHeight: 1.7,
            }}>
              充值创建后会生成一笔待确认流水；只有支付宝异步通知验签通过后才会入账。未付款订单不会进入人工到账审核。
              已支付充值原则上不支持提现或退款；如需发票，可按实际支付金额申请普通电子发票，企业用户可按公司开票规则提交专票信息。
            </div>

            {payError && (
              <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(254,242,242,0.92)', border: '1px solid rgba(220,38,38,0.24)', color: RED, fontSize: '0.82rem' }}>
                {payError}
              </div>
            )}
            <button onClick={startAlipayRecharge} disabled={paying || !amountValid}
              style={{
                padding: '14px 0', borderRadius: 12, fontWeight: 700, fontSize: '0.95rem',
                cursor: paying || !amountValid ? 'not-allowed' : 'pointer',
                background: paying || !amountValid ? 'rgba(201,146,46,0.15)' : `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`,
                color: paying || !amountValid ? 'rgba(201,146,46,0.4)' : INK, border: 'none',
              }}>
              {paying ? '正在创建支付订单...' : `支付宝支付 · ${amountValid ? rechargeAmount : '--'} 契约币`}
            </button>
          </div>
        </div>

        {/* 交易记录 */}
        <h2 style={{ fontWeight: 800, fontSize: '1rem', marginBottom: 16 }}>交易记录</h2>
        {loading ? (
          <p style={{ color: 'rgba(71,85,105,0.52)', fontSize: '0.85rem' }}>加载中...</p>
        ) : transactions.length === 0 ? (
          <p style={{ color: 'rgba(71,85,105,0.42)', fontSize: '0.85rem', textAlign: 'center', padding: '40px 0' }}>暂无交易记录</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {transactions.map(tx => (
              <div key={tx.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
                padding: '12px 16px', borderRadius: 10,
                border: '1px solid rgba(201,146,46,0.14)', background: '#fff',
              }}>
                <div>
                  <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>{tx.description}</p>
                  <p style={{ fontSize: '0.72rem', color: 'rgba(71,85,105,0.5)' }}>{tx.created_at?.slice(0, 10)}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{
                    fontSize: '0.9rem', fontWeight: 700,
                    color: tx.amount > 0 ? '#15803d' : (tx.type === 'recharge' && tx.status === 'pending' ? '#925f18' : RED),
                  }}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount} 契约币
                  </p>
                  {tx.type === 'recharge' && (
                    <span style={{
                      padding: '2px 8px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 600,
                      background: tx.status === 'approved' ? 'rgba(240,253,244,0.9)' : tx.status === 'pending' ? 'rgba(201,146,46,0.12)' : 'rgba(254,242,242,0.92)',
                      color: tx.status === 'approved' ? '#15803d' : tx.status === 'pending' ? '#925f18' : RED,
                    }}>{getRechargeStatus(tx)}</span>
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
