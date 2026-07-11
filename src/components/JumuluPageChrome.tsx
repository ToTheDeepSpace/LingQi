import type React from 'react';

const INK = '#1f2937';

type FrameProps = {
  currentLabel: string;
  navigation?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: number;
};

export function JumuluPageFrame({ currentLabel, navigation, actions, children, maxWidth = 1440 }: FrameProps) {
  const hasTools = !!(navigation || actions);
  return (
    <main style={pageStyle}>
      <section style={{ ...shellStyle, maxWidth }}>
        {hasTools && (
          <div className="jumulu-page-tools" style={toolsStyle}>
            {navigation && <nav aria-label={`${currentLabel}分区`} style={navigationStyle}>{navigation}</nav>}
            {actions && <div className="jumulu-page-actions" style={actionStyle}>{actions}</div>}
          </div>
        )}
        <div style={{ ...mainStyle, paddingTop: hasTools ? 8 : 0 }}>{children}</div>
        <style>{`
          @media (max-width: 640px) {
            .jumulu-page-actions {
              width: 100%;
              margin-left: 0 !important;
              justify-content: flex-start !important;
            }
          }
        `}</style>
      </section>
    </main>
  );
}

export function JumuluCompactHeader({ eyebrow, title, description, aside }: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <section style={headerStyle}>
      <div style={{ minWidth: 0, maxWidth: 820 }}>
        {eyebrow && <div style={eyebrowStyle}>{eyebrow}</div>}
        <h1 style={titleStyle}>{title}</h1>
        <p style={descriptionStyle}>{description}</p>
      </div>
      {aside && <aside style={asideStyle}>{aside}</aside>}
    </section>
  );
}

const pageStyle: React.CSSProperties = { minHeight: '100vh', background: '#fffdf8', color: INK };
const shellStyle: React.CSSProperties = { margin: '0 auto', background: '#fffdf8', padding: '12px clamp(12px, 2vw, 20px) 36px' };
const toolsStyle: React.CSSProperties = {
  minHeight: 38,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
};
const navigationStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' };
const actionStyle: React.CSSProperties = { marginLeft: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' };
const mainStyle: React.CSSProperties = { display: 'grid', gap: 12 };
const headerStyle: React.CSSProperties = {
  minHeight: 96,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 18,
  flexWrap: 'wrap',
  borderRadius: 8,
  border: '1px solid rgba(31,41,55,0.08)',
  background: '#fff',
  padding: '18px 20px',
};
const eyebrowStyle: React.CSSProperties = { marginBottom: 6, color: '#925f18', fontSize: 12, fontWeight: 900 };
const titleStyle: React.CSSProperties = { margin: 0, fontFamily: 'var(--font-serif)', fontSize: 'clamp(1.75rem, 3vw, 2.35rem)', lineHeight: 1.12 };
const descriptionStyle: React.CSSProperties = { margin: '8px 0 0', color: 'rgba(31,41,55,0.72)', fontSize: 14, fontWeight: 600, lineHeight: 1.65 };
const asideStyle: React.CSSProperties = { minWidth: 180, display: 'grid', gap: 8, alignContent: 'center' };
