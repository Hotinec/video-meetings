import { NextResponse } from 'next/server';
import { clearToken } from '@/lib/session';

export async function POST() {
  await clearToken();
  return NextResponse.json({ ok: true });
}

/** Landing point when the API rejects a stored token: drop the cookie and go to login. */
export async function GET(request: Request) {
  await clearToken();
  return NextResponse.redirect(new URL('/login', request.url));
}
