import { proxyToApi, relayJson } from '@/lib/files-proxy';

/** Proxies the current user's profile; the JWT stays in the httpOnly cookie. */
export async function GET() {
  return relayJson(await proxyToApi('/users/me'));
}
