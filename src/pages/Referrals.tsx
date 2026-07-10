import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toDataURL } from 'qrcode';
import type React from 'react';
import { readStoredCreatorAuth } from '../lib/authSession';

const API = '/api';
const C = '#fffdf8';
const C2 = '#eef6ff';
const GOLD = '#d9a857';
const INK = '#1f2937';
const MUTED = 'rgba(71,85,105,0.76)';
const RED = '#b91c1c';

type AuthData = {
  token?: string;
  display_name?: string;
  phone?: string;
};

type ReferralItem = {
  id: string;
  status: 'registered' | 'qualified' | 'converted' | 'rejected';
  invitee: {
    id: string;
    display_name: string;
    avatar?: string | null;
  };
  invitee_bonus_awarded_at?: string | null;
  stage1_awarded_at?: string | null;
  stage2_awarded_at?: string | null;
  stage2_reason?: string | null;
  created_at: string;
};

type ReferralData = {
  referral_code: string;
  share_url: string;
  community_role?: 'community_referrer' | 'community_observer' | 'founding_referrer' | null;
  community_role_expires_at?: string | null;
  stats: {
    registered_invites: number;
    valid_invites: number;
    converted_invites: number;
    invitee_bonus_count: number;
    referrer_reward_total: number;
    next_milestone: {
      target: number;
      title: string;
      remaining: number;
    };
  };
  rules: {
    new_user_base_bonus: number;
    invitee_extra_bonus: number;
    referrer_stage1_bonus: number;
    referrer_stage2_bonus: number;
  };
  referrals: ReferralItem[];
};

function getAuth(): AuthData | null {
  const data = readStoredCreatorAuth();
  return data?.token ? data : null;
}

function formatDate(value?: string | null) {
  if (!value) return '';
  return value.slice(0, 10);
}

function roleLabel(role?: ReferralData['community_role']) {
  if (role === 'founding_referrer') return '创始推荐人 / 城市共建人';
  if (role === 'community_observer') return '社区观察员';
  if (role === 'community_referrer') return '社区推荐人';
  return '普通用户';
}

