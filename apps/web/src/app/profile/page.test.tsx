import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const getToken = vi.fn();
vi.mock('@/lib/session', () => ({ API_URL: 'http://api.test', getToken: () => getToken() }));
const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
vi.mock('next/navigation', () => ({ redirect: (url: string) => redirect(url) }));
const fetchProfile = vi.fn();
vi.mock('@/lib/users', async (orig) => ({
  ...(await orig<typeof import('@/lib/users')>()),
  fetchProfile: (t: string) => fetchProfile(t),
}));

import { UnauthorizedError } from '@/lib/meetings';
import ProfilePage from './page';

beforeEach(() => {
  getToken.mockReset();
  redirect.mockClear();
  fetchProfile.mockReset();
});

describe('/profile page', () => {
  it('redirects to /login without a token', async () => {
    getToken.mockResolvedValue(undefined);
    await expect(ProfilePage()).rejects.toThrow('NEXT_REDIRECT:/login');
    expect(fetchProfile).not.toHaveBeenCalled();
  });

  it('logs out when the API rejects the token', async () => {
    getToken.mockResolvedValue('expired');
    fetchProfile.mockRejectedValue(new UnauthorizedError());
    await expect(ProfilePage()).rejects.toThrow('NEXT_REDIRECT:/api/auth/logout');
  });

  it('shows the avatar placeholder, username and read-only email', async () => {
    getToken.mockResolvedValue('jwt');
    fetchProfile.mockResolvedValue({
      id: 1,
      email: 'alice@example.com',
      username: 'alice',
      avatarUrl: null,
    });
    render(await ProfilePage());

    expect(screen.getByRole('img', { name: 'Avatar of alice' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Profile' })).toBeInTheDocument();
    expect(screen.getByText('alice')).toBeInTheDocument();
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back/i })).toHaveAttribute('href', '/');
  });
});
