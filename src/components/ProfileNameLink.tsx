import type React from 'react';
import { Link } from 'react-router-dom';

type Props = {
  profileId?: string | null;
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
};

export default function ProfileNameLink({ profileId, children, style, className }: Props) {
  if (!profileId) return <span style={style} className={className}>{children}</span>;
  return (
    <Link
      to={`/explore/${encodeURIComponent(profileId)}`}
      style={{ color: 'inherit', fontWeight: 'inherit', textDecoration: 'none', ...style }}
      className={className}
      onClick={event => event.stopPropagation()}
    >
      {children}
    </Link>
  );
}
