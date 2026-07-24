import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { SanitizedUploadImage } from './uploadSecurity.js';

export const MAX_MODERATION_EVIDENCE_FILES = 3;

export type ModerationEvidenceKind = 'report' | 'feedback';

export type ModerationEvidenceFile = {
  id: string;
  name: string;
  type: 'image/jpeg';
  size: number;
  width: number;
  height: number;
  relative_path: string;
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

function safeKind(value: ModerationEvidenceKind) {
  if (value !== 'report' && value !== 'feedback') throw new Error('审核材料类型不合法');
  return value;
}

function directoryRelativePath(kind: ModerationEvidenceKind, recordId: string) {
  return `moderation-evidence/${safeKind(kind)}/${safeUuid(recordId, '记录ID')}`;
}

function normalizedPrivateRelativePath(value: unknown) {
  const relative = String(value || '').replace(/^\/+/, '');
  if (!relative || relative.includes('\\') || relative.length > 320) return null;
  if (!/^[a-z0-9/_\-.]+$/i.test(relative)) return null;
  const segments = relative.split('/');
  if (segments.some(segment => !segment || segment === '.' || segment === '..')) return null;
  return path.posix.normalize(relative) === relative ? relative : null;
}

export function saveModerationEvidenceFile(input: {
  root: string;
  kind: ModerationEvidenceKind;
  recordId: string;
  originalName: string;
  image: SanitizedUploadImage;
  randomId?: () => string;
}) {
  const relativeDirectory = directoryRelativePath(input.kind, input.recordId);
  const absoluteRoot = path.resolve(input.root);
  const absoluteDirectory = path.resolve(absoluteRoot, relativeDirectory);
  if (!absoluteDirectory.startsWith(`${absoluteRoot}${path.sep}`)) throw new Error('审核材料目录不合法');
  fs.mkdirSync(absoluteDirectory, { recursive: true, mode: 0o700 });

  const rawId = input.randomId ? input.randomId() : crypto.randomUUID();
  const id = rawId.replace(/[^a-z0-9-]/gi, '') || crypto.randomUUID();
  const relativePath = `${relativeDirectory}/${id}.jpg`;
  const absolutePath = path.join(absoluteDirectory, `${id}.jpg`);
  fs.writeFileSync(absolutePath, input.image.buffer, { mode: 0o600, flag: 'wx' });
  return {
    id,
    name: safeOriginalName(input.originalName),
    type: 'image/jpeg',
    size: input.image.buffer.length,
    width: input.image.width,
    height: input.image.height,
    relative_path: relativePath,
  } satisfies ModerationEvidenceFile;
}

export function readModerationEvidenceFile(
  root: string,
  kind: ModerationEvidenceKind,
  recordId: string,
  relativePath: unknown,
) {
  const normalized = normalizedPrivateRelativePath(relativePath);
  const requiredPrefix = `${directoryRelativePath(kind, recordId)}/`;
  if (!normalized || !normalized.startsWith(requiredPrefix)) throw new Error('审核材料路径不合法');
  const absoluteRoot = path.resolve(root);
  const absolutePath = path.resolve(absoluteRoot, normalized);
  if (!absolutePath.startsWith(`${absoluteRoot}${path.sep}`)) throw new Error('审核材料路径不合法');
  return fs.readFileSync(absolutePath);
}

export function removeModerationEvidenceFile(root: string, relativePath: unknown) {
  const normalized = normalizedPrivateRelativePath(relativePath);
  if (!normalized || !normalized.startsWith('moderation-evidence/')) return;
  const absoluteRoot = path.resolve(root);
  const absolutePath = path.resolve(absoluteRoot, normalized);
  if (!absolutePath.startsWith(`${absoluteRoot}${path.sep}`)) return;
  fs.rmSync(absolutePath, { force: true });
}

export function internalModerationEvidenceFiles(value: unknown) {
  if (!Array.isArray(value)) return [] as ModerationEvidenceFile[];
  return value.filter(item => item && typeof item === 'object') as ModerationEvidenceFile[];
}

export function publicModerationEvidenceMetadata(value: unknown) {
  return internalModerationEvidenceFiles(value)
    .slice(0, MAX_MODERATION_EVIDENCE_FILES)
    .map(file => ({
      id: String(file.id || ''),
      name: String(file.name || '审核材料.jpg'),
      type: 'image/jpeg' as const,
      size: Number(file.size || 0),
      width: Number(file.width || 0),
      height: Number(file.height || 0),
    }))
    .filter(file => /^[a-z0-9-]+$/i.test(file.id));
}
