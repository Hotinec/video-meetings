export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;

/**
 * Derives a username base from an email's local part. Mirrors the backfill in the
 * `add_user_username_avatar` migration — change both together.
 */
export function usernameBaseFromEmail(email: string): string {
  const local = email.split('@')[0].toLowerCase();
  return local
    .replace(/[^a-z0-9_-]/gu, '_')
    .slice(0, USERNAME_MAX_LENGTH)
    .padEnd(USERNAME_MIN_LENGTH, '_');
}

/** The n-th candidate for a base: n = 1 is the base itself, then base2, base3, ... (≤ 30 chars). */
export function usernameCandidate(base: string, n: number): string {
  if (n <= 1) return base;
  const suffix = String(n);
  return base.slice(0, USERNAME_MAX_LENGTH - suffix.length) + suffix;
}
