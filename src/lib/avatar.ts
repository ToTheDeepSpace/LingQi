const AVATAR_PALETTES = [
  ['#f97316', '#fef3c7'],
  ['#0ea5e9', '#e0f2fe'],
  ['#14b8a6', '#ccfbf1'],
  ['#8b5cf6', '#ede9fe'],
  ['#ec4899', '#fce7f3'],
  ['#22c55e', '#dcfce7'],
  ['#f59e0b', '#fff7ed'],
  ['#3b82f6', '#dbeafe'],
  ['#64748b', '#f1f5f9'],
];

function hashSeed(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function avatarInitials(name?: string | null) {
  const clean = (name || '灵契师').trim();
  const chars = Array.from(clean.replace(/\s+/g, ''));
  if (chars.length === 0) return '灵';
  const first = chars[0];
  const second = chars.length > 1 && /^[A-Za-z0-9]$/.test(first) ? chars[1] : '';
  return `${first}${second}`.toUpperCase();
}

export function generatedAvatarDataUrl(name?: string | null, seed?: string | null) {
  const label = avatarInitials(name);
  const hash = hashSeed(`${seed || ''}:${name || ''}`);
  const [fg, bg] = AVATAR_PALETTES[hash % AVATAR_PALETTES.length];
  const angle = 120 + (hash % 90);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1" gradientTransform="rotate(${angle})">
          <stop offset="0%" stop-color="${bg}"/>
          <stop offset="100%" stop-color="${fg}" stop-opacity="0.28"/>
        </linearGradient>
      </defs>
      <rect width="160" height="160" rx="38" fill="url(#g)"/>
      <circle cx="${42 + (hash % 18)}" cy="${38 + (hash % 14)}" r="28" fill="${fg}" opacity="0.10"/>
      <circle cx="${110 - (hash % 16)}" cy="${116 - (hash % 18)}" r="38" fill="#ffffff" opacity="0.18"/>
      <text x="80" y="92" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif" font-size="48" font-weight="800" fill="${fg}">${escapeSvg(label)}</text>
    </svg>
  `.trim();
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function escapeSvg(input: string) {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
