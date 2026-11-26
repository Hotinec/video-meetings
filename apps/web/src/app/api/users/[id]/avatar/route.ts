import { NextResponse } from 'next/server';
import { isMeetingId, proxyToApi, relayJson } from '@/lib/files-proxy';

const PASS_THROUGH = ['content-type', 'content-length', 'x-content-type-options'];

/** Serves a user's avatar through the cookie-authenticated proxy so it works in an `<img>`. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Same rule as meeting ids: plain digits that fit the API's integer column, and not 0.
  if (!isMeetingId(id) || Number(id) < 1) {
    return NextResponse.json({ message: 'Avatar not found' }, { status: 404 });
  }

  const res = await proxyToApi(`/users/${id}/avatar`, { signal: request.signal });
  if (!res.ok) return relayJson(res);

  const headers = new Headers();
  for (const name of PASS_THROUGH) {
    const value = res.headers.get(name);
    if (value) headers.set(name, value);
  }
  // Avatars are replaced under the same URL, so make the browser revalidate.
  headers.set('cache-control', 'private, no-cache');
  return new Response(res.body, { status: 200, headers });
}
