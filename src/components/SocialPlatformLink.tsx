import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { detectSocialPlatform, extractSharedUrl, socialPlatformLabel, type SocialPlatform } from '../lib/socialLinks';

const PLATFORM_VISUAL: Record<SocialPlatform, { glyph: string; background: string; color: string }> = {
  douyin: { glyph: '♪', background: '#151515', color: '#ffffff' },
  xiaohongshu: { glyph: '书', background: '#ff2442', color: '#ffffff' },
  weibo: { glyph: '微', background: '#e6162d', color: '#ffffff' },
  dianping: { glyph: '评', background: '#ff6633', color: '#ffffff' },
  other: { glyph: '↗', background: '#eef6ff', color: '#275389' },
};

type Props = {
  url: string;
  compact?: boolean;
  style?: CSSProperties;
};

export default function SocialPlatformLink({ url, compact = true, style }: Props) {
  const href = extractSharedUrl(url);
  if (!href) return null;
  const platform = detectSocialPlatform(href);
  const label = socialPlatformLabel(platform);
  const visual = PLATFORM_VISUAL[platform];
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={`打开${label}主页`}
      title={`${label}主页`}
      style={{
        width: compact ? 28 : 34,
        height: compact ? 28 : 34,
        flex: '0 0 auto',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 7,
        border: platform === 'other' ? '1px solid rgba(39,83,137,0.14)' : '1px solid transparent',
        background: visual.background,
        color: visual.color,
        fontSize: compact ? 13 : 15,
        fontWeight: 900,
        lineHeight: 1,
        textDecoration: 'none',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      <span aria-hidden="true">{visual.glyph}</span>
    </a>
  );
}

export function InternalProfileLink({ to, style }: { to: string; style?: CSSProperties }) {
  return (
    <Link
      to={to}
      aria-label="打开剧幕录公开主页"
      title="剧幕录公开主页"
      style={{
        width: 28,
        height: 28,
        flex: '0 0 auto',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 7,
        border: '1px solid rgba(166,106,31,0.18)',
        background: '#fffaf2',
        color: '#8a5a19',
        fontSize: 12,
        fontWeight: 900,
        lineHeight: 1,
        textDecoration: 'none',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      <span aria-hidden="true">人</span>
    </Link>
  );
}
