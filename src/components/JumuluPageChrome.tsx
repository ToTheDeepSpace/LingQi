import type React from 'react';

const INK = '#1f2937';

type FrameProps = {
  currentLabel: string;
  children: React.ReactNode;
  maxWidth?: number;
};

export function JumuluPageFrame({ currentLabel, children, maxWidth = 1440 }: FrameProps) {
  return (
    <main data-page-label={currentLabel} style={pageStyle}>
      <section style={{ ...shellStyle, maxWidth }}>
        <div style={mainStyle}>{children}</div>
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
