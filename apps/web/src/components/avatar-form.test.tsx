import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

import { AvatarForm } from './avatar-form';

const fetchMock = vi.fn();

beforeEach(() => {
  refresh.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => vi.unstubAllGlobals());

const reply = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));
const png = () => new File(['x'], 'me.png', { type: 'image/png' });

async function pick(file: File) {
  const user = userEvent.setup({ applyAccept: false });
  await user.upload(screen.getByLabelText('Avatar'), file);
  return user;
}

describe('AvatarForm', () => {
  it('shows a preview of the selected file', async () => {
    render(<AvatarForm />);
    await pick(png());
    expect(await screen.findByRole('img', { name: /preview/i })).toHaveAttribute(
      'src',
      'blob:preview',
    );
  });

  it('rejects a wrong type inline without calling the API', async () => {
    render(<AvatarForm />);
    await pick(new File(['x'], 'a.gif', { type: 'image/gif' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/type not allowed/i);
    expect(screen.queryByRole('img', { name: /preview/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an oversize file', async () => {
    render(<AvatarForm />);
    const big = new File(['x'], 'big.png', { type: 'image/png' });
    Object.defineProperty(big, 'size', { value: 6 * 1024 * 1024 });
    await pick(big);
    expect(await screen.findByRole('alert')).toHaveTextContent(/too large/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uploads, shows success and refreshes', async () => {
    fetchMock.mockReturnValue(reply(201, { avatarUrl: '/users/1/avatar' }));
    render(<AvatarForm />);
    const user = await pick(png());
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('status')).toHaveTextContent(/saved/i);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/users/me/avatar');
    expect(init.method).toBe('POST');
    expect((init.body as FormData).get('file')).toBeInstanceOf(File);
    expect(refresh).toHaveBeenCalled();
  });

  it('shows the API error and does not refresh, so the old avatar stays', async () => {
    fetchMock.mockReturnValue(reply(400, { message: 'File type not allowed. Allowed types: x' }));
    render(<AvatarForm />);
    const user = await pick(png());
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/type not allowed/i);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('logs out on 401', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { assign });
    fetchMock.mockReturnValue(reply(401, { message: 'Unauthorized' }));
    render(<AvatarForm />);
    const user = await pick(png());
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/api/auth/logout'));
  });

  it('disables the button while uploading', async () => {
    let resolve!: (r: Response) => void;
    fetchMock.mockReturnValue(new Promise<Response>((r) => (resolve = r)));
    render(<AvatarForm />);
    const user = await pick(png());
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('button', { name: /saving/i })).toBeDisabled();
    resolve(new Response('{}', { status: 201 }));
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
  });
});
