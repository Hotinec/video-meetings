export interface MeetingFile {
  id: string;
  meetingId: number;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

export class FilesUnauthorizedError extends Error {}

const base = (meetingId: number) => `/api/meetings/${meetingId}/files`;

async function failure(res: Response, fallback: string): Promise<Error> {
  if (res.status === 401) return new FilesUnauthorizedError('Your session has expired');
  const data = await res.json().catch(() => ({}));
  const message = Array.isArray(data.message) ? data.message[0] : data.message;
  return new Error(typeof message === 'string' && message ? message : fallback);
}

export async function listMeetingFiles(meetingId: number): Promise<MeetingFile[]> {
  const res = await fetch(base(meetingId), { cache: 'no-store' });
  if (!res.ok) throw await failure(res, 'Failed to load files');
  return res.json();
}

export async function uploadMeetingFile(meetingId: number, file: File): Promise<MeetingFile> {
  const body = new FormData();
  body.append('file', file);
  const res = await fetch(base(meetingId), { method: 'POST', body });
  if (!res.ok) throw await failure(res, 'Upload failed');
  return res.json();
}

export const downloadUrl = (meetingId: number, fileId: string) =>
  `${base(meetingId)}/${encodeURIComponent(fileId)}/download`;

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}
