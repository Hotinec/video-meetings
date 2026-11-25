import { NextResponse } from 'next/server';
import { isMeetingId, proxyToApi, relayJson } from '@/lib/files-proxy';

/** Only the meeting host may delete; the API answers 403 for anyone else. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  const { id, fileId } = await params;
  if (!isMeetingId(id)) return NextResponse.json({ message: 'File not found' }, { status: 404 });

  const res = await proxyToApi(`/meetings/${id}/files/${encodeURIComponent(fileId)}`, {
    method: 'DELETE',
  });
  if (res.status === 204) return new Response(null, { status: 204 });
  return relayJson(res);
}
