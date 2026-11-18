import { describe, expect, it } from 'vitest';
import { parseMeetingId } from './meeting-id';

describe('parseMeetingId', () => {
  it.each([
    ['7', 7],
    ['0', 0],
    ['2147483647', 2147483647],
  ])('%s -> %i', (raw, id) => {
    expect(parseMeetingId(raw)).toBe(id);
  });

  it.each(['', 'abc', '-1', '1.5', '7/files', ' 7', '2147483648', '99999999999'])(
    'rejects %j',
    (raw) => {
      expect(parseMeetingId(raw)).toBeNull();
    },
  );
});
