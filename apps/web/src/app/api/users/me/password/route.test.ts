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

const post = (body: string) =>
  POST(new Request('http://web.test/api/users/me/password', { method: 'POST', body }));

describe('POST /api/users/me/password', () => {
  it('returns 401 without a token cookie and does not call the API', async () => {
    getToken.mockResolvedValue(undefined);
    const res = await post('{}');
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards the JSON body with the cookie JWT and relays 204 without a body', async () => {
    getToken.mockResolvedValue('jwt-123');
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const body = '{"oldPassword":"a","newPassword":"b"}';

    const res = await post(body);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.test/users/me/password',
      expect.objectContaining({
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer jwt-123' },
      }),
    );
    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
  });

  it.each([400, 401, 404])('relays an API %i with its message', async (status) => {
    getToken.mockResolvedValue('jwt');
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ message: 'nope' }), { status }));
    const res = await post('{}');
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ message: 'nope' });
  });

  it('returns 502 when the API is unreachable', async () => {
    getToken.mockResolvedValue('jwt');
    fetchMock.mockRejectedValue(new Error('down'));
    expect((await post('{}')).status).toBe(502);
  });

  it('rejects an oversized body with 413 without calling the API', async () => {
    getToken.mockResolvedValue('jwt');
    const res = await post(JSON.stringify({ newPassword: 'x'.repeat(10_000) }));
    expect(res.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
