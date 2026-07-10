import type React from 'react';

type BrandLogoProps = {
  variant?: 'compact' | 'lockup';
  className?: string;
  style?: React.CSSProperties;
};

export default function BrandLogo({ variant = 'compact', className, style }: BrandLogoProps) {
  if (variant === 'lockup') {
    return (
      <img
        src="/brand/jumulu-logo-horizontal.svg"
        alt="剧幕录，幕前有演绎，幕后有记录。"
        className={className}
        style={{ display: 'block', width: '100%', height: 'auto', ...style }}
      />
    );
  }

  return (
    <span
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#1f2937', ...style }}
    >
      <img src="/brand/jumulu-mark.svg" alt="" aria-hidden="true" style={{ width: 30, height: 30, flex: '0 0 auto' }} />
      <strong style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: '1.12rem', lineHeight: 1 }}>
        剧幕录
      </strong>
    </span>
  );
}
