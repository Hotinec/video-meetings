import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FilesPanel } from './files-panel';
import type { MeetingFile } from '@/lib/meeting-files';
import { FakeXHR, installFakeXHR } from '@/test/fake-xhr';

const file = (over: Partial<MeetingFile> = {}): MeetingFile => ({
  id: 'f1',
  meetingId: 7,
  originalName: 'minutes.pdf',
  mimeType: 'application/pdf',
  size: 2048,
  uploadedAt: '2026-11-16T10:00:00.000Z',
  ...over,
});

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

/** `list` is served by fetch; `upload` (optional) auto-replies to XHR uploads. */
function mockApi(handlers: {
  list: () => Promise<Response>;
  upload?: () => { status: number; body: unknown };
}) {
  const fetchMock = vi.fn(() => handlers.list());
  vi.stubGlobal('fetch', fetchMock);
  installFakeXHR(handlers.upload ?? null);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe('FilesPanel', () => {
  it('shows a loading state, then each file with size, date and a download link', async () => {
    mockApi({
      list: () => json([file(), file({ id: 'f2', originalName: 'big.mp4', size: 5 * 1024 ** 2 })]),
    });
    render(<FilesPanel meetingId={7} />);

    expect(screen.getByText(/Loading files/)).toBeInTheDocument();

    const link = await screen.findByRole('link', { name: 'minutes.pdf' });
    expect(link).toHaveAttribute('href', '/api/meetings/7/files/f1/download');
    expect(screen.getByText('2.0 KB')).toBeInTheDocument();
    expect(screen.getByText('5.0 MB')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getAllByText(/2026/)).toHaveLength(2);
  });

  it('shows an empty state when there are no files', async () => {
    mockApi({ list: () => json([]) });
    render(<FilesPanel meetingId={7} />);

    expect(await screen.findByText('No files yet.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('shows the server message when loading fails, and retries', async () => {
    const list = vi
      .fn()
      .mockImplementationOnce(() => json({ message: 'Meeting 7 not found' }, 404))
      .mockImplementation(() => json([file()]));
    mockApi({ list });
    render(<FilesPanel meetingId={7} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Meeting 7 not found');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('link', { name: 'minutes.pdf' })).toBeInTheDocument();
  });

  it('uploads the chosen file and refreshes the list', async () => {
    const list = vi
      .fn()
      .mockImplementationOnce(() => json([]))
      .mockImplementation(() => json([file({ originalName: 'notes.txt' })]));
    const upload = vi.fn(() => ({ status: 201, body: file({ originalName: 'notes.txt' }) }));
    const fetchMock = mockApi({ list, upload });
    render(<FilesPanel meetingId={7} />);
    await screen.findByText('No files yet.');

    const input = screen.getByLabelText('Choose a file to upload');
    const chosen = new File(['hello'], 'notes.txt', { type: 'text/plain' });
    await userEvent.upload(input, chosen);

    expect(await screen.findByRole('link', { name: 'notes.txt' })).toBeInTheDocument();
    expect(screen.getByText('Uploaded notes.txt')).toBeInTheDocument();

    const xhr = FakeXHR.instances[0];
    expect(xhr.method).toBe('POST');
    expect(xhr.url).toBe('/api/meetings/7/files');
    expect((xhr.body as FormData).get('file')).toBe(chosen);
    expect(fetchMock).toHaveBeenCalledTimes(2); // initial load + refresh, no fetch for the upload
  });

  it('shows the readable server validation error and keeps the list', async () => {
    const message = 'File content does not match its type. Allowed types: mp4, pdf, txt';
    mockApi({
      list: () => json([file()]),
      upload: () => ({ status: 400, body: { message, error: 'Bad Request', statusCode: 400 } }),
    });
    render(<FilesPanel meetingId={7} />);
    await screen.findByRole('link', { name: 'minutes.pdf' });

    await userEvent.upload(
      screen.getByLabelText('Choose a file to upload'),
      new File(['MZ'], 'fake.pdf'),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByRole('link', { name: 'minutes.pdf' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload File' })).toBeEnabled();
  });

  it('takes the first message when the API returns a list of validation errors', async () => {
    mockApi({
      list: () => json([]),
      upload: () => ({ status: 400, body: { message: ['first problem', 'second problem'] } }),
    });
    render(<FilesPanel meetingId={7} />);
    await screen.findByText('No files yet.');

    await userEvent.upload(
      screen.getByLabelText('Choose a file to upload'),
      new File(['x'], 'a.txt'),
    );

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('first problem'));
  });

  it('keeps the uploaded file and shows no error when the refresh after upload fails', async () => {
    const list = vi
      .fn()
      .mockImplementationOnce(() => json([]))
      .mockImplementation(() => json({ message: 'Bad gateway' }, 502));
    mockApi({ list, upload: () => ({ status: 201, body: file({ originalName: 'notes.txt' }) }) });
    render(<FilesPanel meetingId={7} />);
    await screen.findByText('No files yet.');

    await userEvent.upload(
      screen.getByLabelText('Choose a file to upload'),
      new File(['hello'], 'notes.txt', { type: 'text/plain' }),
    );

    expect(await screen.findByRole('link', { name: 'notes.txt' })).toBeInTheDocument();
    expect(screen.getByText('Uploaded notes.txt')).toBeInTheDocument();
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('ignores a slow older list response that arrives after a newer one', async () => {
    let resolveFirst!: (res: Response) => void;
    const list = vi
      .fn()
      .mockImplementationOnce(() => new Promise<Response>((r) => (resolveFirst = r)))
      .mockImplementation(() => json([file({ originalName: 'new.txt' })]));
    mockApi({ list, upload: () => ({ status: 201, body: file({ originalName: 'new.txt' }) }) });
    render(<FilesPanel meetingId={7} />);

    // Upload while the initial load is still pending; the refresh after it returns first.
    await userEvent.upload(
      screen.getByLabelText('Choose a file to upload'),
      new File(['x'], 'new.txt', { type: 'text/plain' }),
    );
    await screen.findByRole('link', { name: 'new.txt' });

    resolveFirst(new Response(JSON.stringify([]), { status: 200 }));
    await new Promise((r) => setTimeout(r, 20));

    expect(screen.getByRole('link', { name: 'new.txt' })).toBeInTheDocument();
    expect(screen.queryByText('No files yet.')).not.toBeInTheDocument();
  });

  it('shows a progress bar that follows the upload and disappears when it finishes', async () => {
    mockApi({ list: () => json([]) });
    render(<FilesPanel meetingId={7} />);
    await screen.findByText('No files yet.');
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();

    await userEvent.upload(
      screen.getByLabelText('Choose a file to upload'),
      new File(['hello'], 'movie.mp4', { type: 'video/mp4' }),
    );

    const bar = await screen.findByRole('progressbar', { name: 'Uploading movie.mp4' });
    expect(bar).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByRole('button', { name: /Uploading/ })).toBeDisabled();

    const xhr = FakeXHR.instances[0];
    act(() => xhr.progress(25, 100));
    expect(bar).toHaveAttribute('aria-valuenow', '25');
    expect(screen.getByText('25%')).toBeInTheDocument();

    act(() => xhr.progress(100, 100));
    expect(bar).toHaveAttribute('aria-valuenow', '100');

    act(() => xhr.respond(201, file({ originalName: 'movie.mp4' })));
    await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());
    expect(screen.getByText('Uploaded movie.mp4')).toBeInTheDocument();
  });

  it('hides the progress bar and shows the error when the upload is rejected', async () => {
    mockApi({ list: () => json([]) });
    render(<FilesPanel meetingId={7} />);
    await screen.findByText('No files yet.');

    await userEvent.upload(
      screen.getByLabelText('Choose a file to upload'),
      new File(['x'], 'a.txt'),
    );
    await screen.findByRole('progressbar');
    act(() => FakeXHR.instances[0].respond(400, { message: 'File is too large' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('File is too large');
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('reports a network failure during upload', async () => {
    mockApi({ list: () => json([]) });
    render(<FilesPanel meetingId={7} />);
    await screen.findByText('No files yet.');

    await userEvent.upload(
      screen.getByLabelText('Choose a file to upload'),
      new File(['x'], 'a.txt'),
    );
    await screen.findByRole('progressbar');
    act(() => FakeXHR.instances[0].fail());

    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the server');
  });
});
