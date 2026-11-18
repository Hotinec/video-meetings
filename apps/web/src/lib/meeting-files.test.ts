import { describe, expect, it } from 'vitest';
import { downloadUrl, formatFileSize } from './meeting-files';

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
