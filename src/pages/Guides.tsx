import { useCallback, useEffect, useMemo, useState } from 'react';
import type React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  JumuluCompactHeader,
  JumuluPageFrame,
} from '../components/JumuluPageChrome';
import { jumuluCardStyle, jumuluFilterPanelStyle, jumuluPrimaryLinkStyle, jumuluSecondaryLinkStyle } from '../styles/jumuluPageStyles';
import { readStoredCreatorAuth } from '../lib/authSession';

const API = '/api';
const BG = '#fffdf8';
const INK = '#1f2937';
const GOLD = '#d9a857';
const MUTED = 'rgba(71,85,105,0.76)';

type Guide = {
  id: string;
  author_name?: string | null;
  title: string;
  summary: string;
  content?: string;
  price: number;
  spoiler_level: string;
  guide_type: string;
  target_type: string;
  target_name?: string | null;
  purchase_count?: number;
  can_read_content?: boolean;
  created_at?: string;
};

const spoilerLabels: Record<string, string> = {
  none: '无剧透',
  light: '轻剧透',
  heavy: '重剧透',
  played_only: '已玩后可见',
};

const typeLabels: Record<string, string> = {
  script: '选本攻略',
  role: '角色攻略',
  city: '城市攻略',
  carpool: '成车攻略',
  photo: '出片攻略',
  store_dm: '店家 / DM 经验',
  other: '其他攻略',
};

function shortDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}

export default function Guides() {
  const navigate = useNavigate();
  const auth = useMemo(() => readStoredCreatorAuth(), []);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [selected, setSelected] = useState<Guide | null>(null);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [purchaseLoading, setPurchaseLoading] = useState(false);

  const loadGuides = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (type !== 'all') params.set('type', type);
    if (query.trim()) params.set('q', query.trim());
    try {
      const r = await fetch(`${API}/lc/guides?${params.toString()}`);
      const d = await r.json();
      if (d.success) setGuides(d.data?.items || []);
      else setMessage(d.error || '加载攻略失败');
    } catch {
      setMessage('网络错误');
    } finally {
      setLoading(false);
    }
  }, [query, type]);

  const loadDetail = async (guide: Guide) => {
    setMessage('');
    const headers = auth?.token ? { Authorization: `Bearer ${auth.token}` } : undefined;
    const r = await fetch(`${API}/lc/guides/${guide.id}`, { headers });
    const d = await r.json();
    if (!r.ok || !d.success) {
      setMessage(d.error || '打开攻略失败');
      return;
    }
    setSelected(d.data);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void loadGuides(), 0);
    return () => window.clearTimeout(timer);
  }, [loadGuides]);

  const purchaseGuide = async () => {
    if (!selected) return;
    if (!auth?.token) {
      navigate(`/login?redirect=/guides`);
      return;
    }
    setPurchaseLoading(true);
    setMessage('');
    try {
      const r = await fetch(`${API}/lc/guides/${selected.id}/purchase`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      const d = await r.json();
      if (!r.ok || !d.success) {
        setMessage(d.error || '购买失败');
        return;
      }
      await loadDetail(selected);
      await loadGuides();
    } catch {
      setMessage('网络错误');
    } finally {
      setPurchaseLoading(false);
    }
  };

  return (
    <JumuluPageFrame
      currentLabel="攻略交易"
      actions={
        <>
          <Link to="/guides/new" style={jumuluPrimaryLinkStyle}>发布攻略</Link>
          <Link to="/guides/income" style={jumuluSecondaryLinkStyle}>创作者收入</Link>
        </>
      }
    >
      <JumuluCompactHeader
        eyebrow="攻略交易"
        title="把打本经验写成攻略"
        description="选本、角色、城市路线、成车话术和出片清单，都可以沉淀为可检索、可购买的经验。"
      />
      <section style={jumuluFilterPanelStyle}>
        <div className="jumulu-guide-filters" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 170px', gap: 10 }}>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="搜索剧本、角色、城市、作者" style={inputStyle} />
          <select value={type} onChange={e => setType(e.target.value)} style={inputStyle}>
            <option value="all">全部攻略</option>
            {Object.entries(typeLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </div>
      </section>
        {message && <p style={{ color: message.includes('失败') || message.includes('错误') || message.includes('不足') ? '#b91c1c' : '#166534', marginBottom: 12 }}>{message}</p>}
        {loading ? (
          <p style={{ color: MUTED }}>加载中...</p>
        ) : guides.length === 0 ? (
          <div style={emptyStyle}>
            <h2 style={{ fontFamily: 'var(--font-serif)', marginBottom: 8 }}>还没有上架攻略</h2>
            <p style={{ color: MUTED, marginBottom: 16 }}>第一批攻略会先进入人工审核，通过后才展示。</p>
            <Link to="/guides/new" style={goldButton}>我来发布第一篇</Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
            {guides.map(guide => (
              <article key={guide.id} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                  <span style={pillStyle}>{typeLabels[guide.guide_type] || '攻略'}</span>
                  <span style={{ ...pillStyle, background: 'rgba(239,246,255,0.92)', color: '#275389' }}>{spoilerLabels[guide.spoiler_level] || '剧透提示'}</span>
                </div>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', marginBottom: 8 }}>{guide.title}</h2>
                <p style={{ color: MUTED, lineHeight: 1.7, minHeight: 72 }}>{guide.summary}</p>
                <div style={{ color: 'rgba(71,85,105,0.62)', fontSize: '0.78rem', marginBottom: 14 }}>
                  {guide.target_name || '未绑定对象'} · {guide.author_name || '匿名作者'} · {shortDate(guide.created_at)}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <strong style={{ color: '#925f18' }}>{guide.price > 0 ? `${guide.price} 契约币` : '免费'}</strong>
                  <button type="button" onClick={() => void loadDetail(guide)} style={smallButton}>查看</button>
                </div>
              </article>
            ))}
          </div>
        )}
      {selected && (
        <div style={modalBackdrop} onClick={() => setSelected(null)}>
          <div style={modalCard} onClick={e => e.stopPropagation()}>
            <button type="button" onClick={() => setSelected(null)} style={closeButton}>×</button>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              <span style={pillStyle}>{typeLabels[selected.guide_type] || '攻略'}</span>
              <span style={{ ...pillStyle, background: 'rgba(239,246,255,0.92)', color: '#275389' }}>{spoilerLabels[selected.spoiler_level] || '剧透提示'}</span>
            </div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.6rem', marginBottom: 8 }}>{selected.title}</h2>
            <p style={{ color: MUTED, lineHeight: 1.8 }}>{selected.summary}</p>
            <div style={{ color: 'rgba(71,85,105,0.64)', fontSize: '0.82rem', margin: '10px 0 18px' }}>
              作者：{selected.author_name || '匿名作者'} · 对象：{selected.target_name || '未绑定对象'} · 已购 {selected.purchase_count || 0}
            </div>
            {selected.can_read_content ? (
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.9, color: INK, background: 'rgba(255,250,242,0.82)', border: '1px solid rgba(201,146,46,0.16)', borderRadius: 14, padding: 16 }}>
                {selected.content}
              </div>
            ) : (
              <div style={{ ...emptyStyle, textAlign: 'left' }}>
                <h3 style={{ marginBottom: 8 }}>购买后解锁正文</h3>
                <p style={{ color: MUTED, lineHeight: 1.8, marginBottom: 14 }}>
                  本攻略价格为 {selected.price} 契约币。购买后可查看完整内容；礼物赞赏不是解锁条件。
                </p>
                <button type="button" onClick={() => void purchaseGuide()} disabled={purchaseLoading} style={goldButton}>
                  {purchaseLoading ? '处理中...' : selected.price > 0 ? `购买攻略 · ${selected.price} 契约币` : '免费解锁'}
                </button>
                <Link to="/wallet" style={{ ...ghostButton, marginLeft: 10 }}>查看契约币</Link>
              </div>
            )}
          </div>
        </div>
      )}
      <style>{`@media (max-width: 640px) { .jumulu-guide-filters { grid-template-columns: 1fr !important; } }`}</style>
    </JumuluPageFrame>
  );
}

