import 'server-only';
import { API_URL } from '@/lib/session';

export interface Meeting {
  id: number;
  title: string;
  date: string;
  hostId: number;
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

export class MeetingNotFoundError extends Error {}

export async function fetchMeeting(token: string, id: number): Promise<Meeting> {
  const res = await fetch(`${API_URL}/meetings/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (res.status === 401) throw new UnauthorizedError();
  if (res.status === 404) throw new MeetingNotFoundError();
  if (!res.ok) throw new Error('Failed to load meeting');
  return res.json();
}
