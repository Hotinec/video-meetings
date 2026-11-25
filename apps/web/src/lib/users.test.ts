import { afterEach, describe, expect, it, vi } from 'vitest';
import { UnauthorizedError } from './meetings';
import { fetchProfile, initialsOf } from './users';

afterEach(() => vi.unstubAllGlobals());

describe('fetchProfile', () => {
  it('calls GET /users/me with the bearer token and returns the profile', async () => {
    const profile = { id: 1, email: 'a@b.c', username: 'alice', avatarUrl: null };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(profile)));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchProfile('tok')).resolves.toEqual(profile);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/users\/me$/);
    expect(init.headers.Authorization).toBe('Bearer tok');
  });

  it('throws UnauthorizedError on 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })));
    await expect(fetchProfile('tok')).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('throws on other failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })));
    await expect(fetchProfile('tok')).rejects.toThrow('Failed to load profile');
  });
});

describe('initialsOf', () => {
  it.each([
    ['alice', 'AL'],
    ['bob_smith', 'BS'],
    ['jane-doe', 'JD'],
    ['x', 'X'],
    ['', '?'],
  ])('%j -> %s', (username, initials) => {
    expect(initialsOf(username)).toBe(initials);
  });
});
