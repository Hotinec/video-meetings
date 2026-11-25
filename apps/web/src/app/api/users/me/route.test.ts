import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const getToken = vi.fn();
vi.mock('@/lib/session', () => ({ API_URL: 'http://api.test', getToken: () => getToken() }));

import { GET, PATCH } from './route';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  getToken.mockReset();
});

describe('GET /api/users/me', () => {
  it('returns 401 without a token cookie and does not call the API', async () => {
    getToken.mockResolvedValue(undefined);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('proxies to the API with the cookie JWT as Bearer and relays the profile', async () => {
    getToken.mockResolvedValue('jwt-123');
    const profile = { id: 1, email: 'a@b.c', username: 'alice', avatarPath: null };
    fetchMock.mockResolvedValue(new Response(JSON.stringify(profile), { status: 200 }));

    const res = await GET();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.test/users/me',
      expect.objectContaining({ headers: { Authorization: 'Bearer jwt-123' } }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(profile);
  });

  it('relays an API 401', async () => {
    getToken.mockResolvedValue('expired');
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 }),
    );
    const res = await GET();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ message: 'Unauthorized' });
  });

  it('returns 502 when the API is unreachable', async () => {
    getToken.mockResolvedValue('jwt');
    fetchMock.mockRejectedValue(new Error('down'));
    expect((await GET()).status).toBe(502);
  });
});

describe('PATCH /api/users/me', () => {
  const patch = (body: string) =>
    PATCH(new Request('http://web.test/api/users/me', { method: 'PATCH', body }));

  it('returns 401 without a token cookie and does not call the API', async () => {
    getToken.mockResolvedValue(undefined);
    const res = await patch('{"username":"bob"}');
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards the JSON body with the cookie JWT and relays the updated profile', async () => {
    getToken.mockResolvedValue('jwt-123');
    const profile = { id: 1, email: 'a@b.c', username: 'bob', avatarUrl: null };
    fetchMock.mockResolvedValue(new Response(JSON.stringify(profile), { status: 200 }));

    const res = await patch('{"username":"bob"}');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.test/users/me',
      expect.objectContaining({
        method: 'PATCH',
        body: '{"username":"bob"}',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer jwt-123' },
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(profile);
  });

  it.each([400, 409])('relays an API %i with its message', async (status) => {
    getToken.mockResolvedValue('jwt');
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ message: 'nope' }), { status }));
    const res = await patch('{"username":"x"}');
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ message: 'nope' });
  });

  it('returns 502 when the API is unreachable', async () => {
    getToken.mockResolvedValue('jwt');
    fetchMock.mockRejectedValue(new Error('down'));
    expect((await patch('{}')).status).toBe(502);
  });
});
