export const MAX_IMAGE_UPLOAD_BYTES = 8 * 1024 * 1024;
export const MAX_MULTIPART_UPLOAD_BYTES = 18 * 1024 * 1024;

export function totalFileBytes(files: ArrayLike<{ size: number }> | Iterable<{ size: number }>) {
  return Array.from(files).reduce((total, file) => total + Math.max(0, Number(file.size) || 0), 0);
}
