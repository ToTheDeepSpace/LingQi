import { useEffect, useMemo, useState } from 'react';
import type React from 'react';
import { Link } from 'react-router-dom';
import { ReputationHubShell } from '../components/ReputationHubChrome';
import { JumuluCompactHeader } from '../components/JumuluPageChrome';
import { jumuluFilterPanelStyle, jumuluPrimaryLinkStyle } from '../styles/jumuluPageStyles';
import { readApiEnvelope } from '../lib/apiEnvelope';
import { flattenScriptRoles, matchesRoleSearch, roleKindLabel } from '../lib/scriptRoleCatalog';
import type { ScriptCatalogItem } from '../types';

const API = '/api';
const INK = '#1f2937';
const GOLD = '#a66a1f';
const BLUE = '#275389';
const MUTED = 'rgba(71,85,105,0.7)';

export default function Scripts() {
  const [scripts, setScripts] = useState<ScriptCatalogItem[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const response = await fetch(`${API}/lc/scripts`, { signal: controller.signal });
        const data = await readApiEnvelope<ScriptCatalogItem[]>(response, '角色评分加载失败，请稍后重试');
        setScripts(data || []);
      } catch (error) {
        if (controller.signal.aborted) return;
        setLoadError(error instanceof Error ? error.message : '角色评分加载失败');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, []);

  const ratedRoles = useMemo(() => flattenScriptRoles(scripts)
    .filter(role => Number(role.rating_count || 0) > 0)
    .sort((left, right) => {
      const countDiff = Number(right.rating_count || 0) - Number(left.rating_count || 0);
      if (countDiff) return countDiff;
      const scoreDiff = Number(right.rating_avg || 0) - Number(left.rating_avg || 0);
      if (scoreDiff) return scoreDiff;
      return `${left.script_name}${left.role_name}`.localeCompare(`${right.script_name}${right.role_name}`, 'zh-CN');
    }), [scripts]);

  const visibleRoles = useMemo(
    () => ratedRoles.filter(role => matchesRoleSearch(role, query)),
    [query, ratedRoles],
  );

  return (
    <ReputationHubShell active="roles">
      <JumuluCompactHeader
        eyebrow="沉浸式娱乐角色评分"
        title="角色点评"
        description="查看角色的综合评分和评价人数，进入角色详情可阅读全部公开评价。"
        aside={<Link to="/scripts/rate" style={jumuluPrimaryLinkStyle}>添加角色评分</Link>}
      />

      <section style={jumuluFilterPanelStyle}>
        <label style={searchLabelStyle}>
          <span style={searchCaptionStyle}>搜索角色或剧本</span>
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="例如：祝魇 / 琳琅"
            style={searchInputStyle}
          />
        </label>
      </section>

      {loading && <StatePanel>正在加载角色评分...</StatePanel>}
      {!loading && loadError && <StatePanel tone="error">{loadError}</StatePanel>}

      {!loading && !loadError && visibleRoles.length > 0 && (
        <section style={roleGridStyle} aria-label="已有角色评分">
          {visibleRoles.map(role => (
            <Link
              key={role.target_id}
              to={`/scripts/roles/${encodeURIComponent(role.target_id)}`}
              data-role-target-id={role.target_id}
              style={roleCardStyle}
            >
              <div style={{ minWidth: 0 }}>
                <span style={roleMetaStyle}>{roleKindLabel(role)}{role.gender ? ` · ${role.gender}` : ''}</span>
                <h2 style={roleNameStyle}>{role.role_name}</h2>
                <p style={scriptNameStyle}>《{role.script_name}》</p>
              </div>
              <div style={scoreBlockStyle}>
                <strong style={scoreStyle}>{Number(role.rating_avg || 0).toFixed(1)}</strong>
                <span style={starStyle}>★</span>
                <span style={countStyle}>{role.rating_count || 0} 人评分</span>
              </div>
            </Link>
          ))}
        </section>
      )}

      {!loading && !loadError && visibleRoles.length === 0 && (
        <StatePanel>
          <strong>{query.trim() ? '没有找到相符的已评分角色' : '还没有公开的角色评分'}</strong>
          <span style={{ color: MUTED, fontSize: 13 }}>可以从角色或剧本名开始搜索并提交第一条评分。</span>
          <Link to="/scripts/rate" style={emptyActionStyle}>添加角色评分</Link>
        </StatePanel>
      )}
    </ReputationHubShell>
  );
}

function StatePanel({ children, tone = 'normal' }: { children: React.ReactNode; tone?: 'normal' | 'error' }) {
  return (
    <section style={{ ...statePanelStyle, color: tone === 'error' ? '#b91c1c' : INK }}>
      {children}
    </section>
  );
}

const searchLabelStyle: React.CSSProperties = { display: 'grid', gap: 7 };
const searchCaptionStyle: React.CSSProperties = { color: '#526170', fontSize: 12, fontWeight: 900 };
const searchInputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', minHeight: 44, border: '1px solid rgba(39,83,137,0.18)', borderRadius: 7, padding: '0 13px', background: '#fff', color: INK, fontSize: 14 };
const roleGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: 10 };
const roleCardStyle: React.CSSProperties = { minHeight: 126, display: 'flex', justifyContent: 'space-between', gap: 16, padding: 14, border: '1px solid rgba(31,41,55,0.08)', borderRadius: 8, background: '#fff', color: INK, textDecoration: 'none', boxShadow: 'none' };
const roleMetaStyle: React.CSSProperties = { color: '#657383', fontSize: 11, fontWeight: 900 };
const roleNameStyle: React.CSSProperties = { margin: '7px 0 0', fontSize: 20, lineHeight: 1.2, overflowWrap: 'anywhere' };
const scriptNameStyle: React.CSSProperties = { margin: '8px 0 0', color: BLUE, fontSize: 13, lineHeight: 1.4, fontWeight: 800, overflowWrap: 'anywhere' };
const scoreBlockStyle: React.CSSProperties = { flex: '0 0 auto', minWidth: 76, display: 'grid', gridTemplateColumns: 'auto auto', alignContent: 'center', justifyContent: 'end', columnGap: 4 };
const scoreStyle: React.CSSProperties = { color: INK, fontSize: 28, lineHeight: 1 };
const starStyle: React.CSSProperties = { color: GOLD, fontSize: 18, lineHeight: 1.1 };
const countStyle: React.CSSProperties = { gridColumn: '1 / -1', marginTop: 8, color: MUTED, fontSize: 11, fontWeight: 800, textAlign: 'right' };
const statePanelStyle: React.CSSProperties = { minHeight: 160, display: 'grid', placeContent: 'center', justifyItems: 'center', gap: 10, border: '1px dashed rgba(39,83,137,0.22)', borderRadius: 8, background: '#fff', padding: 24, textAlign: 'center' };
const emptyActionStyle: React.CSSProperties = { minHeight: 38, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, padding: '0 14px', background: BLUE, color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 900 };
