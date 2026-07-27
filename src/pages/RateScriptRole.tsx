import { useEffect, useMemo, useState } from 'react';
import type React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { JumuluCompactHeader } from '../components/JumuluPageChrome';
import { ReputationHubShell } from '../components/ReputationHubChrome';
import { readApiEnvelope } from '../lib/apiEnvelope';
import { readStoredCreatorAuth } from '../lib/authSession';
import { flattenScriptRoles, matchesRoleSearch, roleKindLabel } from '../lib/scriptRoleCatalog';
import type { ScriptCatalogItem } from '../types';

const API = '/api';
const INK = '#1f2937';
const GOLD = '#a66a1f';
const BLUE = '#275389';
const MUTED = 'rgba(71,85,105,0.7)';

export default function RateScriptRole() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTargetId = searchParams.get('role') || '';
  const [scripts, setScripts] = useState<ScriptCatalogItem[]>([]);
  const [query, setQuery] = useState('');
  const [selectedTargetId, setSelectedTargetId] = useState(initialTargetId);
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState('');
  const [reviewLane, setReviewLane] = useState<'experience' | 'deep_spoiler'>(
    searchParams.get('lane') === 'deep_spoiler' ? 'deep_spoiler' : 'experience',
  );
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const auth = readStoredCreatorAuth();

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${API}/lc/scripts`, { signal: controller.signal });
        const nextScripts = await readApiEnvelope<ScriptCatalogItem[]>(response, '角色资料加载失败，请稍后重试');
        setScripts(nextScripts);
        if (initialTargetId) {
          const initialRole = flattenScriptRoles(nextScripts).find(role => role.target_id === initialTargetId);
          if (initialRole) setQuery(`${initialRole.role_name} · 《${initialRole.script_name}》`);
        }
      } catch (error) {
        if (!controller.signal.aborted) setMessage({ ok: false, text: error instanceof Error ? error.message : '角色资料加载失败' });
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [initialTargetId]);

  const roles = useMemo(() => flattenScriptRoles(scripts), [scripts]);
  const selectedRole = useMemo(
    () => roles.find(role => role.target_id === selectedTargetId) || null,
    [roles, selectedTargetId],
  );

  const results = useMemo(() => {
    if (!query.trim() || selectedRole) return [];
    return roles.filter(role => matchesRoleSearch(role, query)).slice(0, 30);
  }, [query, roles, selectedRole]);

  const chooseRole = (targetId: string) => {
    const role = roles.find(item => item.target_id === targetId);
    if (!role) return;
    setSelectedTargetId(targetId);
    setQuery(`${role.role_name} · 《${role.script_name}》`);
    setMessage(null);
  };

  const submit = async () => {
    setMessage(null);
    if (!selectedRole) {
      setMessage({ ok: false, text: '请先搜索并选择要评分的角色' });
      return;
    }
    if (!content.trim()) {
      setMessage({ ok: false, text: '请写一句评分理由' });
      return;
    }
    if (!auth?.token) {
      const redirect = `/scripts/rate?role=${encodeURIComponent(selectedRole.target_id)}`;
      navigate(`/login?redirect=${encodeURIComponent(redirect)}`);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${API}/lc/entity-ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify({
          targetType: 'script_role',
          targetId: selectedRole.target_id,
          rating,
          content: content.trim(),
          reviewLane,
        }),
      });
      const data = await readApiEnvelope<{ message?: string }>(response, '评分提交失败，请稍后重试');
      setMessage({ ok: true, text: data?.message || '角色评分已提交审核，通过后会公开展示' });
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : '评分提交失败' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ReputationHubShell active="roles" currentLabel="添加角色评分">
      <JumuluCompactHeader
        eyebrow="角色点评"
        title="添加角色评分"
        description="先搜索角色或相关剧本，确认评分对象后再填写体验。"
      />

      <section style={searchSectionStyle}>
        <label style={fieldStyle}>
          <span style={labelStyle}>搜索角色 / 剧本</span>
          <input
            value={query}
            onChange={event => {
              setQuery(event.target.value);
              setSelectedTargetId('');
              setMessage(null);
            }}
            placeholder="输入角色名或剧本名"
            autoComplete="off"
            style={inputStyle}
          />
        </label>

        {loading && <p style={hintStyle}>正在加载角色资料...</p>}

        {!loading && message && !selectedRole && (
          <p style={{ ...messageStyle, color: message.ok ? '#166534' : '#b91c1c' }}>{message.text}</p>
        )}

        {!loading && results.length > 0 && (
          <div style={resultListStyle} role="listbox" aria-label="角色搜索结果">
            {results.map(role => (
              <button
                key={role.target_id}
                type="button"
                data-role-target-id={role.target_id}
                onClick={() => chooseRole(role.target_id)}
                style={resultButtonStyle}
              >
                <span>
                  <strong style={{ display: 'block', color: INK, fontSize: 16 }}>{role.role_name}</strong>
                  <small style={{ display: 'block', marginTop: 5, color: MUTED }}>{roleKindLabel(role)}{role.gender ? ` · ${role.gender}` : ''}</small>
                </span>
                <span style={{ color: BLUE, fontSize: 13, fontWeight: 850 }}>《{role.script_name}》</span>
              </button>
            ))}
          </div>
        )}

        {!loading && !message && query.trim() && !selectedRole && results.length === 0 && (
          <div style={notFoundStyle}>
            <strong>没有找到这个角色</strong>
            <span>检查角色名或剧本名，也可以先补充剧本和角色资料。</span>
            <Link to="/scripts/contribute" style={contributeLinkStyle}>补充剧本或角色</Link>
          </div>
        )}
      </section>

      {selectedRole && (
        <section style={formSectionStyle}>
          <div style={selectedRoleStyle}>
            <div>
              <span style={metaStyle}>{roleKindLabel(selectedRole)}{selectedRole.gender ? ` · ${selectedRole.gender}` : ''}</span>
              <h2 style={{ margin: '5px 0 0', fontSize: 22 }}>{selectedRole.role_name}</h2>
              <p style={{ margin: '7px 0 0', color: BLUE, fontWeight: 850 }}>《{selectedRole.script_name}》</p>
            </div>
            <button type="button" onClick={() => { setQuery(''); setSelectedTargetId(''); }} style={changeButtonStyle}>重新选择</button>
          </div>

          <fieldset style={fieldsetStyle}>
            <legend style={labelStyle}>评价栏目</legend>
            <div style={lanePickerStyle}>
              <button
                type="button"
                onClick={() => setReviewLane('experience')}
                aria-pressed={reviewLane === 'experience'}
                style={{ ...laneButtonStyle, ...(reviewLane === 'experience' ? laneButtonActiveStyle : {}) }}
              >
                <strong>无剧透体验</strong>
                <span>好不好玩、是否吃配置、适合什么玩家</span>
              </button>
              <button
                type="button"
                onClick={() => setReviewLane('deep_spoiler')}
                aria-pressed={reviewLane === 'deep_spoiler'}
                style={{ ...laneButtonStyle, ...(reviewLane === 'deep_spoiler' ? laneButtonActiveStyle : {}) }}
              >
                <strong>剧透深评</strong>
                <span>角色内核、故事动机、反转与深度体验</span>
              </button>
            </div>
          </fieldset>

          <fieldset style={fieldsetStyle}>
            <legend style={labelStyle}>综合评分</legend>
            <div style={starPickerStyle}>
              {[1, 2, 3, 4, 5].map(value => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRating(value)}
                  aria-label={`${value} 分`}
                  aria-pressed={rating === value}
                  style={{ ...starButtonStyle, color: value <= rating ? GOLD : 'rgba(148,163,184,0.42)' }}
                >
                  ★
                </button>
              ))}
              <strong style={{ color: INK }}>{rating} 分</strong>
            </div>
          </fieldset>

          <label style={fieldStyle}>
            <span style={labelStyle}>评分理由 *</span>
            <textarea
              value={content}
              onChange={event => setContent(event.target.value)}
              placeholder={reviewLane === 'deep_spoiler'
                ? '可以结合完整剧情，写下角色内核、动机、反转和深度体验。'
                : '写下这个角色好不好玩、是否吃配置，以及推荐或不推荐的原因。'}
              maxLength={1200}
              style={textareaStyle}
            />
          </label>

          <p style={laneNoticeStyle}>
            {reviewLane === 'deep_spoiler'
              ? '本栏目必须包含剧透，公开后会对未体验玩家默认遮挡。'
              : '本栏目不得包含关键剧情、角色秘密或反转信息。'}
          </p>

          {message && <p style={{ ...messageStyle, color: message.ok ? '#166534' : '#b91c1c' }}>{message.text}</p>}

          <div style={submitRowStyle}>
            {message?.ok && (
              <Link to={`/scripts/roles/${encodeURIComponent(selectedRole.target_id)}`} style={detailLinkStyle}>查看角色详情</Link>
            )}
            <button type="button" onClick={() => void submit()} disabled={submitting} style={{ ...submitButtonStyle, opacity: submitting ? 0.58 : 1 }}>
              {submitting ? '正在提交...' : '提交角色评分'}
            </button>
          </div>
        </section>
      )}
    </ReputationHubShell>
  );
}

const searchSectionStyle: React.CSSProperties = { display: 'grid', gap: 10, maxWidth: 760, padding: 16, border: '1px solid rgba(31,41,55,0.09)', borderRadius: 8, background: '#fff' };
const fieldStyle: React.CSSProperties = { display: 'grid', gap: 7 };
const labelStyle: React.CSSProperties = { color: '#526170', fontSize: 12, fontWeight: 900 };
const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', minHeight: 44, border: '1px solid rgba(39,83,137,0.2)', borderRadius: 7, padding: '0 13px', color: INK, background: '#fff', fontSize: 14 };
const resultListStyle: React.CSSProperties = { display: 'grid', borderTop: '1px solid rgba(31,41,55,0.08)' };
const resultButtonStyle: React.CSSProperties = { minHeight: 66, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 18, border: 0, borderBottom: '1px solid rgba(31,41,55,0.08)', padding: '10px 2px', background: '#fff', textAlign: 'left', cursor: 'pointer' };
const hintStyle: React.CSSProperties = { margin: 0, color: MUTED, fontSize: 13 };
const notFoundStyle: React.CSSProperties = { display: 'grid', gap: 7, padding: '14px 0 2px', color: MUTED, fontSize: 13 };
const contributeLinkStyle: React.CSSProperties = { width: 'fit-content', color: BLUE, fontWeight: 900, textDecoration: 'none' };
const formSectionStyle: React.CSSProperties = { display: 'grid', gap: 16, maxWidth: 760, padding: 16, border: '1px solid rgba(31,41,55,0.09)', borderRadius: 8, background: '#fff' };
const selectedRoleStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 18, paddingBottom: 14, borderBottom: '1px solid rgba(31,41,55,0.08)' };
const metaStyle: React.CSSProperties = { color: '#657383', fontSize: 11, fontWeight: 900 };
const changeButtonStyle: React.CSSProperties = { flex: '0 0 auto', minHeight: 34, border: '1px solid rgba(39,83,137,0.18)', borderRadius: 7, padding: '0 11px', background: '#fff', color: BLUE, fontWeight: 850, cursor: 'pointer' };
const fieldsetStyle: React.CSSProperties = { margin: 0, border: 0, padding: 0 };
const lanePickerStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 8 };
const laneButtonStyle: React.CSSProperties = { minHeight: 72, display: 'grid', gap: 5, alignContent: 'center', border: '1px solid rgba(39,83,137,0.16)', borderRadius: 7, padding: '10px 12px', background: '#fff', color: INK, textAlign: 'left', cursor: 'pointer' };
const laneButtonActiveStyle: React.CSSProperties = { borderColor: 'rgba(166,106,31,0.54)', background: '#fff8e8', color: '#7a4d14' };
const laneNoticeStyle: React.CSSProperties = { margin: 0, color: MUTED, fontSize: 12, lineHeight: 1.6 };
const starPickerStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, minHeight: 42 };
const starButtonStyle: React.CSSProperties = { width: 38, height: 38, border: 0, padding: 0, background: 'transparent', fontSize: 30, lineHeight: 1, cursor: 'pointer' };
const textareaStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', minHeight: 132, border: '1px solid rgba(39,83,137,0.2)', borderRadius: 7, padding: 12, color: INK, background: '#fff', fontSize: 14, lineHeight: 1.65, resize: 'vertical' };
const messageStyle: React.CSSProperties = { margin: 0, borderRadius: 7, padding: '10px 12px', background: '#f8fafc', fontSize: 13, fontWeight: 800 };
const submitRowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, flexWrap: 'wrap' };
const detailLinkStyle: React.CSSProperties = { color: BLUE, fontSize: 13, fontWeight: 900, textDecoration: 'none' };
const submitButtonStyle: React.CSSProperties = { minHeight: 42, border: 0, borderRadius: 7, padding: '0 18px', background: INK, color: '#fff', fontSize: 14, fontWeight: 900, cursor: 'pointer' };
