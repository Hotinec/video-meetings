import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const getToken = vi.fn();
vi.mock('@/lib/session', () => ({ API_URL: 'http://api.test', getToken: () => getToken() }));

import { GET } from './route';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  getToken.mockReset();
});

const get = (id: string) =>
  GET(new Request(`http://web.test/api/users/${id}/avatar`), {
    params: Promise.resolve({ id }),
  });

describe('GET /api/users/:id/avatar', () => {
  it('returns 401 without a token cookie and does not call the API', async () => {
    getToken.mockResolvedValue(undefined);
    expect((await get('1')).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('streams the image with the safe headers and the cookie JWT', async () => {
    getToken.mockResolvedValue('jwt-123');
    fetchMock.mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: {
          'content-type': 'image/png',
          'x-content-type-options': 'nosniff',
          'set-cookie': 'leak=1',
        },
      }),
    );

    const res = await get('7');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.test/users/7/avatar',
      expect.objectContaining({ headers: { Authorization: 'Bearer jwt-123' } }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('set-cookie')).toBeNull();
    expect(res.headers.get('cache-control')).toBe('private, no-cache');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('relays a 404 from the API', async () => {
    getToken.mockResolvedValue('jwt');
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Avatar not found' }), { status: 404 }),
    );
    const res = await get('7');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: 'Avatar not found' });
  });

  it.each(['abc', '0', '-1', '1.5', '99999999999'])(
    'returns 404 for the invalid id %s without calling the API',
    async (id) => {
      getToken.mockResolvedValue('jwt');
      expect((await get(id)).status).toBe(404);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('returns 502 when the API is unreachable', async () => {
    getToken.mockResolvedValue('jwt');
    fetchMock.mockRejectedValue(new Error('down'));
    expect((await get('1')).status).toBe(502);
  });
});