const inputStyle: React.CSSProperties = {
  border: '1px solid rgba(201,146,46,0.22)',
  borderRadius: 12,
  padding: '11px 13px',
  background: 'rgba(255,255,255,0.82)',
  color: INK,
  fontSize: '0.92rem',
};

const cardStyle: React.CSSProperties = {
  ...jumuluCardStyle,
  padding: 16,
};

const emptyStyle: React.CSSProperties = {
  ...jumuluCardStyle,
  padding: 24,
  textAlign: 'center',
};

const pillStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: 999,
  padding: '5px 9px',
  background: 'rgba(217,168,87,0.16)',
  color: '#925f18',
  fontSize: '0.74rem',
  fontWeight: 900,
};

const goldButton: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '10px 16px',
  borderRadius: 7,
  border: 'none',
  background: `linear-gradient(135deg, ${GOLD}, #c9922e)`,
  color: INK,
  fontWeight: 900,
  textDecoration: 'none',
  cursor: 'pointer',
};

const ghostButton: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '10px 14px',
  borderRadius: 7,
  border: '1px solid rgba(201,146,46,0.24)',
  background: 'rgba(255,255,255,0.72)',
  color: '#925f18',
  fontWeight: 850,
  textDecoration: 'none',
  cursor: 'pointer',
};

const smallButton: React.CSSProperties = {
  ...ghostButton,
  padding: '8px 12px',
  fontSize: '0.82rem',
};

const modalBackdrop: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 80,
  background: 'rgba(15,23,42,0.42)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  padding: 14,
};

const modalCard: React.CSSProperties = {
  position: 'relative',
  width: 'min(720px, 100%)',
  maxHeight: 'calc(100svh - 28px)',
  overflowY: 'auto',
  borderRadius: 18,
  background: BG,
  padding: 22,
  boxShadow: '0 30px 90px rgba(15,23,42,0.24)',
};

const closeButton: React.CSSProperties = {
  position: 'absolute',
  top: 12,
  right: 12,
  width: 32,
  height: 32,
  borderRadius: 999,
  border: '1px solid rgba(201,146,46,0.2)',
  background: '#fff',
  color: '#925f18',
  cursor: 'pointer',
  fontSize: 20,
};
