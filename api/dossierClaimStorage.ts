import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { SanitizedUploadImage } from './uploadSecurity.js';

export const MAX_DOSSIER_CLAIM_PROOFS = 3;

export type DossierClaimProofFile = {
  id: string;
  name: string;
  type: 'image/jpeg';
  size: number;
  width: number;
  height: number;
  relative_path: string;
};

type ClaimProofInput = {
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
  const base = path.basename(cleaned).trim();
  return base.slice(0, 120) || '身份凭证.jpg';
}

function normalizedPrivateRelativePath(value: unknown) {
  const relative = String(value || '').replace(/^\/+/, '');
  if (!relative || relative.includes('\\') || relative.length > 320) return null;
  if (!/^[a-z0-9/_\-.]+$/i.test(relative)) return null;
  const segments = relative.split('/');
  if (segments.some(segment => !segment || segment === '.' || segment === '..')) return null;
  return path.posix.normalize(relative) === relative ? relative : null;
}

function claimDirectoryRelativePath(dossierId: string, claimId: string) {
  return `dm-dossier-claims/${safeUuid(dossierId, '档案ID')}/${safeUuid(claimId, '认领申请ID')}`;
}

export function privateClaimRootFromPublicUploadRoot(publicUploadRoot: string) {
  const projectRoot = path.resolve(publicUploadRoot, '..', '..');
  return path.join(path.dirname(projectRoot), 'private-uploads', path.basename(projectRoot));
}

export function saveDossierClaimProofs(input: {
  root: string;
  dossierId: string;
  claimId: string;
  files: ClaimProofInput[];
  randomId?: () => string;
}) {
  if (input.files.length < 1 || input.files.length > MAX_DOSSIER_CLAIM_PROOFS) {
    throw new Error(`请上传1-${MAX_DOSSIER_CLAIM_PROOFS}张身份凭证截图`);
  }
  const relativeDirectory = claimDirectoryRelativePath(input.dossierId, input.claimId);
  const absoluteDirectory = path.resolve(input.root, relativeDirectory);
  const root = path.resolve(input.root);
  if (!absoluteDirectory.startsWith(`${root}${path.sep}`)) throw new Error('身份凭证目录不合法');
  fs.mkdirSync(absoluteDirectory, { recursive: true, mode: 0o700 });

  const saved: DossierClaimProofFile[] = [];
  try {
    input.files.forEach(file => {
      const rawId = input.randomId ? input.randomId() : crypto.randomUUID();
      const id = rawId.replace(/[^a-z0-9-]/gi, '') || crypto.randomUUID();
      const filename = `${id}.jpg`;
      const relativePath = `${relativeDirectory}/${filename}`;
      const absolutePath = path.join(absoluteDirectory, filename);
      fs.writeFileSync(absolutePath, file.image.buffer, { mode: 0o600, flag: 'wx' });
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
    fs.rmSync(absoluteDirectory, { recursive: true, force: true });
    throw error;
  }
}

export function readDossierClaimProof(root: string, relativePath: unknown) {
  const normalized = normalizedPrivateRelativePath(relativePath);
  if (!normalized || !normalized.startsWith('dm-dossier-claims/')) throw new Error('身份凭证路径不合法');
  const absoluteRoot = path.resolve(root);
  const absolutePath = path.resolve(absoluteRoot, normalized);
  if (!absolutePath.startsWith(`${absoluteRoot}${path.sep}`)) throw new Error('身份凭证路径不合法');
  return fs.readFileSync(absolutePath);
}

export function removeDossierClaimProofs(root: string, dossierId: string, claimId: string) {
  const relativeDirectory = claimDirectoryRelativePath(dossierId, claimId);
  const absoluteRoot = path.resolve(root);
  const absoluteDirectory = path.resolve(absoluteRoot, relativeDirectory);
  if (!absoluteDirectory.startsWith(`${absoluteRoot}${path.sep}`)) throw new Error('身份凭证目录不合法');
  fs.rmSync(absoluteDirectory, { recursive: true, force: true });
}

export function publicClaimProofMetadata(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_DOSSIER_CLAIM_PROOFS).map(item => {
    const file = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    return {
      id: String(file.id || ''),
      name: String(file.name || '身份凭证.jpg'),
      type: 'image/jpeg',
      size: Number(file.size || 0),
      width: Number(file.width || 0),
      height: Number(file.height || 0),
    };
  }).filter(file => /^[a-z0-9-]+$/i.test(file.id));
}
