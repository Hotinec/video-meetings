import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PasswordForm } from './password-form';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

function reply(status: number, body?: unknown) {
  return Promise.resolve(
    new Response(body === undefined ? null : JSON.stringify(body), { status }),
  );
}

async function fill(
  user: ReturnType<typeof userEvent.setup>,
  oldPw: string,
  newPw: string,
  confirm: string,
) {
  await user.type(screen.getByLabelText('Current password'), oldPw);
  await user.type(screen.getByLabelText('New password'), newPw);
  await user.type(screen.getByLabelText('Confirm new password'), confirm);
  await user.click(screen.getByRole('button', { name: 'Change password' }));
}

describe('PasswordForm', () => {
  it('renders three password fields', () => {
    render(<PasswordForm />);
    for (const label of ['Current password', 'New password', 'Confirm new password']) {
      expect(screen.getByLabelText(label)).toHaveAttribute('type', 'password');
    }
  });

  it('rejects mismatching new passwords without calling the API and keeps input', async () => {
    const user = userEvent.setup();
    render(<PasswordForm />);
    await fill(user, 'old', 'new1', 'new2');

    expect(await screen.findByRole('alert')).toHaveTextContent(/do not match/i);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText('New password')).toHaveValue('new1');
  });

  it('submits, shows success and clears the fields', async () => {
    const user = userEvent.setup();
    fetchMock.mockReturnValue(reply(204));
    render(<PasswordForm />);
    await fill(user, 'old', 'new', 'new');

    expect(await screen.findByRole('status')).toHaveTextContent(/password changed/i);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/users/me/password',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ oldPassword: 'old', newPassword: 'new' }),
      }),
    );
    expect(screen.getByLabelText('Current password')).toHaveValue('');
    expect(screen.getByLabelText('New password')).toHaveValue('');
    expect(screen.getByLabelText('Confirm new password')).toHaveValue('');
  });

  it('shows a wrong-old-password 401 inline and keeps input (no logout)', async () => {
    const user = userEvent.setup();
    const assign = vi.fn();
    vi.stubGlobal('location', { assign });
    fetchMock.mockReturnValue(reply(401, { message: 'Old password is incorrect' }));
    render(<PasswordForm />);
    await fill(user, 'bad', 'new', 'new');

    expect(await screen.findByRole('alert')).toHaveTextContent('Old password is incorrect');
    expect(assign).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Current password')).toHaveValue('bad');
    expect(screen.getByLabelText('New password')).toHaveValue('new');
  });

  it('shows an API 400 inline', async () => {
    const user = userEvent.setup();
    fetchMock.mockReturnValue(
      reply(400, { message: 'New password must differ from the old password' }),
    );
    render(<PasswordForm />);
    await fill(user, 'same', 'same', 'same');

    expect(await screen.findByRole('alert')).toHaveTextContent(/must differ/i);
  });

  it('logs out when the session has expired', async () => {
    const user = userEvent.setup();
    const assign = vi.fn();
    vi.stubGlobal('location', { assign });
    fetchMock.mockReturnValue(reply(401, { message: 'Unauthorized' }));
    render(<PasswordForm />);
    await fill(user, 'old', 'new', 'new');

    await waitFor(() => expect(assign).toHaveBeenCalledWith('/api/auth/logout'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows a generic error when the request fails', async () => {
    const user = userEvent.setup();
    fetchMock.mockRejectedValue(new Error('down'));
    render(<PasswordForm />);
    await fill(user, 'old', 'new', 'new');

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not change/i);
    expect(screen.getByLabelText('Current password')).toHaveValue('old');
  });

  it('disables the button while saving', async () => {
    const user = userEvent.setup();
    let resolve!: (r: Response) => void;
    fetchMock.mockReturnValue(new Promise<Response>((r) => (resolve = r)));
    render(<PasswordForm />);
    await fill(user, 'old', 'new', 'new');

    expect(await screen.findByRole('button', { name: /changing/i })).toBeDisabled();
    resolve(new Response(null, { status: 204 }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Change password' })).toBeEnabled(),
    );
  });
});
