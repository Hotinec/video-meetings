import { NextResponse } from 'next/server';
import { proxyToApi, relayJson } from '@/lib/files-proxy';

/** The payload is just `{ username }`; fail fast on anything bigger. */
const MAX_BODY_BYTES = 4 * 1024;
const TOO_LARGE = { message: 'Request body too large' };

/**
 * Reads the body as text, stopping (and cancelling the stream) once it passes `max` bytes.
 * Works for chunked requests too, which have no `Content-Length` to check up front.
 * Returns null when the body is too large.
 */
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

/** Proxies the current user's profile; the JWT stays in the httpOnly cookie. */
export async function GET() {
  return relayJson(await proxyToApi('/users/me'));
}

/** Proxies a profile update (username); the API validates and returns 400/409 messages. */
export async function PATCH(request: Request) {
  const declared = Number(request.headers.get('content-length'));
  if (declared > MAX_BODY_BYTES) return NextResponse.json(TOO_LARGE, { status: 413 });

  const body = await readCapped(request, MAX_BODY_BYTES);
  if (body === null) return NextResponse.json(TOO_LARGE, { status: 413 });

  return relayJson(
    await proxyToApi('/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body,
    }),
  );
}
