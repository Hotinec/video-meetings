'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Spinner } from '@heroui/react';
import { UploadIcon } from '@/components/icons';
import {
  downloadUrl,
  FilesUnauthorizedError,
  formatFileSize,
  listMeetingFiles,
  uploadMeetingFile,
  type MeetingFile,
} from '@/lib/meeting-files';

const ACCEPT = '.mp4,.mov,.webm,.mp3,.m4a,.wav,.pdf,.docx,.xlsx,.pptx,.txt';

const dateFormat = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; files: MeetingFile[] };

function signOut() {
  window.location.href = '/api/auth/logout';
}

export function FilesPanel({ meetingId }: { meetingId: number }) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      setState({ status: 'ready', files: await listMeetingFiles(meetingId) });
    } catch (err) {
      if (err instanceof FilesUnauthorizedError) {
        signOut();
        return;
      }
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Failed to load files',
      });
    }
  }, [meetingId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = ''; // lets the same file be picked again after an error
    if (!file) return;

    setUploadError(null);
    setUploaded(null);
    setIsUploading(true);
    try {
      const saved = await uploadMeetingFile(meetingId, file);
      setUploaded(saved.originalName);
      setState({ status: 'ready', files: await listMeetingFiles(meetingId) });
    } catch (err) {
      if (err instanceof FilesUnauthorizedError) return signOut();
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  let list: React.ReactNode;
  if (state.status === 'loading') {
    list = (
      <div
        role="status"
        className="flex items-center gap-2 text-sm"
        style={{ color: 'var(--muted)' }}
      >
        <Spinner size="sm" color="current" />
        Loading files…
      </div>
    );
  } else if (state.status === 'error') {
    list = (
      <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
        <span style={{ color: 'color-mix(in oklch, var(--danger), black 35%)' }}>
          {state.message}
        </span>
        <Button variant="secondary" size="lg" className="min-h-11" onPress={load}>
          Try again
        </Button>
      </div>
    );
  } else if (state.files.length === 0) {
    list = (
      <p className="text-sm" style={{ color: 'var(--muted)' }}>
        No files yet.
      </p>
    );
  } else {
    list = (
      <ul className="flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
        {state.files.map((file) => (
          <li
            key={file.id}
            className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4 py-1 first:pt-0 last:pb-0"
          >
            <a
              href={downloadUrl(meetingId, file.id)}
              download
              className="inline-flex items-center min-h-11 font-medium break-all min-w-0 underline-offset-4 hover:underline focus-visible:underline"
              style={{ color: 'var(--accent)' }}
            >
              {file.originalName}
            </a>
            <span
              className="flex items-center gap-3 text-sm shrink-0"
              style={{ color: 'var(--muted)' }}
            >
              <span>{formatFileSize(file.size)}</span>
              <time dateTime={file.uploadedAt}>{dateFormat.format(new Date(file.uploadedAt))}</time>
            </span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="flex flex-col gap-4 pt-2">
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={handleSelect}
          aria-label="Choose a file to upload"
          tabIndex={-1}
        />
        <Button
          variant="primary"
          size="lg"
          className="min-h-11"
          onPress={() => inputRef.current?.click()}
          isDisabled={isUploading}
        >
          {isUploading ? <Spinner size="sm" color="current" /> : <UploadIcon />}
          {isUploading ? 'Uploading…' : 'Upload File'}
        </Button>
      </div>
      <div role="status" className="text-sm empty:hidden" style={{ color: 'var(--muted)' }}>
        {uploaded && `Uploaded ${uploaded}`}
      </div>
      {uploadError && (
        <div
          role="alert"
          className="text-sm"
          style={{ color: 'color-mix(in oklch, var(--danger), black 35%)' }}
        >
          {uploadError}
        </div>
      )}
      {list}
    </div>
  );
}
