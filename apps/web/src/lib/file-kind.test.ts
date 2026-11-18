import { describe, expect, it } from 'vitest';
import { fileKind } from './file-kind';

describe('fileKind', () => {
  it.each([
    ['video/mp4', 'a.mp4', 'video'],
    ['video/quicktime', 'a.MOV', 'video'],
    ['video/webm', 'a.webm', 'video'],
    ['audio/mpeg', 'a.mp3', 'audio'],
    ['audio/mp4', 'a.m4a', 'audio'],
    ['audio/wav', 'a.wav', 'audio'],
    ['application/pdf', 'a.pdf', 'pdf'],
    [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'a.docx',
      'document',
    ],
    ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'a.xlsx', 'spreadsheet'],
    [
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'a.pptx',
      'presentation',
    ],
    ['text/plain', 'a.txt', 'text'],
  ])('%s / %s -> %s', (mime, name, kind) => {
    expect(fileKind(mime, name)).toBe(kind);
  });

  it('trusts the extension over a misleading MIME type', () => {
    expect(fileKind('application/octet-stream', 'minutes.pdf')).toBe('pdf');
  });

  it('falls back to the MIME type when the extension is unknown', () => {
    expect(fileKind('video/x-matroska', 'a.mkv')).toBe('video');
    expect(fileKind('audio/ogg', 'a')).toBe('audio');
    expect(fileKind('application/pdf', 'noext')).toBe('pdf');
  });

  it('uses the generic icon for anything else', () => {
    expect(fileKind('application/zip', 'a.zip')).toBe('other');
    expect(fileKind('', '')).toBe('other');
  });
});
