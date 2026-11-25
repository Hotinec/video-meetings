import { extensionOf } from '@/lib/file-rules';

export type FileKind =
  'video' | 'audio' | 'pdf' | 'document' | 'spreadsheet' | 'presentation' | 'text' | 'other';

const BY_EXTENSION: Record<string, FileKind> = {
  mp4: 'video',
  mov: 'video',
  webm: 'video',
  mp3: 'audio',
  m4a: 'audio',
  wav: 'audio',
  pdf: 'pdf',
  docx: 'document',
  xlsx: 'spreadsheet',
  pptx: 'presentation',
  txt: 'text',
};

/** The extension is what the API validated, so it wins; the MIME type is the fallback. */
export function fileKind(mimeType: string, name: string): FileKind {
  const byName = BY_EXTENSION[extensionOf(name)];
  if (byName) return byName;

  const mime = mimeType.toLowerCase();
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime === 'application/pdf') return 'pdf';
  if (mime.includes('wordprocessingml')) return 'document';
  if (mime.includes('spreadsheetml')) return 'spreadsheet';
  if (mime.includes('presentationml')) return 'presentation';
  if (mime.startsWith('text/')) return 'text';
  return 'other';
}

export const FILE_KIND_LABEL: Record<FileKind, string> = {
  video: 'Video',
  audio: 'Audio',
  pdf: 'PDF document',
  document: 'Document',
  spreadsheet: 'Spreadsheet',
  presentation: 'Presentation',
  text: 'Text file',
  other: 'File',
};
