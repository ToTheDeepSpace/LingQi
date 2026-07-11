import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import InfoTip from '../components/InfoTip';
import { readStoredCreatorAuth } from '../lib/authSession';

const API = '/api';
const C = '#fffdf8';
const GOLD = '#d9a857';
const RED = '#b91c1c';
const INK = '#1f2937';
const MUTED = 'rgba(71,85,105,0.76)';
const MAX_RECHARGE_AMOUNT = 500;
const PAYMENT_ORDER_TTL_MINUTES = 30;

type Transaction = {
  id: string;
  type: 'recharge' | 'spend' | 'refund';
  amount: number;
  paid_amount?: number | null;
  bonus_amount?: number | null;
  description: string;
  status: 'pending' | 'approved' | 'rejected';
  gateway?: string | null;
  external_order_no?: string | null;
  reject_reason?: string | null;
  balance_before?: number | null;
  balance_after?: number | null;
  paid_balance_before?: number | null;
  paid_balance_after?: number | null;
  bonus_balance_before?: number | null;
  bonus_balance_after?: number | null;
  created_at: string;
};

type WechatPayOrder = {
  codeUrl: string;
  qrDataUrl: string;
  outTradeNo: string;
  amount: number;
};

function getAuth() {
  return readStoredCreatorAuth();
}

