'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Spinner } from '@heroui/react';
import { FileIcon, TrashIcon, UploadIcon } from '@/components/icons';
import { fileKind } from '@/lib/file-kind';
import { ACCEPT, validateFile } from '@/lib/file-rules';
import {
  deleteMeetingFile,
  downloadUrl,
  FilesUnauthorizedError,
  formatFileSize,
  listMeetingFiles,
  uploadMeetingFile,
  type MeetingFile,
} from '@/lib/meeting-files';

/** HeroUI's stock danger colours fall short of 4.5:1, so darken them. */
const DANGER_TEXT = 'color-mix(in oklch, var(--danger), black 35%)';
const DANGER_SOLID_STYLE = { background: DANGER_TEXT, color: 'white' };
const DANGER_SOFT_STYLE = {
  background: 'color-mix(in oklch, var(--danger) 12%, white)',
  color: DANGER_TEXT,
};

const dateFormat = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; files: MeetingFile[] };

function signOut() {
  window.location.href = '/api/auth/logout';
}

export function FilesPanel({ meetingId, isHost = false }: { meetingId: number; isHost?: boolean }) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState<{ name: string; percent: number } | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleted, setDeleted] = useState<string | null>(null);
  const [restoreFocusId, setRestoreFocusId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadButtonRef = useRef<HTMLButtonElement>(null);
  // Every list request takes a number; only the newest one may write state, so a slow
  // older response can't overwrite a fresher list.
  const latestRequest = useRef(0);

  const load = useCallback(async () => {
    const request = ++latestRequest.current;
    setState({ status: 'loading' });
    try {
      const files = await listMeetingFiles(meetingId);
      if (request === latestRequest.current) setState({ status: 'ready', files });
    } catch (err) {
      if (request !== latestRequest.current) return;
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

  const uploadFile = async (file: File) => {
    if (isUploading) return;
    setUploadError(null);
    setUploaded(null);
    setDeleted(null);
    setDeleteError(null);

    // Same checks as the API, so an obviously bad file never leaves the browser.
    const problem = validateFile(file);
    if (problem) {
      setUploadError(problem);
      return;
    }

    setIsUploading(true);
    setProgress({ name: file.name, percent: 0 });
    let saved: MeetingFile;
    try {
      saved = await uploadMeetingFile(meetingId, file, (fraction) =>
        setProgress({ name: file.name, percent: Math.round(fraction * 100) }),
      );
    } catch (err) {
      setIsUploading(false);
      setProgress(null);
      if (err instanceof FilesUnauthorizedError) return signOut();
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
      return;
    }

    // The file is saved, so from here on nothing may be reported as an upload failure.
    // Show it straight away, then refresh to pick up anything else; if the refresh fails the
    // optimistic list stays.
    const request = ++latestRequest.current;
    setUploaded(saved.originalName);
    setProgress(null);
    setState((prev) =>
      prev.status === 'ready'
        ? { status: 'ready', files: [saved, ...prev.files.filter((f) => f.id !== saved.id)] }
        : { status: 'ready', files: [saved] },
    );
    setIsUploading(false);
    try {
      const files = await listMeetingFiles(meetingId);
      if (request === latestRequest.current) setState({ status: 'ready', files });
    } catch {
      /* keep the optimistic list */
    }
  };

  const removeFile = async (target: MeetingFile) => {
    setDeleteError(null);
    setDeleted(null);
    setUploaded(null);
    setDeletingId(target.id);
    try {
      await deleteMeetingFile(meetingId, target.id);
    } catch (err) {
      setDeletingId(null);
      if (err instanceof FilesUnauthorizedError) return signOut();
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete the file');
      return;
    }
    // Invalidate in-flight list requests so one that started before the delete can't bring the file back.
    latestRequest.current++;
    setState((prev) =>
      prev.status === 'ready'
        ? { status: 'ready', files: prev.files.filter((f) => f.id !== target.id) }
        : prev,
    );
    setDeletingId(null);
    setConfirmingId(null);
    setDeleted(target.originalName);
    uploadButtonRef.current?.focus(); // the deleted row's controls are gone
  };

  const handleSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = ''; // lets the same file be picked again after an error
    if (file) void uploadFile(file);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    const dropped = event.dataTransfer.files;
    if (dropped.length === 0) return;
    if (dropped.length > 1) {
      setUploaded(null);
      setUploadError('Please upload one file at a time');
      return;
    }
    void uploadFile(dropped[0]);
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
        <span style={{ color: DANGER_TEXT }}>{state.message}</span>
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
              className="group inline-flex items-center gap-2.5 min-h-11 font-medium min-w-0"
              style={{ color: 'var(--accent)' }}
            >
              <span className="shrink-0">
                <FileIcon kind={fileKind(file.mimeType, file.originalName)} />
              </span>
              <span className="break-all underline-offset-4 group-hover:underline group-focus-visible:underline">
                {file.originalName}
              </span>
            </a>
            {confirmingId === file.id ? (
              <div
                role="group"
                aria-label={`Confirm deleting ${file.originalName}`}
                className="flex flex-wrap items-center gap-2 shrink-0"
              >
                <span className="text-sm">Delete this file?</span>
                <Button
                  variant="secondary"
                  size="lg"
                  className="min-h-11"
                  autoFocus
                  isDisabled={deletingId === file.id}
                  onPress={() => {
                    setRestoreFocusId(file.id); // hand focus back to the button that opened this
                    setConfirmingId(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="lg"
                  className="min-h-11"
                  style={DANGER_SOLID_STYLE}
                  isDisabled={deletingId === file.id}
                  onPress={() => removeFile(file)}
                >
                  {deletingId === file.id ? <Spinner size="sm" color="current" /> : <TrashIcon />}
                  {deletingId === file.id ? 'Deleting…' : 'Delete'}
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 w-full sm:w-auto sm:shrink-0">
                <span
                  className="flex items-center gap-3 text-sm mr-auto sm:mr-0"
                  style={{ color: 'var(--muted)' }}
                >
                  <span>{formatFileSize(file.size)}</span>
                  <time dateTime={file.uploadedAt}>
                    {dateFormat.format(new Date(file.uploadedAt))}
                  </time>
                </span>
                {isHost && (
                  <Button
                    variant="danger-soft"
                    size="lg"
                    className="min-h-11"
                    style={DANGER_SOFT_STYLE}
                    autoFocus={restoreFocusId === file.id}
                    aria-label={`Delete ${file.originalName}`}
                    onPress={() => {
                      setDeleteError(null);
                      setRestoreFocusId(null);
                      setConfirmingId(file.id);
                    }}
                  >
                    <TrashIcon />
                    Delete
                  </Button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="flex flex-col gap-4 pt-2">
      <div
        data-testid="drop-zone"
        data-dragging={isDragging || undefined}
        onDragEnter={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIsDragging(false);
        }}
        onDrop={handleDrop}
        className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors"
        style={{
          borderColor: isDragging
            ? 'var(--accent)'
            : 'color-mix(in oklch, var(--muted) 85%, white)',
          background: isDragging
            ? 'color-mix(in oklch, var(--accent) 8%, transparent)'
            : 'transparent',
        }}
      >
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
          ref={uploadButtonRef}
          variant="primary"
          size="lg"
          className="min-h-11"
          onPress={() => inputRef.current?.click()}
          isDisabled={isUploading}
        >
          {isUploading ? <Spinner size="sm" color="current" /> : <UploadIcon />}
          {isUploading ? 'Uploading…' : 'Upload File'}
        </Button>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          or drag and drop a file here
        </p>
      </div>
      {progress && (
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between gap-3 text-sm">
            <span className="break-all min-w-0">Uploading {progress.name}</span>
            <span className="shrink-0 tabular-nums" style={{ color: 'var(--muted)' }}>
              {progress.percent}%
            </span>
          </div>
          <div
            role="progressbar"
            aria-label={`Uploading ${progress.name}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress.percent}
            className="h-2 w-full overflow-hidden rounded-full"
            style={{ background: 'var(--border)' }}
          >
            <div
              className="h-full rounded-full transition-[width] duration-150 motion-reduce:transition-none"
              style={{ width: `${progress.percent}%`, background: 'var(--accent)' }}
            />
          </div>
        </div>
      )}
      <div role="status" className="text-sm empty:hidden" style={{ color: 'var(--muted)' }}>
        {uploaded && `Uploaded ${uploaded}`}
      </div>
      <div role="status" className="text-sm empty:hidden" style={{ color: 'var(--muted)' }}>
        {deleted && `Deleted ${deleted}`}
      </div>
      {deleteError && (
        <div role="alert" className="text-sm" style={{ color: DANGER_TEXT }}>
          {deleteError}
        </div>
      )}
      {uploadError && (
        <div role="alert" className="text-sm" style={{ color: DANGER_TEXT }}>
          {uploadError}
        </div>
      )}
      {list}
    </div>
  );
}
