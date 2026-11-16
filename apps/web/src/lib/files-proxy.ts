import 'server-only';
import { NextResponse } from 'next/server';
import { API_URL, getToken } from '@/lib/session';

const UNREACHABLE = { message: 'Cannot reach the server. Please try again.' };

/** Forwards a request to the API with the cookie's JWT as a Bearer token. */
export async function proxyToApi(
  path: string,
  init: RequestInit & { duplex?: 'half' } = {},
): Promise<Response> {
  const token = await getToken();
  if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    return await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json(UNREACHABLE, { status: 502 });
  }
}

/** Ids end up in an API path, so only accept plain digits. */
export const isMeetingId = (id: string) => /^\d+$/.test(id);

/** Relays an API JSON response (success or `{ message }` error) unchanged. */
export async function relayJson(res: Response): Promise<NextResponse> {
  const data = await res.json().catch(() => ({ message: 'Request failed' }));
  return NextResponse.json(data, { status: res.status });
}
