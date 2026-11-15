import { extname } from 'node:path';

interface AllowedType {
  /** MIME types browsers send for this extension. */
  mimeTypes: string[];
  /** Extensions `file-type` may report for the content. Empty means no signature (plain text). */
  detectedExts: string[];
}

const OOXML = (mime: string, ext: string): AllowedType => ({
  mimeTypes: [mime],
  detectedExts: [ext],
});

export const ALLOWED_TYPES: Record<string, AllowedType> = {
  mp4: { mimeTypes: ['video/mp4'], detectedExts: ['mp4', 'm4v', 'm4a', 'mov'] },
  mov: { mimeTypes: ['video/quicktime'], detectedExts: ['mov', 'mp4'] },
  webm: { mimeTypes: ['video/webm'], detectedExts: ['webm', 'mkv'] },
  mp3: { mimeTypes: ['audio/mpeg', 'audio/mp3'], detectedExts: ['mp3'] },
  m4a: { mimeTypes: ['audio/mp4', 'audio/x-m4a', 'audio/m4a'], detectedExts: ['m4a', 'mp4'] },
  wav: { mimeTypes: ['audio/wav', 'audio/x-wav', 'audio/wave'], detectedExts: ['wav'] },
  pdf: { mimeTypes: ['application/pdf'], detectedExts: ['pdf'] },
  docx: OOXML('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx'),
  xlsx: OOXML('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx'),
  pptx: OOXML('application/vnd.openxmlformats-officedocument.presentationml.presentation', 'pptx'),
  txt: { mimeTypes: ['text/plain'], detectedExts: [] },
};

export const ALLOWED_EXTENSIONS = Object.keys(ALLOWED_TYPES);

export function getExtension(filename: string): string {
  return extname(filename).slice(1).toLowerCase();
}

/** Cheap first filter on client-supplied data. Not a security control. */
export function isAllowedByNameAndMime(filename: string, mimeType: string): boolean {
  const allowed = ALLOWED_TYPES[getExtension(filename)];
  return !!allowed && allowed.mimeTypes.includes(mimeType.toLowerCase());
}

/** Checks the content-derived extension (from `file-type`) against the claimed extension. */
export function matchesContent(filename: string, detectedExt: string | undefined): boolean {
  const allowed = ALLOWED_TYPES[getExtension(filename)];
  if (!allowed) return false;
  if (allowed.detectedExts.length === 0) return detectedExt === undefined;
  return detectedExt !== undefined && allowed.detectedExts.includes(detectedExt);
}

export function describeAllowedTypes(): string {
  return ALLOWED_EXTENSIONS.join(', ');
}
