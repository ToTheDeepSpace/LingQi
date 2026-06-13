import { useCallback, useEffect, useState } from 'react';
import { readStoredCreatorAuth } from '../lib/authSession';

const API = '/api';

type EntityTag = {
  id: string;
  tag: string;
  likes: number;
  liked_by_me?: boolean;
};

export default function EntityTags({ targetType, targetId, compact = false }: { targetType: string; targetId: string; compact?: boolean }) {
  const [tags, setTags] = useState<EntityTag[]>([]);
  const [draft, setDraft] = useState('');
  const [message, setMessage] = useState('');
  const auth = readStoredCreatorAuth();
  const token = auth?.token || '';

  const load = useCallback(async () => {
    if (!targetId) return;
    const r = await fetch(`${API}/lc/tags?targetType=${encodeURIComponent(targetType)}&targetId=${encodeURIComponent(targetId)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    const d = await r.json();
    if (d.success) setTags(d.data || []);
  }, [targetId, targetType, token]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const addTag = async () => {
    setMessage('');
    if (!auth?.token) {
      setMessage('登录并完成手机号认证后可添加标签');
      return;
    }
    if (!draft.trim()) return;
    const r = await fetch(`${API}/lc/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify({ targetType, targetId, tag: draft.trim() }),
    });
    const d = await r.json();
    if (!r.ok || !d.success) {
      setMessage(d.error || '添加失败');
      return;
    }
    setDraft('');
    await load();
  };

  const likeTag = async (tag: EntityTag) => {
    setMessage('');
    if (!auth?.token) {
      setMessage('登录并完成手机号认证后可点赞标签');
      return;
    }
    const r = await fetch(`${API}/lc/tags/${tag.id}/like`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.token}` },
    });
    const d = await r.json();
    if (!r.ok || !d.success) {
      setMessage(d.error || '点赞失败');
      return;
    }
    await load();
  };

  return (
    <div style={{ display: 'grid', gap: compact ? 8 : 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {tags.length === 0 && <span style={{ fontSize: 12, color: 'rgba(71,85,105,0.62)' }}>暂无标签</span>}
        {tags.map(tag => (
          <button
            key={tag.id}
            type="button"
            onClick={() => void likeTag(tag)}
            style={{
              border: tag.liked_by_me ? '1px solid rgba(217,168,87,0.58)' : '1px solid rgba(148,163,184,0.22)',
              background: tag.liked_by_me ? 'rgba(217,168,87,0.14)' : 'rgba(248,250,252,0.92)',
              color: '#334155',
              borderRadius: 999,
              padding: compact ? '4px 8px' : '6px 10px',
              fontSize: compact ? 12 : 13,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            #{tag.tag} · {tag.likes || 0}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={draft}
          onChange={event => setDraft(event.target.value)}
          maxLength={24}
          placeholder="给它加个标签"
          style={{
            flex: 1,
            minWidth: 0,
            border: '1px solid rgba(148,163,184,0.28)',
            borderRadius: 10,
            padding: compact ? '7px 9px' : '9px 11px',
            fontSize: 13,
            color: '#1f2937',
            background: '#fff',
          }}
        />
        <button
          type="button"
          onClick={() => void addTag()}
          style={{
            border: 0,
            borderRadius: 10,
            padding: compact ? '7px 10px' : '9px 13px',
            background: '#1f2937',
            color: '#fff',
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          添加
        </button>
      </div>
      {message && <p style={{ margin: 0, fontSize: 12, color: '#b45309' }}>{message}</p>}
    </div>
  );
}
