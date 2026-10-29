import 'server-only';
import { API_URL } from '@/lib/session';

export interface Meeting {
  id: number;
  title: string;
  date: string;
  createdAt: string;
}

export class UnauthorizedError extends Error {}

/** Meetings hosted by the token's user, newest first. */
export async function fetchMeetings(token: string): Promise<Meeting[]> {
  const res = await fetch(`${API_URL}/meetings`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (res.status === 401) throw new UnauthorizedError();
  if (!res.ok) throw new Error('Failed to load meetings');
  return res.json();
}
