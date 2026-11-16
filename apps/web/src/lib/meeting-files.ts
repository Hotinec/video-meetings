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

/** The API returns `message` as a string, or a list of strings for validation errors. */
function errorMessage(data: { message?: unknown }, fallback: string): string {
  const message = Array.isArray(data.message) ? data.message[0] : data.message;
  return typeof message === 'string' && message ? message : fallback;
}

async function failure(res: Response, fallback: string): Promise<Error> {
  if (res.status === 401) return new FilesUnauthorizedError('Your session has expired');
  const data = await res.json().catch(() => ({}));
  return new Error(errorMessage(data, fallback));
}

export async function listMeetingFiles(meetingId: number): Promise<MeetingFile[]> {
  const res = await fetch(base(meetingId), { cache: 'no-store' });
  if (!res.ok) throw await failure(res, 'Failed to load files');
  return res.json();
}

/**
 * Uploads with XMLHttpRequest because `fetch` can't report upload progress.
 * `onProgress` receives the fraction (0 to 1) of the request body sent so far.
 */
export function uploadMeetingFile(
  meetingId: number,
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<MeetingFile> {
  return new Promise((resolve, reject) => {
    const body = new FormData();
    body.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', base(meetingId));
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress?.(event.loaded / event.total);
    };
    xhr.onerror = () => reject(new Error('Cannot reach the server. Please try again.'));
    xhr.onload = () => {
      let data: { message?: unknown } = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* non-JSON body: fall back to the generic message */
      }
      if (xhr.status >= 200 && xhr.status < 300) return resolve(data as unknown as MeetingFile);
      if (xhr.status === 401) return reject(new FilesUnauthorizedError('Your session has expired'));
      reject(new Error(errorMessage(data, 'Upload failed')));
    };
    xhr.send(body);
  });
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
