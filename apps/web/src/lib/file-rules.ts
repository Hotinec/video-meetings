/** Mirrors the API's allowlist and default cap; the server stays the authority. */
export const ALLOWED_EXTENSIONS = [
  'mp4',
  'mov',
  'webm',
  'mp3',
  'm4a',
  'wav',
  'pdf',
  'docx',
  'xlsx',
  'pptx',
  'txt',
] as const;

export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

export const ACCEPT = ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(',');

export const extensionOf = (name: string): string => {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
};

/** Returns a user-facing message if the file can't be uploaded, otherwise null. */
export function validateFile(file: { name: string; size: number }): string | null {
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(extensionOf(file.name))) {
    return `File type not allowed. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `File is too large. Maximum size is ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB`;
  }
  return null;
}
