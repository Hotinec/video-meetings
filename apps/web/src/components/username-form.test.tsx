import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

import { UsernameForm } from './username-form';

const fetchMock = vi.fn();

beforeEach(() => {
  refresh.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

function reply(status: number, body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

describe('UsernameForm', () => {
  it('prefills the current username', () => {
    render(<UsernameForm username="alice" />);
    expect(screen.getByLabelText('Username')).toHaveValue('alice');
  });

  it('rejects invalid input inline without calling the API', async () => {
    const user = userEvent.setup();
    render(<UsernameForm username="alice" />);
    const input = screen.getByLabelText('Username');
    await user.clear(input);
    await user.type(input, 'a!');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/3.30 characters/i);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(input).toHaveValue('a!');
  });

  it('saves, shows a success message and refreshes', async () => {
    const user = userEvent.setup();
    fetchMock.mockReturnValue(reply(200, { username: 'bob_1' }));
    render(<UsernameForm username="alice" />);
    const input = screen.getByLabelText('Username');
    await user.clear(input);
    await user.type(input, 'bob_1');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('status')).toHaveTextContent(/saved/i);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/users/me',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ username: 'bob_1' }),
      }),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it('shows the API error on a duplicate and keeps the input', async () => {
    const user = userEvent.setup();
    fetchMock.mockReturnValue(reply(409, { message: 'Username is already taken' }));
    render(<UsernameForm username="alice" />);
    const input = screen.getByLabelText('Username');
    await user.clear(input);
    await user.type(input, 'Bob');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Username is already taken');
    expect(input).toHaveValue('Bob');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('sends the user through logout when the session has expired (401)', async () => {
    const user = userEvent.setup();
    const assign = vi.fn();
    vi.stubGlobal('location', { assign });
    fetchMock.mockReturnValue(reply(401, { message: 'Unauthorized' }));
    render(<UsernameForm username="alice" />);
    const input = screen.getByLabelText('Username');
    await user.clear(input);
    await user.type(input, 'bob');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith('/api/auth/logout'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('skips the round trip when the username is unchanged', async () => {
    const user = userEvent.setup();
    render(<UsernameForm username="alice" />);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('status')).toHaveTextContent(/saved/i);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('disables the button while saving', async () => {
    const user = userEvent.setup();
    let resolve!: (r: Response) => void;
    fetchMock.mockReturnValue(new Promise<Response>((r) => (resolve = r)));
    render(<UsernameForm username="alice" />);
    const input = screen.getByLabelText('Username');
    await user.clear(input);
    await user.type(input, 'bob');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('button', { name: /saving/i })).toBeDisabled();
    resolve(new Response(JSON.stringify({ username: 'bob' }), { status: 200 }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled());
  });
});