export default function Wallet() {
  const navigate = useNavigate();
  const auth = useMemo(() => getAuth(), []);
  const [balance, setBalance] = useState<number | null>(null);
  const [paidBalance, setPaidBalance] = useState<number | null>(null);
  const [bonusBalance, setBonusBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const [amountInput, setAmountInput] = useState('50');
  const [payingGateway, setPayingGateway] = useState<'alipay' | 'wechat_pay' | ''>('');
  const [payError, setPayError] = useState('');
  const [wechatOrder, setWechatOrder] = useState<WechatPayOrder | null>(null);
  const [transactionFilter, setTransactionFilter] = useState<'active' | 'failed'>('active');
  const [showReturnNotice, setShowReturnNotice] = useState(() => new URLSearchParams(window.location.search).get('alipay') === 'return');
  const rechargeAmount = Number(amountInput);
  const amountValid = Number.isInteger(rechargeAmount) && rechargeAmount >= 10 && rechargeAmount <= MAX_RECHARGE_AMOUNT;
  const amountError = amountInput.trim() && !amountValid
    ? (rechargeAmount > MAX_RECHARGE_AMOUNT ? `单次最多 ${MAX_RECHARGE_AMOUNT} 榜金` : '最低 10 榜金，且只能输入整数')
    : '';

  const fetchWallet = useCallback((silent = false) => {
    if (!auth) return;
    if (!silent) setLoading(true);
    fetch(`${API}/lc/wallet`, { headers: { Authorization: `Bearer ${auth.token}` } })
      .then(r => r.json())
      .then(d => {
	        if (d.success) {
	          setBalance(d.data.balance);
	          setPaidBalance(d.data.paid_balance ?? 0);
	          setBonusBalance(d.data.bonus_balance ?? 0);
	          setTransactions(d.data.transactions || []);
	        }
      })
      .finally(() => {
        if (!silent) setLoading(false);
      });
  }, [auth]);

  useEffect(() => {
    if (!auth) { navigate('/login'); return; }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchWallet();
    if (showReturnNotice) {
      const timer = window.setTimeout(() => fetchWallet(true), 3000);
      return () => window.clearTimeout(timer);
    }
  }, [auth, navigate, fetchWallet, showReturnNotice]);

  useEffect(() => {
    if (!auth || !wechatOrder) return;
    const timer = window.setInterval(() => fetchWallet(true), 5000);
    return () => window.clearInterval(timer);
  }, [auth, wechatOrder, fetchWallet]);

  const startAlipayRecharge = async () => {
    if (!auth) return;
    if (!amountValid) {
      setPayError(amountError || '请输入有效充值金额');
      return;
    }
    setPayingGateway('alipay');
    setPayError('');
    setWechatOrder(null);
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
    finally { setPayingGateway(''); }
  };

  const startWechatRecharge = async () => {
    if (!auth) return;
    if (!amountValid) {
      setPayError(amountError || '请输入有效充值金额');
      return;
    }
    setPayingGateway('wechat_pay');
    setPayError('');
    setWechatOrder(null);
    try {
      const r = await fetch(`${API}/lc/wallet/wechat/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify({ amount: rechargeAmount }),
      });
      const d = await r.json();
      if (d.success && d.data?.code_url) {
        const qrDataUrl = await QRCode.toDataURL(d.data.code_url, {
          width: 220,
          margin: 1,
          color: { dark: '#1f2937', light: '#ffffff' },
        });
        setWechatOrder({
          codeUrl: d.data.code_url,
          qrDataUrl,
          outTradeNo: d.data.out_trade_no,
          amount: rechargeAmount,
        });
        fetchWallet(true);
      } else {
        setPayError(d.error || '创建微信支付订单失败');
      }
    } catch { setPayError('网络错误'); }
    finally { setPayingGateway(''); }
  };

  const getRechargeStatus = (tx: Transaction) => {
    if (tx.status === 'approved') return '已到账';
    if (tx.status === 'rejected' && tx.gateway) return '支付失败/已过期';
    if (tx.status === 'rejected') return '已拒绝';
    if (tx.gateway === 'alipay' || tx.gateway === 'wechat_pay') return '待支付/确认中';
    return '审核中';
  };

	  const getBalanceSnapshot = (tx: Transaction) => {
	    const before = typeof tx.balance_before === 'number' ? tx.balance_before : null;
	    const after = typeof tx.balance_after === 'number' ? tx.balance_after : null;
	    if (before === null || after === null) return '';
	    return `余额 ${before} -> ${after}`;
	  };

	  const getSplitSnapshot = (tx: Transaction) => {
	    const paidBefore = typeof tx.paid_balance_before === 'number' ? tx.paid_balance_before : null;
	    const paidAfter = typeof tx.paid_balance_after === 'number' ? tx.paid_balance_after : null;
	    const bonusBefore = typeof tx.bonus_balance_before === 'number' ? tx.bonus_balance_before : null;
	    const bonusAfter = typeof tx.bonus_balance_after === 'number' ? tx.bonus_balance_after : null;
	    const parts: string[] = [];
	    if (paidBefore !== null && paidAfter !== null) parts.push(`充值榜金 ${paidBefore} -> ${paidAfter}`);
	    if (bonusBefore !== null && bonusAfter !== null) parts.push(`赠送榜金 ${bonusBefore} -> ${bonusAfter}`);
	    return parts.join(' · ');
	  };

	  const getSplitAmountText = (tx: Transaction) => {
	    const paid = typeof tx.paid_amount === 'number' ? tx.paid_amount : 0;
	    const bonus = typeof tx.bonus_amount === 'number' ? tx.bonus_amount : 0;
	    const parts: string[] = [];
	    if (paid !== 0) parts.push(`充值榜金 ${paid > 0 ? '+' : ''}${paid}`);
	    if (bonus !== 0) parts.push(`赠送榜金 ${bonus > 0 ? '+' : ''}${bonus}`);
	    return parts.join(' / ');
	  };

  const isFailedRecharge = (tx: Transaction) => tx.type === 'recharge' && tx.status === 'rejected';
  const failedTransactions = transactions.filter(isFailedRecharge);
  const activeTransactions = transactions.filter(tx => !isFailedRecharge(tx));
  const visibleTransactions = transactionFilter === 'failed' ? failedTransactions : activeTransactions;
  const emptyText = transactionFilter === 'failed' ? '暂无失败或已过期充值' : '暂无交易记录';

  if (!auth) return null;

  return (
    <div style={{ backgroundColor: C, minHeight: '100vh', color: INK }}>
	      <div style={{ background: 'linear-gradient(135deg, #eef6ff, #fffaf2)', borderBottom: '1px solid rgba(201,146,46,0.2)', padding: '32px 20px' }}>
	        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
	          <div>
	            <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: '1.5rem', marginBottom: 4 }}>我的榜金</h1>
	            <p style={{ fontSize: '0.82rem', color: MUTED }}>充值榜金来自支付充值；赠送榜金来自注册、邀请和维护奖励。消费默认先用赠送榜金，再用充值榜金。</p>
	            <Link to="/referrals" style={{ display: 'inline-flex', marginTop: 10, padding: '6px 10px', borderRadius: 10, border: '1px solid rgba(201,146,46,0.24)', color: '#925f18', background: 'rgba(255,255,255,0.78)', textDecoration: 'none', fontSize: '0.78rem', fontWeight: 850 }}>
	              查看邀请奖励
	            </Link>
	          </div>
	          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(88px, 1fr))', gap: 8, flex: '1 1 340px', maxWidth: 420 }}>
	            {[
	              { label: '总榜金', value: balance, color: GOLD },
	              { label: '充值榜金', value: paidBalance, color: '#166534' },
	              { label: '赠送榜金', value: bonusBalance, color: '#275389' },
	            ].map(item => (
	              <div key={item.label} style={{
	                padding: '13px 12px', borderRadius: 12,
	                border: '1px solid rgba(201,146,46,0.24)', background: 'rgba(255,255,255,0.78)',
	                textAlign: 'center',
	              }}>
	                <p style={{ fontSize: '0.72rem', color: 'rgba(71,85,105,0.58)', marginBottom: 4 }}>{item.label}</p>
	                <p style={{ fontSize: '1.45rem', fontWeight: 900, color: item.color }}>
	                  {item.value === null ? '...' : item.value}
	                </p>
	              </div>
	            ))}
	          </div>
	        </div>
	      </div>

	      <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 20px 80px' }}>
        {/* 充值区 */}
        <div style={{
          padding: 28, borderRadius: 16, marginBottom: 32,
          border: '1px solid rgba(201,146,46,0.22)', background: '#fffaf2',
          boxShadow: '0 16px 40px rgba(31,41,55,0.07)',
        }}>
	          <h2 style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: 8 }}>充值</h2>
	          <p style={{ fontSize: '0.82rem', color: MUTED, lineHeight: 1.7, marginBottom: 20 }}>
	            输入充值金额后选择微信扫码或支付宝电脑支付，支付成功后进入充值榜金。支付订单 {PAYMENT_ORDER_TTL_MINUTES} 分钟内有效。最低 10 榜金，单次最多 {MAX_RECHARGE_AMOUNT} 榜金。建议按实际需要小额充值。
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
	                充值榜金 · <span style={{ color: GOLD }}>{amountInput || '--'}</span>
              </p>
              <input
                type="number"
                min={10}
                max={MAX_RECHARGE_AMOUNT}
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
	                    }}>{a} 充值榜金</button>
                ))}
              </div>
              {amountError && <p style={{ color: RED, fontSize: '0.76rem', fontWeight: 700 }}>{amountError}</p>}
            </div>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: MUTED, fontSize: '0.8rem', lineHeight: 1.6, marginBottom: 2 }}>
              按需充值，充值入账后原则上不支持提现或无理由退款。
              <InfoTip>只有支付平台异步通知验签通过后才会入账。充值所得为充值榜金，赠送和奖励所得为赠送榜金；站内消费默认先扣赠送榜金，再扣充值榜金。榜金是站内服务预付额度，充值入账后会产生支付通道、开票和账务处理成本；如遇重复扣款、支付成功未到账、平台原因无法使用等异常，可联系平台核查处理。发票可按实际支付金额申请，企业用户可按公司开票规则提交专票信息。</InfoTip>
            </div>

            {wechatOrder && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 18,
                alignItems: 'center',
                padding: 16,
                borderRadius: 12,
                border: '1px solid rgba(21,128,61,0.22)',
                background: 'rgba(240,253,244,0.92)',
              }}>
                <img
                  src={wechatOrder.qrDataUrl}
                  alt="微信支付二维码"
                  style={{ width: '100%', maxWidth: 220, aspectRatio: '1 / 1', borderRadius: 8, background: '#fff', border: '1px solid rgba(21,128,61,0.16)' }}
                />
                <div>
	                  <p style={{ margin: '0 0 6px', fontWeight: 900, color: '#166534' }}>微信扫码支付 · {wechatOrder.amount} 充值榜金</p>
                  <p style={{ margin: '0 0 12px', color: '#166534', fontSize: '0.8rem', lineHeight: 1.7 }}>
                    使用微信扫码完成支付，二维码 {PAYMENT_ORDER_TTL_MINUTES} 分钟内有效。支付成功后通常会自动到账；如果余额暂时没变，等一分钟再刷新。
                  </p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button onClick={() => fetchWallet()}
                      style={{ border: '1px solid rgba(21,128,61,0.24)', background: '#fff', color: '#166534', borderRadius: 10, padding: '8px 12px', fontWeight: 800, cursor: 'pointer' }}>
                      刷新余额
                    </button>
                    <button onClick={() => setWechatOrder(null)}
                      style={{ border: 'none', background: 'transparent', color: 'rgba(22,101,52,0.72)', borderRadius: 10, padding: '8px 12px', fontWeight: 800, cursor: 'pointer' }}>
                      关闭
                    </button>
                  </div>
                </div>
              </div>
            )}

            {payError && (
              <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(254,242,242,0.92)', border: '1px solid rgba(220,38,38,0.24)', color: RED, fontSize: '0.82rem' }}>
                {payError}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              <button onClick={startWechatRecharge} disabled={Boolean(payingGateway) || !amountValid}
                style={{
                  padding: '14px 0', borderRadius: 12, fontWeight: 800, fontSize: '0.95rem',
                  cursor: payingGateway || !amountValid ? 'not-allowed' : 'pointer',
                  background: payingGateway || !amountValid ? 'rgba(21,128,61,0.12)' : '#16a34a',
                  color: payingGateway || !amountValid ? 'rgba(22,101,52,0.38)' : '#fff', border: 'none',
                }}>
	                {payingGateway === 'wechat_pay' ? '正在创建微信订单...' : `微信扫码支付 · ${amountValid ? rechargeAmount : '--'} 充值榜金`}
              </button>
              <button onClick={startAlipayRecharge} disabled={Boolean(payingGateway) || !amountValid}
                style={{
                  padding: '14px 0', borderRadius: 12, fontWeight: 800, fontSize: '0.95rem',
                  cursor: payingGateway || !amountValid ? 'not-allowed' : 'pointer',
                  background: payingGateway || !amountValid ? 'rgba(201,146,46,0.15)' : `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`,
                  color: payingGateway || !amountValid ? 'rgba(201,146,46,0.4)' : INK, border: 'none',
                }}>
	                {payingGateway === 'alipay' ? '正在创建支付宝订单...' : `支付宝电脑支付 · ${amountValid ? rechargeAmount : '--'} 充值榜金`}
              </button>
            </div>
          </div>
        </div>

        {/* 交易记录 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <h2 style={{ fontWeight: 800, fontSize: '1rem', margin: 0 }}>交易记录</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => setTransactionFilter('active')}
              style={{
                border: transactionFilter === 'active' ? `1px solid ${GOLD}` : '1px solid rgba(201,146,46,0.18)',
                background: transactionFilter === 'active' ? 'rgba(201,146,46,0.12)' : '#fff',
                color: transactionFilter === 'active' ? '#925f18' : 'rgba(71,85,105,0.66)',
                borderRadius: 999,
                padding: '6px 12px',
                fontSize: '0.76rem',
                fontWeight: 850,
                cursor: 'pointer',
              }}>
              正常记录 {activeTransactions.length}
            </button>
            <button onClick={() => setTransactionFilter('failed')}
              style={{
                border: transactionFilter === 'failed' ? `1px solid ${RED}` : '1px solid rgba(220,38,38,0.18)',
                background: transactionFilter === 'failed' ? 'rgba(254,242,242,0.95)' : '#fff',
                color: transactionFilter === 'failed' ? RED : 'rgba(127,29,29,0.62)',
                borderRadius: 999,
                padding: '6px 12px',
                fontSize: '0.76rem',
                fontWeight: 850,
                cursor: 'pointer',
              }}>
              失败/已过期 {failedTransactions.length}
            </button>
          </div>
        </div>
        {loading ? (
          <p style={{ color: 'rgba(71,85,105,0.52)', fontSize: '0.85rem' }}>加载中...</p>
        ) : visibleTransactions.length === 0 ? (
          <p style={{ color: 'rgba(71,85,105,0.42)', fontSize: '0.85rem', textAlign: 'center', padding: '40px 0' }}>{emptyText}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {visibleTransactions.map(tx => (
              <div key={tx.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
                padding: '12px 16px', borderRadius: 10,
                border: '1px solid rgba(201,146,46,0.14)', background: '#fff',
              }}>
                <div>
                  <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>{tx.description}</p>
                  <p style={{ fontSize: '0.72rem', color: 'rgba(71,85,105,0.5)' }}>{tx.created_at?.slice(0, 10)}</p>
	                  {getBalanceSnapshot(tx) && (
	                    <p style={{ fontSize: '0.72rem', color: 'rgba(71,85,105,0.68)', marginTop: 2 }}>{getBalanceSnapshot(tx)}</p>
	                  )}
	                  {getSplitSnapshot(tx) && (
	                    <p style={{ fontSize: '0.72rem', color: 'rgba(71,85,105,0.58)', marginTop: 2 }}>{getSplitSnapshot(tx)}</p>
	                  )}
	                  {tx.type === 'recharge' && tx.status === 'rejected' && tx.reject_reason && (
                    <p style={{ fontSize: '0.72rem', color: 'rgba(185,28,28,0.72)', marginTop: 2 }}>{tx.reject_reason}</p>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
	                  <p style={{
	                    fontSize: '0.9rem', fontWeight: 700,
                    color: tx.type === 'recharge' && tx.status === 'rejected'
                      ? RED
                      : tx.amount > 0
                        ? '#15803d'
                        : (tx.type === 'recharge' && tx.status === 'pending' ? '#925f18' : RED),
	                  }}>
	                    {tx.amount > 0 ? '+' : ''}{tx.amount} 榜金
	                  </p>
	                  {getSplitAmountText(tx) && (
	                    <p style={{ fontSize: '0.7rem', color: 'rgba(71,85,105,0.58)', marginTop: 2 }}>{getSplitAmountText(tx)}</p>
	                  )}
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
