'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, Spinner } from '@heroui/react';
import {
  FilesUnauthorizedError,
  formatFileSize,
  listMeetingFiles,
  type MeetingFile,
} from '@/lib/meeting-files';

const dateFormat = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; files: MeetingFile[] };

export function FilesPanel({ meetingId }: { meetingId: number }) {
  const [state, setState] = useState<State>({ status: 'loading' });

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      setState({ status: 'ready', files: await listMeetingFiles(meetingId) });
    } catch (err) {
      if (err instanceof FilesUnauthorizedError) {
        window.location.href = '/api/auth/logout';
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

  if (state.status === 'loading') {
    return (
      <div
        role="status"
        className="flex items-center gap-2 text-sm"
        style={{ color: 'var(--muted)' }}
      >
        <Spinner size="sm" color="current" />
        Loading files…
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
        <span style={{ color: 'var(--danger)' }}>{state.message}</span>
        <Button variant="secondary" size="sm" onPress={load}>
          Try again
        </Button>
      </div>
    );
  }

  if (state.files.length === 0) {
    return (
      <p className="text-sm" style={{ color: 'var(--muted)' }}>
        No files yet.
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
      {state.files.map((file) => (
        <li
          key={file.id}
          className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4 py-3 first:pt-0 last:pb-0"
        >
          <span className="font-medium break-all min-w-0">{file.originalName}</span>
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
