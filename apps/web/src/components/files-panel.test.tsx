import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FilesPanel } from './files-panel';
import type { MeetingFile } from '@/lib/meeting-files';

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

/** Routes fetch calls by method so a test can describe list and upload responses separately. */
function mockApi(handlers: { list: () => Promise<Response>; upload?: () => Promise<Response> }) {
  const fetchMock = vi.fn((_url: string, init?: RequestInit) =>
    init?.method === 'POST' ? handlers.upload!() : handlers.list(),
  );
  vi.stubGlobal('fetch', fetchMock);
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
    const upload = vi.fn(() => json(file({ originalName: 'notes.txt' }), 201));
    const fetchMock = mockApi({ list, upload });
    render(<FilesPanel meetingId={7} />);
    await screen.findByText('No files yet.');

    const input = screen.getByLabelText('Choose a file to upload');
    const chosen = new File(['hello'], 'notes.txt', { type: 'text/plain' });
    await userEvent.upload(input, chosen);

    expect(await screen.findByRole('link', { name: 'notes.txt' })).toBeInTheDocument();
    expect(screen.getByText('Uploaded notes.txt')).toBeInTheDocument();

    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')!;
    expect(post[0]).toBe('/api/meetings/7/files');
    expect((post[1]!.body as FormData).get('file')).toBe(chosen);
  });

  it('shows the readable server validation error and keeps the list', async () => {
    const message = 'File type not allowed. Allowed types: mp4, pdf, txt';
    mockApi({
      list: () => json([file()]),
      upload: () => json({ message, error: 'Bad Request', statusCode: 400 }, 400),
    });
    render(<FilesPanel meetingId={7} />);
    await screen.findByRole('link', { name: 'minutes.pdf' });

    await userEvent.upload(
      screen.getByLabelText('Choose a file to upload'),
      new File(['MZ'], 'setup.exe'),
      { applyAccept: false },
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByRole('link', { name: 'minutes.pdf' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload File' })).toBeEnabled();
  });

  it('takes the first message when the API returns a list of validation errors', async () => {
    mockApi({
      list: () => json([]),
      upload: () => json({ message: ['first problem', 'second problem'] }, 400),
    });
    render(<FilesPanel meetingId={7} />);
    await screen.findByText('No files yet.');

    await userEvent.upload(
      screen.getByLabelText('Choose a file to upload'),
      new File(['x'], 'a.txt'),
    );

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('first problem'));
  });
});
