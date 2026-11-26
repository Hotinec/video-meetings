import { NextResponse } from 'next/server';
import { proxyToApi, relayJson } from '@/lib/files-proxy';

/** The payload is just two passwords; fail fast on anything bigger. */
const MAX_BODY_BYTES = 4 * 1024;
const TOO_LARGE = { message: 'Request body too large' };

/** Reads the body as text, cancelling the stream past `max` bytes. Null when too large. */
async function readCapped(request: Request, max: number): Promise<string | null> {
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

/** Proxies a password change; the JWT stays in the httpOnly cookie. The API answers 204. */
export async function POST(request: Request) {
  const declared = Number(request.headers.get('content-length'));
  if (declared > MAX_BODY_BYTES) return NextResponse.json(TOO_LARGE, { status: 413 });

  const body = await readCapped(request, MAX_BODY_BYTES);
  if (body === null) return NextResponse.json(TOO_LARGE, { status: 413 });

  const res = await proxyToApi('/users/me/password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  if (res.status === 204) return new NextResponse(null, { status: 204 });
  return relayJson(res);
}
