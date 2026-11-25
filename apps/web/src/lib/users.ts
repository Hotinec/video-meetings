import 'server-only';
import { UnauthorizedError } from '@/lib/meetings';
import { API_URL } from '@/lib/session';

export interface Profile {
  id: number;
  email: string;
  username: string;
  avatarUrl: string | null;
}

/** The token's user profile, straight from the API (not decoded from the JWT). */
export async function fetchProfile(token: string): Promise<Profile> {
  const res = await fetch(`${API_URL}/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (res.status === 401) throw new UnauthorizedError();
  if (!res.ok) throw new Error('Failed to load profile');
  return res.json();
}

/** Up to two uppercase letters: first letters of the `_`/`-` separated parts, else the first two characters. */
export function initialsOf(username: string): string {
  const parts = username.split(/[_-]+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}
