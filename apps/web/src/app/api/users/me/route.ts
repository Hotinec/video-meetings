import { NextResponse } from 'next/server';
import { proxyToApi, relayJson } from '@/lib/files-proxy';

/** The payload is just `{ username }`; fail fast on anything bigger. */
const MAX_BODY_BYTES = 4 * 1024;
const TOO_LARGE = { message: 'Request body too large' };

/** Proxies the current user's profile; the JWT stays in the httpOnly cookie. */
export async function GET() {
  return relayJson(await proxyToApi('/users/me'));
}

/** Proxies a profile update (username); the API validates and returns 400/409 messages. */
export async function PATCH(request: Request) {
  const declared = Number(request.headers.get('content-length'));
  if (declared > MAX_BODY_BYTES) return NextResponse.json(TOO_LARGE, { status: 413 });

  const body = await request.text();
  if (new TextEncoder().encode(body).length > MAX_BODY_BYTES) {
    return NextResponse.json(TOO_LARGE, { status: 413 });
  }

  return relayJson(
    await proxyToApi('/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body,
    }),
  );
}