function referralStatus(item: ReferralItem) {
  if (item.stage2_awarded_at) return '已完成有效互动';
  if (item.stage1_awarded_at) return '已完成手机号验证';
  if (item.invitee_bonus_awarded_at) return '已注册';
  return item.status === 'rejected' ? '已驳回' : '等待完成';
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

export default function Referrals() {
  const navigate = useNavigate();
  const auth = useMemo(() => getAuth(), []);
  const [data, setData] = useState<ReferralData | null>(null);
  const [qrUrl, setQrUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  const load = useCallback(async () => {
    if (!auth?.token) return;
    setLoading(true);
    setError('');
    try {
      const r = await fetch(`${API}/lc/referrals/me`, { headers: { Authorization: `Bearer ${auth.token}` } });
      const d = await r.json();
      if (!r.ok || !d.success) {
        setError(d.error || '邀请信息加载失败');
        return;
      }
      setData(d.data);
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    if (!auth?.token) {
      navigate('/login');
      return;
    }
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [auth, load, navigate]);

  useEffect(() => {
    if (!data?.share_url) return;
    let alive = true;
    toDataURL(data.share_url, {
      width: 220,
      margin: 2,
      color: { dark: INK, light: '#fffdf8' },
    }).then(url => {
      if (alive) setQrUrl(url);
    }).catch(() => {
      if (alive) setQrUrl('');
    });
    return () => { alive = false; };
  }, [data?.share_url]);

  const handleCopy = async (label: string, text: string) => {
    try {
      await copyText(text);
      setCopied(label);
      window.setTimeout(() => setCopied(''), 1600);
    } catch {
      setError('复制失败，请手动选中复制');
    }
  };

  const handleNativeShare = async () => {
    if (!data?.share_url) return;
    if (!navigator.share) {
      await handleCopy('邀请链接', data.share_url);
      return;
    }
    try {
      await navigator.share({
        title: '剧幕录邀请',
        text: `来剧幕录看看，邀请码 ${data.referral_code}`,
        url: data.share_url,
      });
    } catch {
      await handleCopy('邀请链接', data.share_url);
    }
  };

  if (!auth?.token) return null;

  return (
    <div style={{ backgroundColor: C, minHeight: '100vh', color: INK }}>
      <div style={{ background: `linear-gradient(135deg, ${C2}, #fffaf2)`, borderBottom: '1px solid rgba(201,146,46,0.2)', padding: '30px 20px' }}>
        <div style={{ maxWidth: 1060, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: '1.55rem', marginBottom: 6 }}>我的邀请</h1>
            <p style={{ color: MUTED, fontSize: '0.86rem', lineHeight: 1.7, maxWidth: 620 }}>
              邀请新朋友来到剧幕录，双方都拿契约币；邀请人还会随有效邀请获得社区荣誉。
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link to="/wallet" style={ghostButtonStyle}>契约币记录</Link>
            <Link to="/dashboard" style={ghostButtonStyle}>个人后台</Link>
          </div>
        </div>
      </div>

      <main style={{ maxWidth: 1060, margin: '0 auto', padding: '28px 20px 82px' }}>
        {error && (
          <div style={{ padding: '12px 16px', borderRadius: 12, marginBottom: 18, background: 'rgba(254,242,242,0.92)', border: '1px solid rgba(220,38,38,0.24)', color: RED, fontSize: '0.84rem' }}>
            {error}
          </div>
        )}

        {loading || !data ? (
          <div style={cardStyle}>
            <p style={{ color: MUTED, fontSize: '0.9rem' }}>加载中...</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 18 }}>
            <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(240px, 0.8fr)', gap: 18 }} className="referral-hero-grid">
              <div style={{ ...cardStyle, display: 'grid', gap: 18 }}>
                <div>
                  <p style={eyebrowStyle}>专属邀请码</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: '2.25rem', fontWeight: 950, color: '#925f18', lineHeight: 1 }}>{data.referral_code}</strong>
                    <button type="button" onClick={() => handleCopy('邀请码', data.referral_code)} style={primaryButtonStyle}>
                      复制邀请码
                    </button>
                  </div>
                </div>
                <div>
                  <p style={eyebrowStyle}>邀请链接</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 10 }} className="referral-copy-row">
                    <div style={linkBoxStyle}>{data.share_url}</div>
                    <button type="button" onClick={() => handleCopy('邀请链接', data.share_url)} style={ghostButtonStyle}>复制链接</button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button type="button" onClick={handleNativeShare} style={primaryButtonStyle}>分享邀请</button>
                  {copied && <span style={{ alignSelf: 'center', color: '#15803d', fontSize: '0.82rem', fontWeight: 800 }}>{copied}已复制</span>}
                </div>
              </div>

              <div style={{ ...cardStyle, display: 'grid', justifyItems: 'center', alignContent: 'center', gap: 12 }}>
                {qrUrl ? (
                  <img src={qrUrl} alt="剧幕录邀请二维码" style={{ width: 220, maxWidth: '100%', borderRadius: 12, border: '1px solid rgba(201,146,46,0.18)', background: '#fff' }} />
                ) : (
                  <div style={{ width: 220, aspectRatio: '1 / 1', borderRadius: 12, border: '1px dashed rgba(201,146,46,0.32)', display: 'grid', placeItems: 'center', color: MUTED, fontSize: '0.84rem', textAlign: 'center', padding: 20 }}>
                    二维码生成中
                  </div>
                )}
                <p style={{ margin: 0, color: 'rgba(71,85,105,0.62)', fontSize: '0.78rem' }}>扫码进入会自动携带邀请码</p>
              </div>
            </section>

            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }} className="referral-stat-grid">
              <StatCard label="已邀请注册" value={data.stats.registered_invites} />
              <StatCard label="有效邀请" value={data.stats.valid_invites} />
              <StatCard label="完成有效互动" value={data.stats.converted_invites} />
              <StatCard label="邀请奖励合计" value={data.stats.referrer_reward_total} suffix=" 契约币" />
            </section>

            <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 18 }} className="referral-two-col">
              <div style={cardStyle}>
                <p style={eyebrowStyle}>当前身份</p>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 900, marginBottom: 8 }}>{roleLabel(data.community_role)}</h2>
                <p style={{ color: MUTED, fontSize: '0.84rem', lineHeight: 1.75 }}>
                  {data.community_role_expires_at ? `有效期至 ${formatDate(data.community_role_expires_at)}。` : '社区荣誉不会给到审核、删除、看隐私或改余额权限。'}
                </p>
                <div style={{ marginTop: 18, padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(201,146,46,0.18)', background: 'rgba(255,255,255,0.74)' }}>
                  <p style={{ margin: 0, color: '#925f18', fontSize: '0.84rem', fontWeight: 850 }}>
                    下一阶段：{data.stats.next_milestone.title}
                  </p>
                  <p style={{ margin: '6px 0 0', color: 'rgba(71,85,105,0.62)', fontSize: '0.78rem' }}>
                    {data.stats.next_milestone.remaining > 0 ? `还差 ${data.stats.next_milestone.remaining} 个有效邀请` : '已达成当前最高里程碑'}
                  </p>
                </div>
              </div>

              <div style={cardStyle}>
                <p style={eyebrowStyle}>奖励规则</p>
                <div style={{ display: 'grid', gap: 10 }}>
                  <RuleRow title="新用户注册" value={`+${data.rules.new_user_base_bonus}`} note="普通新户赠送" />
                  <RuleRow title="通过邀请注册" value={`+${data.rules.invitee_extra_bonus}`} note="被邀请人额外获得" />
                  <RuleRow title="手机号验证" value={`+${data.rules.referrer_stage1_bonus}`} note="邀请人获得" />
                  <RuleRow title="认证或有效互动" value={`+${data.rules.referrer_stage2_bonus}`} note="邀请人获得" />
                </div>
              </div>
            </section>

            <section style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
                <div>
                  <p style={eyebrowStyle}>邀请记录</p>
                  <h2 style={{ fontSize: '1.08rem', fontWeight: 900 }}>我的邀请明细</h2>
                </div>
                <span style={{ color: 'rgba(71,85,105,0.58)', fontSize: '0.78rem' }}>
                  被邀请人隐私信息不会在这里展示
                </span>
              </div>

              {data.referrals.length === 0 ? (
                <div style={{ padding: '34px 16px', borderRadius: 14, background: 'rgba(255,255,255,0.7)', border: '1px dashed rgba(201,146,46,0.22)', textAlign: 'center', color: MUTED, fontSize: '0.86rem' }}>
                  还没有邀请记录。
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {data.referrals.map(item => (
                    <div key={item.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 12, alignItems: 'center', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(201,146,46,0.14)', background: '#fff' }} className="referral-record-row">
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontWeight: 850, fontSize: '0.9rem', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.invitee.display_name}</p>
                        <p style={{ color: 'rgba(71,85,105,0.58)', fontSize: '0.76rem' }}>
                          {formatDate(item.created_at)} 注册 · {referralStatus(item)}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {item.invitee_bonus_awarded_at && <Badge>新人 +10</Badge>}
                        {item.stage1_awarded_at && <Badge>邀请人 +10</Badge>}
                        {item.stage2_awarded_at && <Badge>邀请人 +20</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      <style>{`
        @media (max-width: 820px) {
          .referral-hero-grid,
          .referral-two-col {
            grid-template-columns: 1fr !important;
          }
          .referral-stat-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }
        @media (max-width: 560px) {
          .referral-copy-row,
          .referral-record-row {
            grid-template-columns: 1fr !important;
          }
          .referral-stat-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

function StatCard({ label, value, suffix = '' }: { label: string; value: number; suffix?: string }) {
  return (
    <div style={{ ...cardStyle, padding: 18 }}>
      <p style={{ color: 'rgba(71,85,105,0.58)', fontSize: '0.76rem', marginBottom: 8, fontWeight: 750 }}>{label}</p>
      <p style={{ color: '#925f18', fontSize: '1.45rem', fontWeight: 950 }}>{value}{suffix}</p>
    </div>
  );
}

function RuleRow({ title, value, note }: { title: string; value: string; note: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 12, alignItems: 'center', padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.78)', border: '1px solid rgba(201,146,46,0.12)' }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontWeight: 850, fontSize: '0.86rem', marginBottom: 3 }}>{title}</p>
        <p style={{ color: 'rgba(71,85,105,0.58)', fontSize: '0.74rem' }}>{note}</p>
      </div>
      <strong style={{ color: '#15803d', fontSize: '0.96rem' }}>{value}</strong>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', height: 24, padding: '0 8px', borderRadius: 999, background: 'rgba(220,252,231,0.78)', border: '1px solid rgba(22,163,74,0.18)', color: '#15803d', fontSize: '0.7rem', fontWeight: 850 }}>
      {children}
    </span>
  );
}

const cardStyle: React.CSSProperties = {
  backgroundColor: '#fffaf2',
  border: '1px solid rgba(201,146,46,0.22)',
  borderRadius: 16,
  padding: 24,
  boxShadow: '0 14px 34px rgba(31,41,55,0.06)',
};

const eyebrowStyle: React.CSSProperties = {
  margin: '0 0 8px',
  color: 'rgba(71,85,105,0.58)',
  fontSize: '0.74rem',
  fontWeight: 850,
};

const primaryButtonStyle: React.CSSProperties = {
  border: 'none',
  borderRadius: 10,
  padding: '10px 14px',
  background: `linear-gradient(135deg, ${GOLD} 0%, #c9922e 100%)`,
  color: INK,
  fontWeight: 850,
  cursor: 'pointer',
  textDecoration: 'none',
  fontSize: '0.84rem',
};

const ghostButtonStyle: React.CSSProperties = {
  border: '1px solid rgba(201,146,46,0.24)',
  borderRadius: 10,
  padding: '9px 13px',
  background: 'rgba(255,255,255,0.78)',
  color: '#925f18',
  fontWeight: 800,
  cursor: 'pointer',
  textDecoration: 'none',
  fontSize: '0.82rem',
};

const linkBoxStyle: React.CSSProperties = {
  minWidth: 0,
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid rgba(201,146,46,0.18)',
  background: '#fff',
  color: 'rgba(31,41,55,0.82)',
  fontSize: '0.82rem',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};
