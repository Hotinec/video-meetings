import { describe, expect, it } from 'vitest';
import { afterEach, vi } from 'vitest';
import { FakeXHR, installFakeXHR } from '@/test/fake-xhr';
import {
  deleteMeetingFile,
  downloadUrl,
  FilesUnauthorizedError,
  formatFileSize,
  uploadMeetingFile,
} from './meeting-files';

afterEach(() => vi.unstubAllGlobals());

describe('formatFileSize', () => {
  it.each([
    [0, '0 B'],
    [1023, '1023 B'],
    [1024, '1.0 KB'],
    [1536, '1.5 KB'],
    [10 * 1024, '10 KB'],
    [5 * 1024 ** 2, '5.0 MB'],
    [100 * 1024 ** 2, '100 MB'],
    [3 * 1024 ** 3, '3.0 GB'],
  ])('%i bytes -> %s', (bytes, text) => {
    expect(formatFileSize(bytes)).toBe(text);
  });
});

describe('downloadUrl', () => {
  it('points at the proxied download route and encodes the id', () => {
    expect(downloadUrl(7, 'a/b')).toBe('/api/meetings/7/files/a%2Fb/download');
  });
});

describe('uploadMeetingFile', () => {
  const picked = () => new File(['hi'], 'a.txt', { type: 'text/plain' });

  it('posts the file as multipart and reports progress as a fraction', async () => {
    installFakeXHR();
    const onProgress = vi.fn();
    const promise = uploadMeetingFile(7, picked(), onProgress);

    const xhr = FakeXHR.instances[0];
    expect(xhr.method).toBe('POST');
    expect(xhr.url).toBe('/api/meetings/7/files');
    expect((xhr.body as FormData).get('file')).toBeInstanceOf(File);

    xhr.progress(50, 200);
    xhr.progress(200, 200);
    xhr.respond(201, { id: 'f1', originalName: 'a.txt' });

    await expect(promise).resolves.toMatchObject({ id: 'f1' });
    expect(onProgress.mock.calls).toEqual([[0.25], [1]]);
  });

  it('ignores progress events without a known length', async () => {
    installFakeXHR();
    const onProgress = vi.fn();
    const promise = uploadMeetingFile(7, picked(), onProgress);
    FakeXHR.instances[0].upload.onprogress?.({
      lengthComputable: false,
      loaded: 5,
      total: 0,
    } as ProgressEvent);
    FakeXHR.instances[0].respond(201, {});
    await promise;
    expect(onProgress).not.toHaveBeenCalled();
  });

  it.each([
    [400, { message: 'File is too large' }, 'File is too large'],
    [400, { message: ['first', 'second'] }, 'first'],
    [500, 'not json', 'Upload failed'],
    [500, {}, 'Upload failed'],
  ])('rejects %i with a readable message', async (status, body, message) => {
    installFakeXHR();
    const promise = uploadMeetingFile(7, picked());
    FakeXHR.instances[0].respond(status, body);
    await expect(promise).rejects.toThrow(message);
  });

  it('rejects a 401 as an expired session', async () => {
    installFakeXHR();
    const promise = uploadMeetingFile(7, picked());
    FakeXHR.instances[0].respond(401, { message: 'Unauthorized' });
    await expect(promise).rejects.toBeInstanceOf(FilesUnauthorizedError);
  });

  it('rejects a network failure', async () => {
    installFakeXHR();
    const promise = uploadMeetingFile(7, picked());
    FakeXHR.instances[0].fail();
    await expect(promise).rejects.toThrow('Cannot reach the server');
  });
});

describe('deleteMeetingFile', () => {
  const stubFetch = (status: number, body?: unknown) => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(body === undefined ? null : JSON.stringify(body), { status })),
    );
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  };

  it('sends DELETE to the proxied file route', async () => {
    const fetchMock = stubFetch(204);
    await deleteMeetingFile(7, 'a/b');
    expect(fetchMock).toHaveBeenCalledWith('/api/meetings/7/files/a%2Fb', { method: 'DELETE' });
  });

  it('treats 404 as already deleted', async () => {
    stubFetch(404, { message: 'File not found' });
    await expect(deleteMeetingFile(7, 'f1')).resolves.toBeUndefined();
  });

  it('throws the server message on 403', async () => {
    stubFetch(403, { message: 'Only the meeting host can delete files' });
    await expect(deleteMeetingFile(7, 'f1')).rejects.toThrow('Only the meeting host');
  });

  it('throws an expired-session error on 401', async () => {
    stubFetch(401, { message: 'Unauthorized' });
    await expect(deleteMeetingFile(7, 'f1')).rejects.toBeInstanceOf(FilesUnauthorizedError);
  });
});
