/** Avatar types: content-detected extension (file-type) -> MIME type. */
export const AVATAR_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export const AVATAR_ALLOWED_DESCRIPTION = 'JPEG, PNG, WebP';

export function isAllowedAvatarMime(mimeType: string): boolean {
  return Object.values(AVATAR_TYPES).includes(mimeType);
}
