import type React from 'react';
import { Link } from 'react-router-dom';

export type ReputationHubActive = 'rankings' | 'roles' | 'city';

const INK = '#1f2937';
const BLUE = '#275389';
const GOLD = '#a66a1f';
const GOLD_LIGHT = '#fff8e8';

type ShellProps = {
  active: ReputationHubActive;
  cityTitle?: string;
  cityHref?: string;
  children: React.ReactNode;
};

export function ReputationHubShell({ active, cityTitle = '城市口碑', cityHref = '/reputation/city', children }: ShellProps) {
  return (
    <main style={pageStyle}>
      <section style={shellStyle}>
        <div style={subnavStyle}>
          <div style={subnavLeftStyle}>
            <SubnavLink active={active === 'rankings'} to="/rankings">事件榜</SubnavLink>
            <SubnavLink active={active === 'roles'} to="/scripts">角色点评</SubnavLink>
            <SubnavLink active={active === 'city'} to={cityHref}>{cityTitle}</SubnavLink>
          </div>
          <Link to={cityHref} style={cityChipStyle}>📍 {cityTitle}</Link>
        </div>
        <div style={mainStyle}>{children}</div>
      </section>
    </main>
  );
}

export function ReputationBadge({ children, tone = 'blue' }: { children: React.ReactNode; tone?: 'dark' | 'blue' | 'gold' }) {
  const style = tone === 'dark'
    ? { background: INK, color: '#fffdf8', borderColor: 'rgba(217,168,87,0.30)' }
    : tone === 'gold'
      ? { background: GOLD_LIGHT, color: GOLD, borderColor: 'rgba(217,168,87,0.28)' }
      : { background: '#eef6ff', color: BLUE, borderColor: 'rgba(39,83,137,0.18)' };
  return <span style={{ ...badgeStyle, ...style }}>{children}</span>;
}

export function ReputationButton({ to, children, tone = 'primary' }: { to: string; children: React.ReactNode; tone?: 'primary' | 'gold' | 'light' }) {
  const style = tone === 'gold'
    ? { background: '#d9a857', color: INK, borderColor: 'transparent' }
    : tone === 'light'
      ? { background: '#fff', color: BLUE, borderColor: 'rgba(39,83,137,0.18)' }
      : { background: BLUE, color: '#fff', borderColor: 'transparent' };
  return <Link to={to} style={{ ...buttonStyle, ...style }}>{children}</Link>;
}

export function ReputationStat({ value, label, tone = 'blue' }: { value: React.ReactNode; label: string; tone?: 'blue' | 'gold' | 'red' | 'green' }) {
  const colors = {
    blue: ['#eaf1ff', BLUE],
    gold: ['#fff4d8', GOLD],
    red: ['#fff0ed', '#9a3412'],
    green: ['#eaf7ef', '#1b6b4b'],
  } as const;
  const [bg, color] = colors[tone];
  return (
    <div style={{ ...statStyle, background: bg }}>
      <strong style={{ color, fontSize: 26, lineHeight: 1 }}>{value}</strong>
      <span style={{ color: 'rgba(31,41,55,0.74)', fontSize: 12, fontWeight: 800 }}>{label}</span>
    </div>
  );
}

export function ReputationPanel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <section style={{ ...panelStyle, ...style }}>{children}</section>;
}

export function ReputationAdCard() {
  return (
    <aside style={adStyle}>
      <strong style={{ color: '#d9a857', fontSize: 20 }}>广告位招租</strong>
      <p style={{ margin: 0, color: 'rgba(255,253,248,0.82)', fontSize: 13, lineHeight: 1.55 }}>
        城市店家、活动、展会或品牌合作都可以放在这里，并明确标注推广。
      </p>
      <ReputationButton to="/contact" tone="gold">联系投放</ReputationButton>
    </aside>
  );
}

function SubnavLink({ active, to, children }: { active: boolean; to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      style={{
        ...subnavItemStyle,
        background: active ? BLUE : '#fff',
        color: active ? '#fff' : BLUE,
        borderColor: active ? BLUE : 'rgba(39,83,137,0.16)',
      }}
    >
      {children}
    </Link>
  );
}

const pageStyle: React.CSSProperties = { minHeight: '100vh', background: '#fffdf8', color: INK };
const shellStyle: React.CSSProperties = { maxWidth: 1440, margin: '0 auto', background: '#fffdf8' };
const subnavStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px clamp(14px, 3vw, 26px) 0', flexWrap: 'wrap' };
const subnavLeftStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' };
const subnavItemStyle: React.CSSProperties = { minHeight: 34, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, border: '1px solid', padding: '0 12px', textDecoration: 'none', fontSize: 12, fontWeight: 900 };
const cityChipStyle: React.CSSProperties = { minHeight: 36, display: 'inline-flex', alignItems: 'center', borderRadius: 999, border: '1px solid rgba(166,106,31,0.14)', padding: '0 12px', background: '#fff', color: '#8a5a19', textDecoration: 'none', fontSize: 12, fontWeight: 900 };
const mainStyle: React.CSSProperties = { padding: 'clamp(14px, 3vw, 26px)', display: 'grid', gap: 18 };
const badgeStyle: React.CSSProperties = { width: 'fit-content', display: 'inline-flex', alignItems: 'center', borderRadius: 999, border: '1px solid', padding: '8px 12px', fontSize: 12, fontWeight: 900, lineHeight: 1 };
const buttonStyle: React.CSSProperties = { minHeight: 42, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: '1px solid', padding: '0 16px', textDecoration: 'none', fontSize: 13, fontWeight: 900 };
const statStyle: React.CSSProperties = { minHeight: 94, borderRadius: 10, border: '1px solid rgba(31,41,55,0.06)', padding: 16, display: 'grid', alignContent: 'start', gap: 7 };
const panelStyle: React.CSSProperties = { borderRadius: 14, border: '1px solid rgba(31,41,55,0.08)', background: '#fff', boxShadow: '0 12px 32px rgba(31,41,55,0.06)', padding: 18 };
const adStyle: React.CSSProperties = { width: 'min(100%, 380px)', borderRadius: 12, border: '1px solid rgba(217,168,87,0.30)', background: INK, padding: 18, display: 'grid', gap: 10, alignContent: 'start' };
