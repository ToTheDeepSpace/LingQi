import { useCallback, useEffect, useMemo, useState } from 'react';
import type React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import InfoTip from '../components/InfoTip';
import { JumuluCompactHeader, JumuluPageFrame } from '../components/JumuluPageChrome';
import { readStoredCreatorAuth } from '../lib/authSession';
import {
  jumuluCardStyle,
  jumuluPrimaryLinkStyle,
  jumuluSecondaryLinkStyle,
} from '../styles/jumuluPageStyles';

const API = '/api';
const INK = '#1f2937';
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
  metadata?: { dm_name?: string; guide_title?: string; gift_message?: string; is_anonymous?: boolean } | null;
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
    if (!auth) { navigate('/login?redirect=/income'); return; }
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
    <JumuluPageFrame currentLabel="创作者收入" maxWidth={980}>
      <JumuluCompactHeader
        eyebrow="创作者账本"
        title={<>创作者收入 <InfoTip>这里汇总攻略销售、攻略礼物和 DM 缠头产生的可提现收入，不是普通榜金钱包。</InfoTip></>}
        description="查看冻结、可提现、提现中和已打款收入；提现仍按现有资金规则处理。"
        aside={(
          <div>
            <Link to="/chanto" style={jumuluSecondaryLinkStyle}>缠头榜</Link>
            <Link to="/guides/new" style={jumuluPrimaryLinkStyle}>发布攻略</Link>
          </div>
        )}
      />

      <div className="guide-income-metrics">
        {[
          ['冻结中', totals.frozen || 0],
          ['可提现', totals.withdrawable || 0],
          ['提现中', totals.withdraw_requested || 0],
          ['已打款', totals.withdraw_paid || 0],
        ].map(([label, value]) => (
          <div key={label} style={metricStyle}>
            <div style={{ color: '#925f18', fontWeight: 900, fontSize: '1.45rem' }}>{value as number}</div>
            <div style={{ color: MUTED, fontSize: '0.78rem' }}>{label}</div>
          </div>
        ))}
      </div>

      <div className="guide-income-grid">
        <section style={panelStyle}>
          <h2 style={sectionTitleStyle}>收入流水</h2>
          {loading ? <p style={{ color: MUTED }}>加载中...</p> : entries.length === 0 ? <p style={{ color: MUTED }}>暂无收入</p> : (
            <div style={{ display: 'grid', gap: 8 }}>
              {entries.map(entry => (
                <div key={entry.id} style={{ borderBottom: '1px solid rgba(31,41,55,0.08)', paddingBottom: 8 }}>
                  <strong>{incomeSourceLabel(entry.source_type)} · {entry.creator_amount} 收入</strong>
                  <div style={{ color: MUTED, fontSize: '0.8rem', lineHeight: 1.7 }}>
                    毛额 {entry.gross_amount} · 平台服务费 {entry.platform_fee} · 状态 {statusLabel(entry.status)} · 可提现日期 {entry.available_at?.slice(0, 10)}
                  </div>
                  {entry.metadata?.gift_message && <div style={{ marginTop: 4, color: '#475569', fontSize: '0.8rem', lineHeight: 1.65 }}>附言：{entry.metadata.gift_message}</div>}
                </div>
              ))}
            </div>
          )}
        </section>

        <aside style={panelStyle}>
          <h2 style={{ ...sectionTitleStyle, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            申请提现
            <InfoTip>第一版只支持一次性申请全部可提现收入，管理员审核后手工或半自动打款。</InfoTip>
          </h2>
          <select value={form.accountType} onChange={e => setForm({ ...form, accountType: e.target.value })} style={inputStyle}>
            <option value="alipay">支付宝</option>
            <option value="wechat">微信</option>
            <option value="bank">银行卡</option>
            <option value="other">其他</option>
          </select>
          <input value={form.accountName} onChange={e => setForm({ ...form, accountName: e.target.value })} placeholder="收款人姓名" style={inputStyle} />
          <input value={form.accountIdentifier} onChange={e => setForm({ ...form, accountIdentifier: e.target.value })} placeholder="账号 / 卡号 / 备注" style={inputStyle} />
          {message && <p style={{ color: message.includes('失败') || message.includes('不足') || message.includes('错误') ? '#b91c1c' : '#166534' }}>{message}</p>}
          <button type="button" onClick={() => void requestWithdrawal()} style={{ ...jumuluPrimaryLinkStyle, width: '100%', marginTop: 10 }}>申请提现 {totals.withdrawable || 0}</button>
          <h3 style={{ margin: '18px 0 8px', fontSize: 15 }}>提现记录</h3>
          {withdrawals.length === 0 ? <p style={{ color: MUTED }}>暂无提现申请</p> : withdrawals.map(item => (
            <div key={item.id} style={{ fontSize: '0.82rem', color: MUTED, borderTop: '1px solid rgba(31,41,55,0.08)', padding: '8px 0' }}>
              {item.amount} · {statusLabel(item.status)} · {item.created_at?.slice(0, 10)}
              {item.admin_note ? <div>备注：{item.admin_note}</div> : null}
            </div>
          ))}
        </aside>
      </div>
    </JumuluPageFrame>
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

function incomeSourceLabel(sourceType: string) {
  if (sourceType === 'dm_gift') return 'DM 缠头';
  if (sourceType === 'guide_gift') return '攻略礼物';
  if (sourceType === 'guide_purchase') return '攻略销售';
  return '创作者';
}

const metricStyle: React.CSSProperties = { ...jumuluCardStyle, padding: '12px 14px' };
const panelStyle: React.CSSProperties = { ...jumuluCardStyle, minWidth: 0, padding: 16 };
const sectionTitleStyle: React.CSSProperties = { margin: '0 0 12px', fontSize: 17 };

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  marginTop: 8,
  border: '1px solid rgba(31,41,55,0.14)',
  borderRadius: 8,
  padding: '10px 12px',
  background: '#fff',
  color: INK,
};
