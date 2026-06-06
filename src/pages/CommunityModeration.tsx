import { useCallback, useEffect, useState } from 'react';
import type React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { readStoredCreatorAuth } from '../lib/authSession';

const API = '/api';
const INK = '#1f2937';
const MUTED = 'rgba(71,85,105,0.76)';
const GOLD = '#a66a1f';

type ModerationDecision = 'safe' | 'hide' | 'needs_more_evidence' | 'privacy_risk' | 'legal_risk' | 'duplicate' | 'unclear';

type ModerationItem = {
  target_type: 'carpool' | 'ranking' | 'comment' | 'commission' | 'profile';
  target_id: string;
  target_title?: string | null;
  target_snapshot?: Record<string, unknown> | null;
  risk_level?: 'normal' | 'high' | 'urgent';
  auto_action?: 'none' | 'temporary_hidden' | 'queued_priority';
  auto_action_reason?: string | null;
  reasons?: string[];
  report_count?: number;
  reviewer_summary?: {
    total?: number;
    hide_votes?: number;
    safe_votes?: number;
  } | null;
  my_review?: {
    decision?: ModerationDecision;
    note?: string | null;
    created_at?: string;
    updated_at?: string;
  } | null;
  updated_at?: string;
  created_at?: string;
};

const DECISIONS: Array<{ value: ModerationDecision; label: string; helper: string; tone: string }> = [
  { value: 'safe', label: '建议保留', helper: '内容看起来可展示，暂未发现明显问题。', tone: '#15803d' },
  { value: 'hide', label: '建议隐藏', helper: '存在明显违规、攻击或不适合公开的问题。', tone: '#b91c1c' },
  { value: 'needs_more_evidence', label: '补证据', helper: '事件可能真实，但证据不足或链条不完整。', tone: '#925f18' },
  { value: 'privacy_risk', label: '隐私风险', helper: '疑似未打码、泄露联系方式或第三方信息。', tone: '#9f1239' },
  { value: 'legal_risk', label: '法律风险', helper: '疑似诈骗、威胁、造谣、人身攻击等高风险。', tone: '#7f1d1d' },
  { value: 'duplicate', label: '疑似重复', helper: '可能和已有帖子重复，需要管理员查重。', tone: '#275389' },
  { value: 'unclear', label: '看不清', helper: '材料不足，无法判断，建议管理员复核。', tone: '#475569' },
];

function getAuth() {
  const auth = readStoredCreatorAuth();
  return auth?.token ? auth : null;
}

