import { proxyToApi, relayJson } from '@/lib/files-proxy';

/** Proxies the current user's profile; the JWT stays in the httpOnly cookie. */
export async function GET() {
  return relayJson(await proxyToApi('/users/me'));
}

/** Proxies a profile update (username); the API validates and returns 400/409 messages. */
export async function PATCH(request: Request) {
  return relayJson(
    await proxyToApi('/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: await request.text(),
    }),
  );
}
