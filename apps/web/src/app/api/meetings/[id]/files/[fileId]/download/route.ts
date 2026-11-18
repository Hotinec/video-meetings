import { NextResponse } from 'next/server';
import { isMeetingId, proxyToApi, relayJson } from '@/lib/files-proxy';

const PASS_THROUGH = [
  'content-type',
  'content-length',
  'content-disposition',
  'x-content-type-options',
];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  const { id, fileId } = await params;
  if (!isMeetingId(id)) return NextResponse.json({ message: 'File not found' }, { status: 404 });

  const res = await proxyToApi(`/meetings/${id}/files/${encodeURIComponent(fileId)}/download`, {
    signal: request.signal, // stop reading from the API when the client cancels
  });
  if (!res.ok) return relayJson(res);

  const headers = new Headers();
  for (const name of PASS_THROUGH) {
    const value = res.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(res.body, { status: 200, headers });
}
