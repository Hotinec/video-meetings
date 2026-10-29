import 'server-only';
import { NextResponse } from 'next/server';
import { API_URL, setToken } from '@/lib/session';

/** Forwards credentials to the API and keeps the returned JWT in an httpOnly cookie. */
export async function proxyAuth(path: 'login' | 'register', request: Request) {
  const body = await request.json().catch(() => null);

  let res: Response;
  try {
    res = await fetch(`${API_URL}/auth/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return NextResponse.json(
      { message: 'Cannot reach the server. Please try again.' },
      { status: 502 },
    );
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok || typeof data.token !== 'string') {
    return NextResponse.json(
      { message: data.message ?? 'Request failed' },
      { status: res.ok ? 502 : res.status },
    );
  }

  await setToken(data.token);
  return NextResponse.json({ ok: true });
}