export default function CommunityModeration() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ModerationItem[]>([]);
  const [reviewerRole, setReviewerRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submittingKey, setSubmittingKey] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});

  const loadQueue = useCallback(async () => {
    const auth = getAuth();
    if (!auth) {
      navigate('/login?redirect=/moderation');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const r = await fetch(`${API}/lc/moderation/queue`, { headers: { Authorization: `Bearer ${auth.token}` } });
      const d = await r.json();
      if (!r.ok || !d.success) {
        setError(d.error || '加载失败');
        setItems([]);
        return;
      }
      setReviewerRole(d.data?.reviewer_role || '');
      setItems(d.data?.items || []);
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadQueue(), 0);
    return () => window.clearTimeout(timer);
  }, [loadQueue]);

  const submitReview = async (item: ModerationItem, decision: ModerationDecision) => {
    const auth = getAuth();
    if (!auth) return navigate('/login?redirect=/moderation');
    const key = `${item.target_type}:${item.target_id}`;
    setSubmittingKey(`${key}:${decision}`);
    setError('');
    try {
      const r = await fetch(`${API}/lc/moderation/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify({
          targetType: item.target_type,
          targetId: item.target_id,
          decision,
          note: notes[key] || '',
          riskLabels: decision === 'privacy_risk' ? ['隐私未打码'] : decision === 'legal_risk' ? ['法律风险'] : [],
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) {
        setError(d.error || '提交失败');
        return;
      }
      await loadQueue();
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setSubmittingKey('');
    }
  };

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #fffdf8 0%, #f7fbff 100%)', color: INK, padding: '52px 20px 80px' }}>
      <div style={{ maxWidth: 1040, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 24 }}>
          <div>
            <p style={{ color: GOLD, fontWeight: 900, letterSpacing: '0.08em', fontSize: '0.78rem', marginBottom: 8 }}>社区观察员</p>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(2rem, 6vw, 3.4rem)', margin: 0, lineHeight: 1.05 }}>众审建议台</h1>
            <p style={{ color: MUTED, maxWidth: 720, lineHeight: 1.85, marginTop: 14 }}>
              众审只提交建议，不直接决定下架、恢复、封号或改判。管理员会结合举报、证据、相关方回应和平台规则做最终处理。
            </p>
          </div>
          <Link to="/rules" style={{ color: GOLD, textDecoration: 'none', fontWeight: 900, border: '1px solid rgba(166,106,31,0.22)', borderRadius: 999, padding: '9px 14px', background: '#fffdf8' }}>查看审核规则</Link>
        </div>

        {reviewerRole && (
          <div style={noticeStyle}>
            当前身份：{reviewerRole === 'admin' ? '管理员' : reviewerRole === 'founding_referrer' ? '创始推荐人' : '社区观察员'}。你的建议会进入管理员后台作为复核参考。
          </div>
        )}
        {error && <div style={{ ...noticeStyle, borderColor: 'rgba(220,38,38,0.24)', color: '#b91c1c', background: 'rgba(254,242,242,0.88)' }}>{error}</div>}

        {loading ? (
          <div style={cardStyle}>加载中...</div>
        ) : items.length === 0 ? (
          <div style={cardStyle}>
            <h2 style={{ margin: '0 0 8px', fontSize: '1.1rem' }}>暂无需要众审的内容</h2>
            <p style={{ margin: 0, color: MUTED, lineHeight: 1.8 }}>只有进入优先复核或临时折叠的举报对象会出现在这里。</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            {items.map(item => {
              const key = `${item.target_type}:${item.target_id}`;
              return (
                <article key={key} style={cardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
                    <div>
                      <p style={{ margin: '0 0 6px', color: GOLD, fontSize: '0.78rem', fontWeight: 900 }}>
                        {targetTypeLabel(item.target_type)} · {item.auto_action === 'temporary_hidden' ? '已临时折叠' : '优先复核'}
                        {item.report_count ? ` · 有效举报 ${item.report_count}` : ''}
                      </p>
                      <h2 style={{ margin: 0, fontSize: '1.15rem', lineHeight: 1.35 }}>{item.target_title || item.target_id}</h2>
                    </div>
                    <span style={{ alignSelf: 'flex-start', borderRadius: 999, padding: '5px 9px', background: riskBg(item.risk_level), color: riskColor(item.risk_level), fontSize: '0.72rem', fontWeight: 900 }}>
                      {item.risk_level === 'urgent' ? '紧急风险' : item.risk_level === 'high' ? '高风险' : '普通风险'}
                    </span>
                  </div>

                  {item.auto_action_reason && <p style={{ color: '#7c2d12', background: 'rgba(255,247,237,0.86)', borderRadius: 10, padding: '9px 10px', lineHeight: 1.75, fontSize: '0.82rem' }}>{item.auto_action_reason}</p>}
                  <div style={{ display: 'grid', gap: 8, color: MUTED, fontSize: '0.86rem', lineHeight: 1.75 }}>
                    {item.reasons && item.reasons.length > 0 && <p style={{ margin: 0 }}>举报原因：{item.reasons.join('、')}</p>}
                    {snapshotLine(item.target_snapshot)}
                    {typeof item.target_snapshot?.content_preview === 'string' && (
                      <p style={{ margin: 0, color: INK }}>内容摘录：{item.target_snapshot.content_preview}</p>
                    )}
                    {item.reviewer_summary && Number(item.reviewer_summary.total || 0) > 0 && (
                      <p style={{ margin: 0 }}>已有众审：{item.reviewer_summary.total} 条，建议隐藏 {item.reviewer_summary.hide_votes || 0}，建议保留 {item.reviewer_summary.safe_votes || 0}</p>
                    )}
                    {item.my_review && <p style={{ margin: 0, color: GOLD, fontWeight: 800 }}>你已提交：{decisionLabel(item.my_review.decision || 'unclear')}</p>}
                  </div>

                  <textarea
                    value={notes[key] || item.my_review?.note || ''}
                    onChange={e => setNotes(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder="可补充你的判断依据：证据是否足够、隐私是否打码、是否像重复举报或组织化举报。"
                    rows={3}
                    style={{ width: '100%', boxSizing: 'border-box', marginTop: 14, borderRadius: 10, border: '1px solid rgba(166,106,31,0.2)', padding: '10px 12px', resize: 'none', lineHeight: 1.7, outline: 'none', color: INK, background: '#fffdf8' }}
                  />

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                    {DECISIONS.map(decision => (
                      <button key={decision.value} onClick={() => submitReview(item, decision.value)} disabled={!!submittingKey}
                        title={decision.helper}
                        style={{
                          border: `1px solid ${decision.tone}22`,
                          color: decision.tone,
                          background: '#fffdf8',
                          borderRadius: 999,
                          padding: '8px 11px',
                          cursor: submittingKey ? 'not-allowed' : 'pointer',
                          fontWeight: 900,
                          opacity: submittingKey === `${key}:${decision.value}` ? 0.55 : 1,
                        }}>
                        {submittingKey === `${key}:${decision.value}` ? '提交中...' : decision.label}
                      </button>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

function targetTypeLabel(type: string) {
  if (type === 'ranking') return '红黑榜';
  if (type === 'comment') return '评论';
  if (type === 'carpool') return '拼车';
  if (type === 'commission') return '委托需求';
  if (type === 'profile') return '公开主页';
  return '内容';
}

function decisionLabel(value: string) {
  return DECISIONS.find(item => item.value === value)?.label || value;
}

function snapshotLine(snapshot?: Record<string, unknown> | null) {
  if (!snapshot) return null;
  const parts = [
    typeof snapshot.city === 'string' ? `城市：${snapshot.city}` : '',
    typeof snapshot.event_date === 'string' ? `日期：${snapshot.event_date}` : '',
    typeof snapshot.script_name === 'string' ? `本名：${snapshot.script_name}` : '',
    typeof snapshot.poster_name === 'string' ? `发布者：${snapshot.poster_name}` : '',
    typeof snapshot.ranking_type === 'string' ? `榜单：${snapshot.ranking_type}` : '',
  ].filter(Boolean);
  return parts.length > 0 ? <p style={{ margin: 0 }}>{parts.join(' · ')}</p> : null;
}

function riskColor(level?: string) {
  if (level === 'urgent') return '#9f1239';
  if (level === 'high') return '#b45309';
  return '#475569';
}

function riskBg(level?: string) {
  if (level === 'urgent') return 'rgba(255,241,242,0.95)';
  if (level === 'high') return 'rgba(255,247,237,0.95)';
  return 'rgba(241,245,249,0.9)';
}

const cardStyle: React.CSSProperties = {
  border: '1px solid rgba(166,106,31,0.16)',
  background: '#fffdf8',
  borderRadius: 14,
  padding: 18,
  boxShadow: '0 12px 30px rgba(102,70,30,0.07)',
};

const noticeStyle: React.CSSProperties = {
  border: '1px solid rgba(166,106,31,0.18)',
  background: 'rgba(255,253,248,0.9)',
  borderRadius: 12,
  padding: '11px 13px',
  marginBottom: 14,
  color: MUTED,
  lineHeight: 1.75,
  fontSize: '0.86rem',
};
