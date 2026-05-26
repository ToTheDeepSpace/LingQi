import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PROVINCE_CITIES } from '../constants/cities';

const API  = '/api';
const C    = '#0F1117';
const C2   = '#1A1D27';
const GOLD = '#d9a857';

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px', borderRadius: 10,
  border: '1px solid rgba(201,146,46,0.2)', outline: 'none',
  backgroundColor: 'rgba(255,255,255,0.05)', color: '#fff',
  fontSize: '0.875rem', boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.78rem', fontWeight: 600,
  color: 'rgba(186,207,231,0.7)', marginBottom: 8,
};
const selectStyle: React.CSSProperties = {
  padding: '11px 14px', borderRadius: 10, border: '1px solid rgba(201,146,46,0.2)',
  outline: 'none', backgroundColor: '#0d1f38', color: '#fff',
  fontSize: '0.875rem', boxSizing: 'border-box', width: '100%', cursor: 'pointer',
} as React.CSSProperties;

function getAuth(): { token: string; displayName: string } | null {
  try {
    const stored = localStorage.getItem('lc_creator');
    if (!stored) return null;
    const data = JSON.parse(stored);
    if (!data?.token) return null;
    const payload = JSON.parse(atob(data.token.split('.')[1]));
    if (payload.exp * 1000 < Date.now()) return null;
    return { token: data.token, displayName: data.display_name || '用户' };
  } catch { return null; }
}

