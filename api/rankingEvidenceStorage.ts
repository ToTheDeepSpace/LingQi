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
  public_copy?: {
    url: string;
    published_at: string;
    published_by: string;
    processing_note: string;
    edit_actions: string[];
  } | null;
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
    const rawPublicCopy = file.public_copy && typeof file.public_copy === 'object'
      ? file.public_copy as Record<string, unknown>
      : null;
    const publicCopyUrl = rawPublicCopy ? String(rawPublicCopy.url || '').trim() : '';
    const publicCopy = rawPublicCopy && /^https?:\/\//i.test(publicCopyUrl)
      ? {
          url: publicCopyUrl.slice(0, 1000),
          published_at: String(rawPublicCopy.published_at || '').slice(0, 40),
          published_by: String(rawPublicCopy.published_by || '').slice(0, 80),
          processing_note: String(rawPublicCopy.processing_note || '').slice(0, 300),
          edit_actions: Array.isArray(rawPublicCopy.edit_actions)
            ? rawPublicCopy.edit_actions.map(value => String(value || '')).slice(0, 16)
            : [],
        }
      : null;
    return {
      id: String(file.id || ''),
      name: String(file.name || '审核材料.jpg'),
      type: 'image/jpeg' as const,
      size: Number(file.size || 0),
      width: Number(file.width || 0),
      height: Number(file.height || 0),
      relative_path: relativePath || '',
      public_copy: publicCopy,
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
    public_copy: file.public_copy ? {
      url: file.public_copy.url,
      published_at: file.public_copy.published_at,
    } : null,
  }));
}

export function validateRankingEvidencePublicCopy(input: {
  confirmed: boolean;
  processingNote: unknown;
  hasProcessedImage: boolean;
  publicImageCount: number;
  alreadyPublished: boolean;
  editActions: unknown;
}) {
  if (input.alreadyPublished) throw new Error('这份审核材料已经生成过公开副本');
  if (input.publicImageCount >= 6) throw new Error('正文配图最多上传6张');
  if (!input.hasProcessedImage) throw new Error('请上传完成打码或裁剪后的公开副本');
  if (!input.confirmed) throw new Error('请确认公开副本已完成隐私处理');
  const allowedActions = new Set(['裁剪', '马赛克', '模糊', '遮挡', '向左旋转', '向右旋转']);
  const editActions = Array.isArray(input.editActions)
    ? input.editActions.map(value => String(value || '').trim()).filter(value => allowedActions.has(value)).slice(0, 16)
    : [];
  if (editActions.length === 0) throw new Error('请先在前端编辑器中处理图片');
  const processingNote = String(input.processingNote || '').trim();
  if (processingNote.length < 4) throw new Error('请填写至少4个字的处理说明');
  return { processingNote: processingNote.slice(0, 300), editActions };
}
