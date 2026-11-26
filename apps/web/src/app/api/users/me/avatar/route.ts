import { NextResponse } from 'next/server';
import { proxyToApi, relayJson } from '@/lib/files-proxy';

/** The API caps avatars at 5 MB; allow a little extra for the multipart envelope. */
const MAX_BODY_BYTES = 6 * 1024 * 1024;

/** Streams the multipart body through to the API, which does all the validation. */
export async function POST(request: Request) {
  const declared = Number(request.headers.get('content-length'));
  if (declared > MAX_BODY_BYTES) {
    return NextResponse.json({ message: 'Request body too large' }, { status: 413 });
  }

  return relayJson(
    await proxyToApi('/users/me/avatar', {
      method: 'POST',
      headers: { 'Content-Type': request.headers.get('content-type') ?? '' },
      body: request.body,
      duplex: 'half',
    }),
  );
}
