import fs from 'node:fs/promises';
import path from 'node:path';

const PROFILE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IMAGE_FILE_PATTERN = /\.(?:jpe?g|png|webp)$/i;
const MAX_RECOVERY_DISTANCE_MS = 30 * 24 * 60 * 60 * 1000;

export type RecoverableProviderPoster = {
  url: string;
  uploaded_at: string;
  distance_ms: number;
};

function cleanSiteUrl(siteUrl: string) {
  return siteUrl.replace(/\/+$/, '');
}

function timestampFromFilename(filename: string, fallback: number) {
  const matched = filename.match(/^(\d{13})-/);
  const parsed = matched ? Number(matched[1]) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function findRecoverableProviderPoster(input: {
  localUploadRoot: string;
  profileId: string;
  paidAt?: string | null;
  siteUrl: string;
  maxDistanceMs?: number;
}): Promise<RecoverableProviderPoster | null> {
  if (!PROFILE_ID_PATTERN.test(input.profileId)) return null;
  const root = path.resolve(input.localUploadRoot);
  const scopeRoot = path.resolve(root, 'lc-portfolio', input.profileId, 'commission-provider');
  if (!scopeRoot.startsWith(`${root}${path.sep}`)) return null;

  let dayEntries;
  try {
    dayEntries = await fs.readdir(scopeRoot, { withFileTypes: true });
  } catch {
    return null;
  }

  const paidAtMs = Date.parse(input.paidAt || '');
  const hasPaidAt = Number.isFinite(paidAtMs);
  const candidates: Array<{ filename: string; relativePath: string; timestamp: number }> = [];
  for (const dayEntry of dayEntries) {
    if (!dayEntry.isDirectory() || dayEntry.isSymbolicLink()) continue;
    const dayPath = path.join(scopeRoot, dayEntry.name);
    let files;
    try {
      files = await fs.readdir(dayPath, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const file of files) {
      if (!file.isFile() || file.isSymbolicLink() || !IMAGE_FILE_PATTERN.test(file.name)) continue;
      const absolutePath = path.join(dayPath, file.name);
      let stats;
      try {
        stats = await fs.stat(absolutePath);
      } catch {
        continue;
      }
      const timestamp = timestampFromFilename(file.name, stats.mtimeMs);
      candidates.push({
        filename: file.name,
        relativePath: path.posix.join('lc-portfolio', input.profileId, 'commission-provider', dayEntry.name, file.name),
        timestamp,
      });
    }
  }
  if (candidates.length === 0) return null;

  candidates.sort((left, right) => {
    if (!hasPaidAt) return right.timestamp - left.timestamp;
    const leftDistance = Math.abs(left.timestamp - paidAtMs);
    const rightDistance = Math.abs(right.timestamp - paidAtMs);
    return leftDistance - rightDistance || right.timestamp - left.timestamp;
  });
  const selected = candidates[0];
  const distanceMs = hasPaidAt ? Math.abs(selected.timestamp - paidAtMs) : 0;
  if (hasPaidAt && distanceMs > (input.maxDistanceMs ?? MAX_RECOVERY_DISTANCE_MS)) return null;

  return {
    url: `${cleanSiteUrl(input.siteUrl)}/uploads/${selected.relativePath}`,
    uploaded_at: new Date(selected.timestamp).toISOString(),
    distance_ms: distanceMs,
  };
}
