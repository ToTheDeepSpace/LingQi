import { useEffect, useRef, useState } from 'react';
import type React from 'react';

type InfoTipProps = {
  children: React.ReactNode;
  label?: string;
};

type PopoverPosition = {
  top: number;
  left: number;
  width: number;
};

export default function InfoTip({ children, label = '查看说明' }: InfoTipProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<PopoverPosition | null>(null);
  const tipRef = useRef<HTMLSpanElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const updatePosition = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const viewportWidth = window.innerWidth || 360;
    const viewportHeight = window.innerHeight || 640;
    const width = Math.min(280, Math.max(220, viewportWidth - 32));
    const preferredLeft = rect.right - width;
    const left = Math.min(Math.max(16, preferredLeft), Math.max(16, viewportWidth - width - 16));
    const estimatedHeight = 180;
    const belowTop = rect.bottom + 8;
    const top = belowTop + estimatedHeight > viewportHeight - 16
      ? Math.max(16, rect.top - estimatedHeight - 8)
      : belowTop;
    setPosition({
      top,
      left,
      width,
    });
  };

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const frame = window.requestAnimationFrame(updatePosition);
    const closeTimer = window.setTimeout(() => setOpen(false), 7000);
    const closeOnOutside = (event: MouseEvent | TouchEvent) => {
      if (tipRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', closeOnOutside);
    document.addEventListener('touchstart', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(closeTimer);
      document.removeEventListener('mousedown', closeOnOutside);
      document.removeEventListener('touchstart', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  return (
    <span className="info-tip-wrap" ref={tipRef} style={wrapStyle}>
      <button
        type="button"
        ref={buttonRef}
        className="info-tip-button"
        aria-label={open ? '收起说明' : label}
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen(value => !value);
        }}
        style={buttonStyle}
      >
        ?
      </button>
      {open && (
        <span className="info-tip-popover" role="tooltip" style={{ ...popoverStyle, ...(position || {}) }}>
          {children}
        </span>
      )}
    </span>
  );
}

const wrapStyle: React.CSSProperties = {
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  verticalAlign: 'middle',
  flexShrink: 0,
};

const buttonStyle: React.CSSProperties = {
  width: 18,
  height: 18,
  borderRadius: '50%',
  border: '1px solid rgba(39,83,137,0.24)',
  background: 'rgba(239,246,255,0.86)',
  color: '#275389',
  fontSize: 11,
  fontWeight: 900,
  lineHeight: 1,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  padding: 0,
};

const popoverStyle: React.CSSProperties = {
  position: 'fixed',
  zIndex: 80,
  padding: '10px 12px',
  borderRadius: 12,
  border: '1px solid rgba(39,83,137,0.16)',
  background: '#fff',
  color: 'rgba(31,41,55,0.84)',
  boxShadow: '0 18px 42px rgba(31,41,55,0.16)',
  fontSize: '0.78rem',
  lineHeight: 1.65,
  fontWeight: 500,
  textAlign: 'left',
};