export default function CreateRanking() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [auth] = useState(() => getAuth());

  // 表单状态
  const [type, setType]               = useState<'red' | 'black'>('red');
  const [subjectType, setSubjectType] = useState<'creator' | 'dm' | 'store' | 'player'>('creator');
  const [subjectName, setSubjectName] = useState('');
  const [subjectProvince, setSubjectProvince] = useState('');
  const [subjectCity, setSubjectCity] = useState('');
  const [content, setContent]         = useState('');
  const [initialAmount, setInitialAmount] = useState(10);

  // 主体社交链接（可选）
  const [showUrlField, setShowUrlField] = useState(false);
  const [subjectUrl, setSubjectUrl]     = useState('');

  // 顺手提交主体信息
  const [addNew, setAddNew]   = useState(false);
  const [newDesc, setNewDesc] = useState('');

  // 支付步骤
  const [paymentProof, setPaymentProof] = useState('');
  const [submitting, setSubmitting]     = useState(false);
  const [error, setError]               = useState('');
  const [success, setSuccess]           = useState(false);

  useEffect(() => {
    if (!auth) navigate('/login');
  }, [auth, navigate]);

  const canProceed = subjectName.trim() && content.trim();

  const submit = async () => {
    if (!auth) { navigate('/login'); return; }
    if (!paymentProof.trim()) { setError('请填写支付凭证'); return; }
    setSubmitting(true); setError('');
    try {
      const body: Record<string, unknown> = {
        type, subjectName: subjectName.trim(), subjectType,
        subjectCity: subjectCity || null,
        subjectUrl: subjectUrl.trim() || null,
        content: content.trim(),
        initialAmount, paymentProof: paymentProof.trim(),
      };
      if (addNew && newDesc) {
        body.newSubject = {
          name: subjectName.trim(), subject_type: subjectType,
          city: subjectCity || null, description: newDesc.trim() || null,
          contact: subjectUrl.trim() || null,
        };
      }
      const r = await fetch(`${API}/lc/rankings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (d.success) { setSuccess(true); }
      else { setError(d.error || '提交失败'); }
    } catch { setError('网络错误'); }
    finally { setSubmitting(false); }
  };

  if (!auth) return null;

  if (success) return (
    <div style={{ backgroundColor: C, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <div style={{ fontSize: 64, marginBottom: 20 }}>✅</div>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: '1.5rem', marginBottom: 12 }}>提交成功</h2>
        <p style={{ color: 'rgba(186,207,231,0.7)', lineHeight: 1.8, marginBottom: 28 }}>
          内容正在等待管理员审核，通过后将显示在红黑榜上。
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <Link to="/rankings" style={{ padding: '11px 24px', borderRadius: 10, background: `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`, color: C, fontWeight: 700, fontSize: '0.875rem', textDecoration: 'none' }}>
            查看红黑榜
          </Link>
          <button onClick={() => { setSuccess(false); setStep(1); setPaymentProof(''); setSubjectName(''); setContent(''); }}
            style={{ padding: '11px 24px', borderRadius: 10, border: '1px solid rgba(201,146,46,0.2)', background: 'none', color: 'rgba(186,207,231,0.7)', cursor: 'pointer', fontSize: '0.875rem' }}>
            继续发布
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ backgroundColor: C, minHeight: '100vh', color: '#fff' }}>

      {/* Header */}
      <div style={{ backgroundColor: C2, borderBottom: '1px solid rgba(201,146,46,0.12)', padding: '32px 20px 28px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <Link to="/rankings" style={{ color: 'rgba(186,207,231,0.6)', fontSize: '0.875rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 20 }}
            onMouseEnter={e => (e.currentTarget.style.color = GOLD)}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(186,207,231,0.6)')}>
            ← 返回红黑榜
          </Link>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: '1.8rem', marginBottom: 6 }}>发布评价</h1>
          <p style={{ color: 'rgba(186,207,231,0.65)', fontSize: '0.875rem' }}>内容经审核后上线 · 初始点赞值 ¥10~100</p>
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 20px 80px' }}>

        {/* 发布身份 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', backgroundColor: 'rgba(201,146,46,0.06)', border: '1px solid rgba(201,146,46,0.15)', borderRadius: 10, marginBottom: 24 }}>
          <span style={{ fontSize: '0.82rem', color: 'rgba(186,207,231,0.6)' }}>以</span>
          <span style={{ fontWeight: 700, color: GOLD, fontSize: '0.9rem' }}>{auth.displayName}</span>
          <span style={{ fontSize: '0.82rem', color: 'rgba(186,207,231,0.6)' }}>的身份发布</span>
        </div>

        {/* 步骤指示 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
          {[{ n: 1, label: '填写内容' }, { n: 2, label: '支付上线' }].map(s => (
            <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: '0.82rem',
                background: step >= s.n ? `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)` : 'rgba(255,255,255,0.06)',
                color: step >= s.n ? C : 'rgba(186,207,231,0.4)',
                border: step >= s.n ? 'none' : '1px solid rgba(201,146,46,0.15)',
              }}>{s.n}</div>
              <span style={{ fontSize: '0.82rem', color: step >= s.n ? 'rgba(186,207,231,0.85)' : 'rgba(186,207,231,0.4)', fontWeight: step === s.n ? 600 : 400 }}>{s.label}</span>
              {s.n < 2 && <span style={{ color: 'rgba(186,207,231,0.25)', fontSize: '0.8rem', marginLeft: 4 }}>→</span>}
            </div>
          ))}
        </div>

        {error && (
          <div style={{ padding: '12px 16px', backgroundColor: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 10, fontSize: '0.875rem', color: '#f87171', marginBottom: 20 }}>
            {error}
          </div>
        )}

        {/* ── Step 1: 内容填写 ── */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* 红榜 / 黑榜 */}
            <div>
              <label style={labelStyle}>榜单类型</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {([['red', '🏅 红榜', '#dc2626'], ['black', '👎 黑榜', '#475569']] as const).map(([v, label, color]) => (
                  <button key={v} onClick={() => setType(v)}
                    style={{
                      flex: 1, padding: '12px', borderRadius: 10, border: 'none', cursor: 'pointer',
                      fontWeight: 600, fontSize: '0.9rem',
                      background: type === v ? color : 'rgba(255,255,255,0.04)',
                      color: type === v ? '#fff' : 'rgba(186,207,231,0.55)',
                      boxShadow: type === v ? `0 4px 16px ${color}50` : 'none',
                    }}>{label}</button>
                ))}
              </div>
            </div>

            {/* 对象类型 */}
            <div>
              <label style={labelStyle}>评价对象类型</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {([['creator', '灵契师（委托师）'], ['dm', 'DM（卡司）'], ['store', '店家'], ['player', '玩家']] as const).map(([v, label]) => (
                  <button key={v} onClick={() => setSubjectType(v)}
                    style={{
                      padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
                      border: subjectType === v ? `1px solid ${GOLD}` : '1px solid rgba(201,146,46,0.18)',
                      background: subjectType === v ? 'rgba(201,146,46,0.12)' : 'transparent',
                      color: subjectType === v ? GOLD : 'rgba(186,207,231,0.6)',
                    }}>{label}</button>
                ))}
              </div>
            </div>

            {/* 名字 + 城市 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={labelStyle}>名字 / 昵称 <span style={{ color: '#f87171' }}>*</span></label>
                <input value={subjectName} onChange={e => setSubjectName(e.target.value)}
                  placeholder="DM昵称、店家名称等" style={inputStyle} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={labelStyle}>所在城市</label>
                <select value={subjectProvince} onChange={e => { setSubjectProvince(e.target.value); setSubjectCity(''); }} style={selectStyle}>
                  <option value="">选择省份 / 地区</option>
                  {Object.keys(PROVINCE_CITIES).map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                {subjectProvince && (
                  <select value={subjectCity} onChange={e => setSubjectCity(e.target.value)} style={selectStyle}>
                    <option value="">选择城市</option>
                    {(PROVINCE_CITIES[subjectProvince] || []).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}
              </div>
            </div>

            {/* 社交主页链接（可选） */}
            <div>
              <button onClick={() => setShowUrlField(!showUrlField)}
                style={{ background: 'none', border: '1px dashed rgba(201,146,46,0.25)', borderRadius: 8, cursor: 'pointer', color: 'rgba(201,146,46,0.6)', fontSize: '0.8rem', padding: '7px 14px', transition: 'all 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = GOLD)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(201,146,46,0.25)')}>
                {showUrlField ? '− 取消添加链接' : '+ 添加 ta 的社交主页链接（可选）'}
              </button>
              {showUrlField && (
                <input value={subjectUrl} onChange={e => setSubjectUrl(e.target.value)}
                  placeholder="如抖音、B站、小红书主页链接..."
                  style={{ ...inputStyle, marginTop: 10 }} />
              )}
            </div>

            {/* 评价内容 */}
            <div>
              <label style={labelStyle}>评价内容 <span style={{ color: '#f87171' }}>*</span></label>
              <textarea value={content} onChange={e => setContent(e.target.value)}
                placeholder={type === 'red' ? '分享你的好评体验，描述让你印象深刻的细节...' : '描述问题事件，尽量客观具体，保留证据...'}
                rows={5} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>

            {/* 可选：顺手补充主体介绍 */}
            <div style={{ borderTop: '1px solid rgba(201,146,46,0.1)', paddingTop: 20 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: addNew ? 16 : 0 }}>
                <div onClick={() => setAddNew(!addNew)}
                  style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${addNew ? GOLD : 'rgba(201,146,46,0.3)'}`, background: addNew ? GOLD : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }}>
                  {addNew && <span style={{ color: C, fontSize: '0.7rem', fontWeight: 900 }}>✓</span>}
                </div>
                <span style={{ fontSize: '0.875rem', color: 'rgba(186,207,231,0.75)', userSelect: 'none' }}>
                  顺手补充这位 {subjectType === 'store' ? '店家' : 'ta'} 的简介，帮助其他人了解
                </span>
              </label>
              {addNew && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(201,146,46,0.12)' }}>
                  <div>
                    <label style={labelStyle}>补充介绍（可选）</label>
                    <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)}
                      placeholder="擅长风格、开本类型、特点等..." rows={2}
                      style={{ ...inputStyle, resize: 'none' }} />
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'rgba(186,207,231,0.45)' }}>
                    提交的信息将由管理员审核后决定是否收录到灵契创作者库
                  </p>
                </div>
              )}
            </div>

            <button onClick={() => setStep(2)} disabled={!canProceed}
              style={{
                padding: '13px', borderRadius: 10, border: 'none',
                cursor: canProceed ? 'pointer' : 'not-allowed',
                background: canProceed ? `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)` : 'rgba(255,255,255,0.06)',
                color: canProceed ? C : 'rgba(186,207,231,0.4)', fontWeight: 700, fontSize: '0.925rem',
              }}>
              下一步：支付上线费用 →
            </button>
          </div>
        )}

        {/* ── Step 2: 支付 ── */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,146,46,0.15)', borderRadius: 14, padding: '20px 24px' }}>
              <p style={{ fontWeight: 700, marginBottom: 8 }}>确认发布内容</p>
              <p style={{ fontSize: '0.875rem', color: 'rgba(186,207,231,0.65)' }}>
                {type === 'red' ? '🏅 红榜' : '👎 黑榜'} · <strong style={{ color: '#fff' }}>{subjectName}</strong> · {subjectCity || '未知城市'}
              </p>
              <p style={{ fontSize: '0.82rem', color: 'rgba(186,207,231,0.55)', marginTop: 8, lineHeight: 1.7 }}>
                {content.slice(0, 100)}{content.length > 100 ? '...' : ''}
              </p>
            </div>

            {/* 金额选择 */}
            <div>
              <label style={labelStyle}>初始点赞值（¥10~100）</label>
              <p style={{ fontSize: '0.8rem', color: 'rgba(186,207,231,0.55)', marginBottom: 12 }}>
                你选择的金额将作为帖子的初始点赞数，金额越高帖子越靠前
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[10, 20, 30, 50, 100].map(v => (
                  <button key={v} onClick={() => setInitialAmount(v)}
                    style={{
                      padding: '10px 20px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem',
                      border: initialAmount === v ? `2px solid ${GOLD}` : '1px solid rgba(201,146,46,0.2)',
                      background: initialAmount === v ? 'rgba(201,146,46,0.15)' : 'transparent',
                      color: initialAmount === v ? GOLD : 'rgba(186,207,231,0.6)',
                    }}>
                    ¥{v}
                  </button>
                ))}
              </div>
            </div>

            {/* 收款码 */}
            <div style={{ textAlign: 'center', padding: '24px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(201,146,46,0.25)', borderRadius: 14 }}>
              <p style={{ fontWeight: 700, marginBottom: 16, color: 'rgba(186,207,231,0.85)' }}>
                请扫码支付 <span style={{ color: GOLD, fontSize: '1.2rem' }}>¥{initialAmount}</span>
              </p>
              <div style={{ width: 180, height: 180, borderRadius: 12, border: '1px dashed rgba(201,146,46,0.3)', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                <p style={{ color: 'rgba(186,207,231,0.3)', fontSize: '0.78rem', textAlign: 'center', padding: '0 16px' }}>
                  管理员在此放置<br />微信/支付宝收款码
                </p>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'rgba(186,207,231,0.45)' }}>
                转账时请备注：灵契红黑榜 + 你的昵称
              </p>
            </div>

            {/* 支付凭证 */}
            <div>
              <label style={labelStyle}>支付凭证 <span style={{ color: '#f87171' }}>*</span></label>
              <input value={paymentProof} onChange={e => setPaymentProof(e.target.value)}
                placeholder="填写转账时间 / 备注 / 订单号，如：13:45 备注灵契红黑榜"
                style={inputStyle} />
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setStep(1)}
                style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid rgba(201,146,46,0.2)', background: 'none', color: 'rgba(186,207,231,0.65)', cursor: 'pointer', fontSize: '0.875rem' }}>
                ← 返回修改
              </button>
              <button onClick={submit} disabled={submitting || !paymentProof.trim()}
                style={{
                  flex: 2, padding: '12px', borderRadius: 10, border: 'none',
                  cursor: paymentProof.trim() && !submitting ? 'pointer' : 'not-allowed',
                  background: paymentProof.trim() ? `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)` : 'rgba(255,255,255,0.06)',
                  color: paymentProof.trim() ? C : 'rgba(186,207,231,0.4)', fontWeight: 700, fontSize: '0.925rem',
                }}>
                {submitting ? '提交中...' : '提交审核'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
