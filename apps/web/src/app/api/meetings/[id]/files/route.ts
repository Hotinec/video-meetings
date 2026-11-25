import { NextResponse } from 'next/server';
import { isMeetingId, proxyToApi, relayJson } from '@/lib/files-proxy';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const { id } = await params;
  if (!isMeetingId(id)) return NextResponse.json({ message: 'Meeting not found' }, { status: 404 });
  return relayJson(await proxyToApi(`/meetings/${id}/files`));
}

/** Streams the multipart body through to the API, which does all the validation. */
export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  if (!isMeetingId(id)) return NextResponse.json({ message: 'Meeting not found' }, { status: 404 });
  return relayJson(
    await proxyToApi(`/meetings/${id}/files`, {
      method: 'POST',
      headers: { 'Content-Type': request.headers.get('content-type') ?? '' },
      body: request.body,
      duplex: 'half',
    }),
  );
}
