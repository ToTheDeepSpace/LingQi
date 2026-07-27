export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_INPUT_PIXELS = 16_000_000;
const MAX_OUTPUT_EDGE = 2400;

const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);
const SHARP_MODULE = 'sharp';

export type SanitizedUploadImage = {
  buffer: Buffer;
  ext: 'jpg';
  contentType: 'image/jpeg';
  width: number;
  height: number;
};

type UploadedImageFile = {
  buffer: Buffer;
  mimetype: string;
};

export class UploadImageValidationError extends Error {
  readonly statusCode: 400 | 413;

  constructor(message: string, statusCode: 400 | 413 = 400) {
    super(message);
    this.name = 'UploadImageValidationError';
    this.statusCode = statusCode;
  }
}

export function uploadImageValidationStatus(error: unknown) {
  return error instanceof UploadImageValidationError ? error.statusCode : null;
}

function normalizeDeclaredType(mimetype: unknown) {
  const value = typeof mimetype === 'string' ? mimetype.toLowerCase().trim() : '';
  if (value === 'image/jpg') return 'image/jpeg';
  return value;
}

function detectImageType(buffer: Buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}

async function loadSharp() {
  const sharpModule = await import(SHARP_MODULE);
  return (sharpModule.default || sharpModule) as (
    input: Buffer,
    options?: Record<string, unknown>
  ) => {
    metadata(): Promise<{ width?: number; height?: number; pages?: number }>;
    rotate(): {
      resize(options: Record<string, unknown>): {
        flatten(options: Record<string, unknown>): {
          jpeg(options: Record<string, unknown>): {
            toBuffer(options: { resolveWithObject: true }): Promise<{ data: Buffer; info: { width: number; height: number } }>;
          };
        };
      };
    };
  };
}

export async function sanitizeUploadedImageFile(file: UploadedImageFile): Promise<SanitizedUploadImage> {
  const declaredType = normalizeDeclaredType(file.mimetype);
  if (!ALLOWED_MIME_TYPES.has(declaredType)) throw new UploadImageValidationError('请上传 png、jpg 或 webp 图片');
  if (!file.buffer.length) throw new UploadImageValidationError('图片内容为空');
  if (file.buffer.length > MAX_UPLOAD_BYTES) throw new UploadImageValidationError('图片不能超过 8MB', 413);

  const actualType = detectImageType(file.buffer);
  if (!actualType || actualType !== declaredType) throw new UploadImageValidationError('图片内容与类型不匹配');

  const sharp = await loadSharp();
  try {
    const image = sharp(file.buffer, {
      failOn: 'warning',
      limitInputPixels: MAX_INPUT_PIXELS,
    });
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height) throw new UploadImageValidationError('无法读取图片尺寸');
    if ((metadata.pages || 1) > 1) throw new UploadImageValidationError('暂不支持动图，请上传静态图片');

    const output = await image
      .rotate()
      .resize({
        width: MAX_OUTPUT_EDGE,
        height: MAX_OUTPUT_EDGE,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });

    return {
      buffer: output.data,
      ext: 'jpg',
      contentType: 'image/jpeg',
      width: output.info.width,
      height: output.info.height,
    };
  } catch (error) {
    if (error instanceof UploadImageValidationError) throw error;
    throw new UploadImageValidationError('图片文件损坏或无法处理');
  }
}
