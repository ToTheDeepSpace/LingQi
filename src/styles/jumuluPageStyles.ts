import type React from 'react';

const BLUE = '#275389';

export const jumuluPrimaryLinkStyle: React.CSSProperties = {
  minHeight: 38,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxSizing: 'border-box',
  borderRadius: 7,
  border: `1px solid ${BLUE}`,
  background: BLUE,
  color: '#fff',
  padding: '0 14px',
  textDecoration: 'none',
  fontSize: 13,
  fontWeight: 900,
  cursor: 'pointer',
};

export const jumuluSecondaryLinkStyle: React.CSSProperties = {
  ...jumuluPrimaryLinkStyle,
  borderColor: 'rgba(39,83,137,0.18)',
  background: '#fff',
  color: BLUE,
};

export const jumuluFilterPanelStyle: React.CSSProperties = {
  borderRadius: 8,
  border: '1px solid rgba(31,41,55,0.08)',
  background: '#fff',
  padding: 12,
};

export const jumuluCardStyle: React.CSSProperties = {
  borderRadius: 8,
  border: '1px solid rgba(31,41,55,0.08)',
  background: '#fff',
  boxShadow: 'none',
};
