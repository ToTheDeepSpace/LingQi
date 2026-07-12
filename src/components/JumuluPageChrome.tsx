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
    <section className="jumulu-compact-header">
      <div className="jumulu-compact-header-copy">
        {eyebrow && <div className="jumulu-compact-header-eyebrow">{eyebrow}</div>}
        <h1 className="jumulu-compact-header-title">{title}</h1>
        <p className="jumulu-compact-header-description">{description}</p>
      </div>
      {aside && <aside className="jumulu-compact-header-actions">{aside}</aside>}
    </section>
  );
}

const pageStyle: React.CSSProperties = { minHeight: '100vh', background: '#fffdf8', color: INK };
const shellStyle: React.CSSProperties = { margin: '0 auto', background: '#fffdf8', padding: '12px clamp(12px, 2vw, 20px) 36px' };
const mainStyle: React.CSSProperties = { display: 'grid', gap: 12 };
