import { useState } from 'react';
import type React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ProfileNameLink from './ProfileNameLink';
import ReportFlagButton from './ReportFlagButton';

const API = '/api';
const INK = '#1f2937';
const MUTED = 'rgba(71,85,105,0.72)';

export type RatingReaction = {
  likes: number;
  dislikes: number;
  my_vote?: 'like' | 'dislike' | null;
};

export type RatingDiscussionNode = {
  id: string;
  content: string;
  profile_id?: string | null;
  profile_name: string;
  created_at?: string | null;
  reaction: RatingReaction;
};

export type RatingOfficialResponse = RatingDiscussionNode & {
  reviewer_followup?: RatingDiscussionNode | null;
};

type Props = {
  ratingType: 'dm' | 'store';
  ratingId: string;
  token?: string;
  reaction: RatingReaction;
  officialResponse?: RatingOfficialResponse | null;
  canOfficialRespond: boolean;
  canFollowUp: boolean;
};

export default function RatingDiscussion({
  ratingType,
  ratingId,
  token,
  reaction,
  officialResponse,
  canOfficialRespond,
  canFollowUp,
}: Props) {
  const [composer, setComposer] = useState<'official-response' | 'follow-up' | null>(null);
  const [submitted, setSubmitted] = useState<'official-response' | 'follow-up' | null>(null);

  return (
    <div style={{ marginTop: 10 }}>
      <ReactionBar targetType={ratingType === 'dm' ? 'dm_rating' : 'store_rating'} targetId={ratingId} token={token} initial={reaction} />
      {officialResponse && (
        <div style={officialStyle}>
          <NodeHeader label={ratingType === 'dm' ? 'DM 回应' : '店家回应'} node={officialResponse} />
          <p style={nodeContentStyle}>{officialResponse.content}</p>
          <ReactionBar targetType="discussion_node" targetId={officialResponse.id} token={token} initial={officialResponse.reaction} />
          {officialResponse.reviewer_followup && (
            <div style={followupStyle}>
              <NodeHeader label="评价人补充" node={officialResponse.reviewer_followup} />
              <p style={nodeContentStyle}>{officialResponse.reviewer_followup.content}</p>
              <ReactionBar targetType="discussion_node" targetId={officialResponse.reviewer_followup.id} token={token} initial={officialResponse.reviewer_followup.reaction} />
            </div>
          )}
        </div>
      )}
      {submitted && <p style={successStyle}>已提交审核，通过后会公开显示。</p>}
      {!submitted && canOfficialRespond && !officialResponse && (
        <ComposerEntry label={ratingType === 'dm' ? '回应这条评价' : '代表店家回应'} active={composer === 'official-response'} onOpen={() => setComposer('official-response')}>
          <ResponseComposer token={token} endpoint={`${API}/lc/rating-discussions/${ratingType}/${ratingId}/official-response`} onDone={() => { setSubmitted('official-response'); setComposer(null); }} />
        </ComposerEntry>
      )}
      {!submitted && canFollowUp && officialResponse && !officialResponse.reviewer_followup && (
        <ComposerEntry label="补充回应" active={composer === 'follow-up'} onOpen={() => setComposer('follow-up')}>
          <ResponseComposer token={token} endpoint={`${API}/lc/rating-discussions/${ratingType}/${ratingId}/follow-up`} onDone={() => { setSubmitted('follow-up'); setComposer(null); }} />
        </ComposerEntry>
      )}
    </div>
  );
}

function NodeHeader({ label, node }: { label: string; node: RatingDiscussionNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
      <strong style={{ color: INK, fontSize: 13 }}>{label} · <ProfileNameLink profileId={node.profile_id}>{node.profile_name}</ProfileNameLink></strong>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {node.created_at && <span style={{ color: MUTED, fontSize: 12 }}>{node.created_at.slice(0, 10)}</span>}
        <ReportFlagButton targetType="rating_reply" targetId={node.id} targetTitle={label} ownerId={node.profile_id} />
      </div>
    </div>
  );
}

function ReactionBar({ targetType, targetId, token, initial }: {
  targetType: 'dm_rating' | 'store_rating' | 'discussion_node';
  targetId: string;
  token?: string;
  initial: RatingReaction;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [reaction, setReaction] = useState(initial || { likes: 0, dislikes: 0, my_vote: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function vote(voteType: 'like' | 'dislike') {
    if (!token) {
      navigate(`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${API}/lc/rating-reactions/${targetType}/${targetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ voteType }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || '操作失败');
      setReaction(body.data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '操作失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 9, minHeight: 28 }}>
      <button type="button" disabled={busy} onClick={() => vote('like')} style={reactionButtonStyle(reaction.my_vote === 'like')}>赞 {reaction.likes || 0}</button>
      <button type="button" disabled={busy} onClick={() => vote('dislike')} style={reactionButtonStyle(reaction.my_vote === 'dislike')}>踩 {reaction.dislikes || 0}</button>
      {error && <span style={{ color: '#b91c1c', fontSize: 12 }}>{error}</span>}
    </div>
  );
}

function ComposerEntry({ label, active, onOpen, children }: { label: string; active: boolean; onOpen: () => void; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 9 }}>
      {!active && <button type="button" onClick={onOpen} style={textButtonStyle}>{label}</button>}
      {active && children}
    </div>
  );
}

function ResponseComposer({ token, endpoint, onDone }: { token?: string; endpoint: string; onDone: () => void }) {
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
        body: JSON.stringify({ content }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || '提交失败');
      onDone();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '提交失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 7 }}>
      <textarea value={content} onChange={event => setContent(event.target.value)} maxLength={1000} rows={3} placeholder="写下回应内容" style={textareaStyle} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="submit" disabled={busy || content.trim().length < 4} style={submitButtonStyle}>{busy ? '提交中…' : '提交审核'}</button>
        {error && <span style={{ color: '#b91c1c', fontSize: 12 }}>{error}</span>}
      </div>
    </form>
  );
}

const officialStyle: React.CSSProperties = { marginTop: 12, marginLeft: 10, padding: '11px 12px', borderLeft: '3px solid rgba(166,106,31,0.35)', background: 'rgba(166,106,31,0.045)' };
const followupStyle: React.CSSProperties = { marginTop: 10, padding: '10px 11px', borderLeft: '2px solid rgba(39,83,137,0.25)', background: 'rgba(255,255,255,0.72)' };
const nodeContentStyle: React.CSSProperties = { margin: '7px 0 0', color: INK, fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap' };
const successStyle: React.CSSProperties = { margin: '8px 0 0', color: '#15803d', fontSize: 12, fontWeight: 700 };
const textButtonStyle: React.CSSProperties = { border: 0, padding: 0, background: 'transparent', color: '#275389', fontSize: 12, fontWeight: 800, cursor: 'pointer' };
const textareaStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', resize: 'vertical', border: '1px solid rgba(71,85,105,0.22)', borderRadius: 6, padding: '9px 10px', color: INK, background: '#fff', font: 'inherit', lineHeight: 1.55 };
const submitButtonStyle: React.CSSProperties = { border: 0, borderRadius: 6, padding: '7px 12px', background: '#275389', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer' };
const reactionButtonStyle = (active: boolean): React.CSSProperties => ({ border: `1px solid ${active ? 'rgba(39,83,137,0.45)' : 'rgba(71,85,105,0.18)'}`, borderRadius: 6, padding: '4px 8px', background: active ? 'rgba(39,83,137,0.10)' : '#fff', color: active ? '#275389' : MUTED, fontSize: 12, fontWeight: 700, cursor: 'pointer' });
