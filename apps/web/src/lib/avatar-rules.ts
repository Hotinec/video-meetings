/** Mirrors the API's avatar rules (JPEG, PNG, WebP up to 5 MB); the server stays the authority. */
export const AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
export const AVATAR_ACCEPT = AVATAR_MIME_TYPES.join(',');

/** Returns a user-facing message if the image can't be uploaded, otherwise null. */
export function validateAvatar(file: { type: string; size: number }): string | null {
  if (!(AVATAR_MIME_TYPES as readonly string[]).includes(file.type)) {
    return 'File type not allowed. Allowed types: JPEG, PNG, WebP';
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return `File is too large. Maximum size is ${MAX_AVATAR_BYTES / (1024 * 1024)} MB`;
  }
  return null;
}
