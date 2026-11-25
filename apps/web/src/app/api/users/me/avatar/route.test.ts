import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const getToken = vi.fn();
vi.mock('@/lib/session', () => ({ API_URL: 'http://api.test', getToken: () => getToken() }));

import { POST } from './route';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  getToken.mockReset();
});

const upload = (headers: Record<string, string> = {}) => {
  const form = new FormData();
  form.set('file', new File([new Uint8Array([1, 2, 3])], 'a.png', { type: 'image/png' }));
  return new Request('http://web.test/api/users/me/avatar', {
    method: 'POST',
    body: form,
    headers,
  });
};

describe('POST /api/users/me/avatar', () => {
  it('returns 401 without a token cookie and does not call the API', async () => {
    getToken.mockResolvedValue(undefined);
    const res = await POST(upload());
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('streams the multipart body to the API with the cookie JWT and relays the profile', async () => {
    getToken.mockResolvedValue('jwt-123');
    const profile = { id: 1, email: 'a@b.c', username: 'alice', avatarUrl: '/users/1/avatar' };
    fetchMock.mockResolvedValue(new Response(JSON.stringify(profile), { status: 201 }));

    const req = upload();
    const contentType = req.headers.get('content-type');
    const res = await POST(req);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/users/me/avatar');
    expect(init.method).toBe('POST');
    expect(init.duplex).toBe('half');
    expect(init.body).toBeInstanceOf(ReadableStream);
    expect(init.headers).toEqual({ 'Content-Type': contentType, Authorization: 'Bearer jwt-123' });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(profile);
  });

  it('relays an API 400 with its message', async () => {
    getToken.mockResolvedValue('jwt');
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: 'File type not allowed' }), { status: 400 }),
    );
    const res = await POST(upload());
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ message: 'File type not allowed' });
  });

  it('rejects a declared oversized body with 413 without calling the API', async () => {
    getToken.mockResolvedValue('jwt');
    const res = await POST(upload({ 'content-length': String(50 * 1024 * 1024) }));
    expect(res.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 502 when the API is unreachable', async () => {
    getToken.mockResolvedValue('jwt');
    fetchMock.mockRejectedValue(new Error('down'));
    expect((await POST(upload())).status).toBe(502);
  });
});
