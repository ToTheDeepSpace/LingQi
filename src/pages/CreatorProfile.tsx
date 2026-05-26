import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { Creator, Service, Portfolio } from '../types';

const API  = '/api';
const C    = '#0b1a30';
const C2   = '#0f2239';
const GOLD = '#d9a857';

const ROLE_EMOJI: Record<string, string> = {
  creator: '🎭', coser: '⭐', photographer: '📸', makeup: '💄',
};
const ROLE_LABEL: Record<string, string> = {
  creator: '卡司/DM', coser: 'cos委托人', photographer: '摄影师', makeup: '妆造师',
};

const card: React.CSSProperties = {
  backgroundColor: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(201,146,46,0.18)',
  borderRadius: 16, padding: 24,
};

export default function CreatorProfile() {
  const { id } = useParams();
  const [creator, setCreator]     = useState<Creator | null>(null);
  const [services, setServices]   = useState<Service[]>([]);
  const [portfolio, setPortfolio] = useState<Portfolio[]>([]);
  const [availDates, setAvailDates] = useState<string[]>([]);
  const [loading, setLoading]     = useState(true);

  const [contactShown, setContactShown] = useState(false);
  const [formName, setFormName]         = useState('');
  const [formWechat, setFormWechat]     = useState('');
  const [formMsg, setFormMsg]           = useState('');
  const [contactSent, setContactSent]   = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(`${API}/lc/creators/${id}`).then(r => r.json()),
      fetch(`${API}/lc/creators/${id}/availability`).then(r => r.json()),
    ]).then(([profileData, availData]) => {
      if (profileData.success && profileData.data) {
        const { services: svc, portfolio: port, ...profile } = profileData.data;
        setCreator(profile);
        setServices(svc || []);
        setPortfolio(port || []);
      }
      if (availData.success) setAvailDates((availData.data || []).map((a: { date: string }) => a.date));
    }).finally(() => setLoading(false));
  }, [id]);

  const submitContact = async () => {
    if (!formName || !formWechat) return;
    await fetch(`${API}/lc/contact-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creatorId: id, requesterName: formName, requesterWechat: formWechat, message: formMsg }),
    });
    setContactSent(true);
  };

  const inputStyle: React.CSSProperties = {
    padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(201,146,46,0.2)',
    backgroundColor: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '0.875rem',
    outline: 'none', width: '100%', boxSizing: 'border-box',
  };

  if (loading) return (
    <div style={{ backgroundColor: C, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: '2px solid rgba(201,146,46,0.3)', borderTopColor: GOLD, borderRadius: '50%', margin: '0 auto 20px', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: 'rgba(186,207,231,0.65)' }}>加载中...</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!creator) return (
    <div style={{ backgroundColor: C, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 20, opacity: 0.3 }}>🌊</div>
        <p style={{ color: 'rgba(186,207,231,0.7)', marginBottom: 20 }}>创作者不存在</p>
        <Link to="/explore" style={{ color: GOLD, fontSize: '0.875rem', textDecoration: 'underline' }}>返回大厅</Link>
      </div>
    </div>
  );

  return (
    <div style={{ backgroundColor: C, minHeight: '100vh', color: '#fff' }}>

      {/* 顶部 Header */}
      <div style={{ backgroundColor: C2, borderBottom: '1px solid rgba(201,146,46,0.12)', padding: '32px 20px 28px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <Link to="/explore" style={{ color: 'rgba(186,207,231,0.6)', fontSize: '0.875rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 20 }}
            onMouseEnter={e => (e.currentTarget.style.color = GOLD)}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(186,207,231,0.6)')}>
            ← 返回灵契大厅
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{
              width: 80, height: 80, borderRadius: 20, flexShrink: 0,
              background: 'linear-gradient(135deg, rgba(201,146,46,0.2) 0%, rgba(201,146,46,0.1) 100%)',
              border: '2px solid rgba(201,146,46,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, overflow: 'hidden',
            }}>
              {creator.avatar
                ? <img src={creator.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : ROLE_EMOJI[creator.role_type || ''] || '🎭'
              }
            </div>
            <div>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: 'clamp(1.4rem, 3vw, 2rem)', marginBottom: 6 }}>
                {creator.display_name}
              </h1>
              <p style={{ color: 'rgba(186,207,231,0.65)', fontSize: '0.9rem' }}>
                {creator.city || '未知城市'} · {ROLE_LABEL[creator.role_type || ''] || creator.role_type}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 20px 80px' }}>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>

          {/* ── 左侧边栏 ── */}
          <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* 简介卡 */}
            <div style={card}>
              {creator.bio && (
                <p style={{ fontSize: '0.875rem', color: 'rgba(186,207,231,0.8)', lineHeight: 1.8, marginBottom: creator.tags?.length ? 16 : 0 }}>
                  {creator.bio}
                </p>
              )}
              {creator.tags && creator.tags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {creator.tags.map((t, i) => (
                    <span key={i} style={{ padding: '4px 12px', borderRadius: 999, fontSize: '0.78rem', background: 'rgba(201,146,46,0.12)', border: '1px solid rgba(201,146,46,0.28)', color: GOLD }}>
                      {t}
                    </span>
                  ))}
                </div>
              )}
              {!creator.bio && !creator.tags?.length && (
                <p style={{ color: 'rgba(186,207,231,0.45)', fontSize: '0.875rem' }}>创作者还没有填写简介</p>
              )}
            </div>

            {/* 联系卡 */}
            <div style={card}>
              <h3 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 16, color: 'rgba(186,207,231,0.9)' }}>联系创作者</h3>
              {contactShown ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <input value={formName} onChange={e => setFormName(e.target.value)} placeholder="你的称呼" style={inputStyle} />
                  <input value={formWechat} onChange={e => setFormWechat(e.target.value)} placeholder="你的微信号" style={inputStyle} />
                  <textarea value={formMsg} onChange={e => setFormMsg(e.target.value)} placeholder="想预约什么？（可选）" rows={3}
                    style={{ ...inputStyle, resize: 'none' }} />
                  <button onClick={submitContact} disabled={contactSent}
                    style={{
                      padding: '10px', borderRadius: 10, border: 'none', cursor: contactSent ? 'default' : 'pointer',
                      background: contactSent ? 'rgba(255,255,255,0.07)' : `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`,
                      color: contactSent ? 'rgba(186,207,231,0.6)' : C,
                      fontWeight: 600, fontSize: '0.875rem',
                    }}>
                    {contactSent ? '已发送 ✓ 等待回复' : '发送申请'}
                  </button>
                  {!contactSent && (
                    <p style={{ fontSize: '0.75rem', color: 'rgba(186,207,231,0.5)', textAlign: 'center' }}>
                      创作者通过后你将看到对方的微信
                    </p>
                  )}
                </div>
              ) : (
                <button onClick={() => setContactShown(true)}
                  style={{
                    width: '100%', padding: '11px', borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`,
                    color: C, fontWeight: 600, fontSize: '0.875rem',
                  }}>
                  申请联系方式
                </button>
              )}
            </div>
          </div>

          {/* ── 右侧内容 ── */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* 可接服务 */}
            {services.length > 0 && (
              <div style={card}>
                <h3 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 16, color: 'rgba(186,207,231,0.9)' }}>可接服务</h3>
                <div>
                  {services.map((s, i) => (
                    <div key={s.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0',
                      borderBottom: i < services.length - 1 ? '1px solid rgba(201,146,46,0.1)' : 'none',
                    }}>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: '0.925rem' }}>{s.service_type}</span>
                        {s.duration && <span style={{ fontSize: '0.82rem', color: 'rgba(186,207,231,0.6)', marginLeft: 8 }}>· {s.duration}</span>}
                        {s.description && <p style={{ fontSize: '0.8rem', color: 'rgba(186,207,231,0.6)', marginTop: 4 }}>{s.description}</p>}
                      </div>
                      <span style={{ fontWeight: 700, fontSize: '1.05rem', color: GOLD, marginLeft: 16, flexShrink: 0 }}>¥{s.price}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 可约日期 */}
            {availDates.length > 0 && (
              <div style={card}>
                <h3 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 16, color: 'rgba(186,207,231,0.9)' }}>可约日期</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {availDates.slice(0, 40).map(d => (
                    <span key={d} style={{ padding: '5px 12px', borderRadius: 999, fontSize: '0.8rem', background: 'rgba(201,146,46,0.1)', border: '1px solid rgba(201,146,46,0.25)', color: GOLD }}>
                      {d.slice(5)}
                    </span>
                  ))}
                  {availDates.length > 40 && (
                    <span style={{ fontSize: '0.8rem', color: 'rgba(186,207,231,0.55)', alignSelf: 'center' }}>
                      +{availDates.length - 40} 天
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* 作品集 */}
            {portfolio.length > 0 && (
              <div style={card}>
                <h3 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 16, color: 'rgba(186,207,231,0.9)' }}>作品集</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
                  {portfolio.map(p => (
                    <div key={p.id} style={{ aspectRatio: '1', borderRadius: 12, overflow: 'hidden', background: 'rgba(201,146,46,0.08)', border: '1px solid rgba(201,146,46,0.12)' }}>
                      <img src={p.image_url} alt={p.caption || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {services.length === 0 && availDates.length === 0 && portfolio.length === 0 && (
              <div style={{ ...card, textAlign: 'center', padding: '60px 24px' }}>
                <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>🌙</div>
                <p style={{ color: 'rgba(186,207,231,0.55)', fontSize: '0.9rem' }}>创作者还没有发布内容</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
