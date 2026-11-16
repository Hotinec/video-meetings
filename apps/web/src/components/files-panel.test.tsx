import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
  remove?: () => Promise<Response>;
}) {
  const fetchMock = vi.fn((_url: string, init?: RequestInit) =>
    init?.method === 'DELETE' ? handlers.remove!() : handlers.list(),
  );
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
    expect(link.querySelector('svg')).toHaveAttribute('data-kind', 'pdf');
    expect(screen.getByRole('link', { name: 'big.mp4' }).querySelector('svg')).toHaveAttribute(
      'data-kind',
      'video',
    );
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

  describe('drop zone', () => {
    const zone = () => screen.getByTestId('drop-zone');
    const dropFiles = (...files: File[]) => fireEvent.drop(zone(), { dataTransfer: { files } });

    const ready = async () => {
      mockApi({
        list: () => json([]),
        upload: () => ({ status: 201, body: file({ originalName: 'dropped.pdf' }) }),
      });
      render(<FilesPanel meetingId={7} />);
      await screen.findByText('No files yet.');
    };

    it('accepts a dropped file of an allowed type and uploads it', async () => {
      await ready();
      const dropped = new File(['%PDF'], 'dropped.pdf', { type: 'application/pdf' });

      dropFiles(dropped);

      expect(await screen.findByText('Uploaded dropped.pdf')).toBeInTheDocument();
      expect(FakeXHR.instances).toHaveLength(1);
      expect((FakeXHR.instances[0].body as FormData).get('file')).toBe(dropped);
    });

    it('rejects a dropped file of a disallowed type without sending anything', async () => {
      await ready();

      dropFiles(new File(['MZ'], 'setup.exe'));

      expect(await screen.findByRole('alert')).toHaveTextContent(/File type not allowed/);
      expect(FakeXHR.instances).toHaveLength(0);
    });

    it('rejects a dropped file over 100 MB without sending anything', async () => {
      await ready();
      const big = new File(['x'], 'huge.mp4', { type: 'video/mp4' });
      Object.defineProperty(big, 'size', { value: 100 * 1024 * 1024 + 1 });

      dropFiles(big);

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'File is too large. Maximum size is 100 MB',
      );
      expect(FakeXHR.instances).toHaveLength(0);
    });

    it('rejects several dropped files at once', async () => {
      await ready();

      dropFiles(new File(['a'], 'a.txt'), new File(['b'], 'b.txt'));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Please upload one file at a time',
      );
      expect(FakeXHR.instances).toHaveLength(0);
    });

    it('also checks files chosen with the button', async () => {
      await ready();

      await userEvent.upload(
        screen.getByLabelText('Choose a file to upload'),
        new File(['MZ'], 'setup.exe'),
        { applyAccept: false },
      );

      expect(await screen.findByRole('alert')).toHaveTextContent(/File type not allowed/);
      expect(FakeXHR.instances).toHaveLength(0);
    });

    it('highlights while a file is dragged over and clears on leave', async () => {
      await ready();
      expect(zone()).not.toHaveAttribute('data-dragging');

      fireEvent.dragEnter(zone());
      expect(zone()).toHaveAttribute('data-dragging');

      fireEvent.dragLeave(zone(), { relatedTarget: document.body });
      expect(zone()).not.toHaveAttribute('data-dragging');
    });
  });

  describe('delete', () => {
    const twoFiles = () => json([file(), file({ id: 'f2', originalName: 'notes.txt' })]);

    it('hides the delete button from non-hosts', async () => {
      mockApi({ list: twoFiles });
      render(<FilesPanel meetingId={7} />);
      await screen.findByRole('link', { name: 'minutes.pdf' });

      expect(screen.queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument();
    });

    it('shows a delete button on every row for the host', async () => {
      mockApi({ list: twoFiles });
      render(<FilesPanel meetingId={7} isHost />);
      await screen.findByRole('link', { name: 'minutes.pdf' });

      expect(screen.getByRole('button', { name: 'Delete minutes.pdf' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete notes.txt' })).toBeInTheDocument();
    });

    it('asks for confirmation and keeps the file when cancelled', async () => {
      const fetchMock = mockApi({ list: twoFiles });
      render(<FilesPanel meetingId={7} isHost />);
      await screen.findByRole('link', { name: 'minutes.pdf' });

      await userEvent.click(screen.getByRole('button', { name: 'Delete minutes.pdf' }));
      const confirm = screen.getByRole('group', { name: 'Confirm deleting minutes.pdf' });
      expect(within(confirm).getByText('Delete this file?')).toBeInTheDocument();
      expect(within(confirm).getByRole('button', { name: 'Cancel' })).toHaveFocus();

      await userEvent.click(within(confirm).getByRole('button', { name: 'Cancel' }));

      expect(screen.getByRole('link', { name: 'minutes.pdf' })).toBeInTheDocument();
      expect(screen.queryByRole('group')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete minutes.pdf' })).toHaveFocus();
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);
    });

    it('removes the item without reloading the list once the delete is confirmed', async () => {
      const fetchMock = mockApi({
        list: twoFiles,
        remove: () => Promise.resolve(new Response(null, { status: 204 })),
      });
      render(<FilesPanel meetingId={7} isHost />);
      await screen.findByRole('link', { name: 'minutes.pdf' });

      await userEvent.click(screen.getByRole('button', { name: 'Delete minutes.pdf' }));
      await userEvent.click(
        within(screen.getByRole('group')).getByRole('button', { name: 'Delete' }),
      );

      await waitFor(() =>
        expect(screen.queryByRole('link', { name: 'minutes.pdf' })).not.toBeInTheDocument(),
      );
      expect(screen.getByRole('link', { name: 'notes.txt' })).toBeInTheDocument();
      expect(screen.getByText('Deleted minutes.pdf')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Upload File' })).toHaveFocus();

      const calls = fetchMock.mock.calls;
      const del = calls.find(([, init]) => init?.method === 'DELETE')!;
      expect(del[0]).toBe('/api/meetings/7/files/f1');
      expect(calls.filter(([, init]) => !init?.method)).toHaveLength(1); // only the initial list
    });

    it('shows the empty state after the last file is deleted', async () => {
      mockApi({
        list: () => json([file()]),
        remove: () => Promise.resolve(new Response(null, { status: 204 })),
      });
      render(<FilesPanel meetingId={7} isHost />);
      await screen.findByRole('link', { name: 'minutes.pdf' });

      await userEvent.click(screen.getByRole('button', { name: 'Delete minutes.pdf' }));
      await userEvent.click(
        within(screen.getByRole('group')).getByRole('button', { name: 'Delete' }),
      );

      expect(await screen.findByText('No files yet.')).toBeInTheDocument();
    });

    it('keeps the file and shows the server message when the delete is refused', async () => {
      mockApi({
        list: twoFiles,
        remove: () =>
          json({ message: 'Only the meeting host can delete files', statusCode: 403 }, 403),
      });
      render(<FilesPanel meetingId={7} isHost />);
      await screen.findByRole('link', { name: 'minutes.pdf' });

      await userEvent.click(screen.getByRole('button', { name: 'Delete minutes.pdf' }));
      await userEvent.click(
        within(screen.getByRole('group')).getByRole('button', { name: 'Delete' }),
      );

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Only the meeting host can delete files',
      );
      expect(screen.getByRole('link', { name: 'minutes.pdf' })).toBeInTheDocument();
    });

    it('treats a file that is already gone as deleted', async () => {
      mockApi({ list: twoFiles, remove: () => json({ message: 'File not found' }, 404) });
      render(<FilesPanel meetingId={7} isHost />);
      await screen.findByRole('link', { name: 'minutes.pdf' });

      await userEvent.click(screen.getByRole('button', { name: 'Delete minutes.pdf' }));
      await userEvent.click(
        within(screen.getByRole('group')).getByRole('button', { name: 'Delete' }),
      );

      await waitFor(() =>
        expect(screen.queryByRole('link', { name: 'minutes.pdf' })).not.toBeInTheDocument(),
      );
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});
