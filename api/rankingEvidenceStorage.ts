import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { SanitizedUploadImage } from './uploadSecurity.js';

export const MAX_RANKING_EVIDENCE_FILES = 8;

export type RankingEvidenceFile = {
  id: string;
  name: string;
  type: 'image/jpeg';
  size: number;
  width: number;
  height: number;
  relative_path: string;
};

type RankingEvidenceInput = {
  originalName: string;
  image: SanitizedUploadImage;
};

function safeUuid(value: string, label: string) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(normalized)) {
    throw new Error(`${label}不合法`);
  }
  return normalized;
}

function safeOriginalName(value: string) {
  const cleaned = Array.from(String(value || ''))
    .filter(character => {
      const code = character.charCodeAt(0);
      return code > 31 && code !== 127;
    })
    .join('');
  return path.basename(cleaned).trim().slice(0, 120) || '审核材料.jpg';
}

function normalizedPrivateRelativePath(value: unknown) {
  const relative = String(value || '').replace(/^\/+/, '');
  if (!relative || relative.includes('\\') || relative.length > 320) return null;
  if (!/^[a-z0-9/_\-.]+$/i.test(relative)) return null;
  const segments = relative.split('/');
  if (segments.some(segment => !segment || segment === '.' || segment === '..')) return null;
  return path.posix.normalize(relative) === relative ? relative : null;
}

function evidenceDirectoryRelativePath(rankingId: string) {
  return `ranking-evidence/${safeUuid(rankingId, '榜单ID')}`;
}

export function saveRankingEvidenceFiles(input: {
  root: string;
  rankingId: string;
  files: RankingEvidenceInput[];
  existingCount?: number;
  randomId?: () => string;
}) {
  const existingCount = Math.max(0, input.existingCount || 0);
  if (input.files.length < 1 || existingCount + input.files.length > MAX_RANKING_EVIDENCE_FILES) {
    throw new Error(`审核材料最多上传${MAX_RANKING_EVIDENCE_FILES}张`);
  }
  const relativeDirectory = evidenceDirectoryRelativePath(input.rankingId);
  const absoluteDirectory = path.resolve(input.root, relativeDirectory);
  const root = path.resolve(input.root);
  if (!absoluteDirectory.startsWith(`${root}${path.sep}`)) throw new Error('审核材料目录不合法');
  fs.mkdirSync(absoluteDirectory, { recursive: true, mode: 0o700 });

  const saved: RankingEvidenceFile[] = [];
  try {
    input.files.forEach(file => {
      const rawId = input.randomId ? input.randomId() : crypto.randomUUID();
      const id = rawId.replace(/[^a-z0-9-]/gi, '') || crypto.randomUUID();
      const relativePath = `${relativeDirectory}/${id}.jpg`;
      fs.writeFileSync(path.resolve(root, relativePath), file.image.buffer, { mode: 0o600, flag: 'wx' });
      saved.push({
        id,
        name: safeOriginalName(file.originalName),
        type: 'image/jpeg',
        size: file.image.buffer.length,
        width: file.image.width,
        height: file.image.height,
        relative_path: relativePath,
      });
    });
    return saved;
  } catch (error) {
    removeRankingEvidenceFiles(input.root, saved);
    throw error;
  }
}

export function readRankingEvidenceFile(root: string, relativePath: unknown) {
  const normalized = normalizedPrivateRelativePath(relativePath);
  if (!normalized || !normalized.startsWith('ranking-evidence/')) throw new Error('审核材料路径不合法');
  const absoluteRoot = path.resolve(root);
  const absolutePath = path.resolve(absoluteRoot, normalized);
  if (!absolutePath.startsWith(`${absoluteRoot}${path.sep}`)) throw new Error('审核材料路径不合法');
  return fs.readFileSync(absolutePath);
}

export function removeRankingEvidenceFiles(root: string, files: RankingEvidenceFile[]) {
  const absoluteRoot = path.resolve(root);
  files.forEach(file => {
    const normalized = normalizedPrivateRelativePath(file.relative_path);
    if (!normalized || !normalized.startsWith('ranking-evidence/')) return;
    const absolutePath = path.resolve(absoluteRoot, normalized);
    if (absolutePath.startsWith(`${absoluteRoot}${path.sep}`)) fs.rmSync(absolutePath, { force: true });
  });
}

export function internalRankingEvidenceFiles(value: unknown): RankingEvidenceFile[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_RANKING_EVIDENCE_FILES).map(item => {
    const file = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    const relativePath = normalizedPrivateRelativePath(file.relative_path);
    return {
      id: String(file.id || ''),
      name: String(file.name || '审核材料.jpg'),
      type: 'image/jpeg' as const,
      size: Number(file.size || 0),
      width: Number(file.width || 0),
      height: Number(file.height || 0),
      relative_path: relativePath || '',
    };
  }).filter(file => /^[a-z0-9-]+$/i.test(file.id) && file.relative_path.startsWith('ranking-evidence/'));
}

export function publicRankingEvidenceMetadata(value: unknown) {
  return internalRankingEvidenceFiles(value).map(file => ({
    id: file.id,
    name: file.name,
    type: file.type,
    size: file.size,
    width: file.width,
    height: file.height,
  }));
}
