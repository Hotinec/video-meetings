import { describe, expect, it } from 'vitest';
import { ACCEPT, MAX_UPLOAD_BYTES, validateFile } from './file-rules';

describe('validateFile', () => {
  it.each([
    'a.mp4',
    'a.MOV',
    'a.webm',
    'a.mp3',
    'a.m4a',
    'a.wav',
    'a.pdf',
    'a.docx',
    'a.xlsx',
    'a.pptx',
    'a.txt',
    'two.dots.pdf',
  ])('accepts %s', (name) => {
    expect(validateFile({ name, size: 10 })).toBeNull();
  });

  it.each(['setup.exe', 'noextension', 'archive.zip', 'pdf', '.hidden', 'a.pdf.exe'])(
    'rejects %s by type',
    (name) => {
      expect(validateFile({ name, size: 10 })).toMatch(/File type not allowed. Allowed types: mp4/);
    },
  );

  it('accepts a file exactly at the limit and rejects one byte over', () => {
    expect(validateFile({ name: 'a.mp4', size: MAX_UPLOAD_BYTES })).toBeNull();
    expect(validateFile({ name: 'a.mp4', size: MAX_UPLOAD_BYTES + 1 })).toBe(
      'File is too large. Maximum size is 100 MB',
    );
  });

  it('checks the type before the size', () => {
    expect(validateFile({ name: 'a.exe', size: MAX_UPLOAD_BYTES + 1 })).toMatch(/type not allowed/);
  });

  it('builds the accept attribute from the allowlist', () => {
    expect(ACCEPT).toBe('.mp4,.mov,.webm,.mp3,.m4a,.wav,.pdf,.docx,.xlsx,.pptx,.txt');
  });
});
