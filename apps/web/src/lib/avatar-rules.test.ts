import { describe, expect, it } from 'vitest';
import { MAX_AVATAR_BYTES, validateAvatar } from './avatar-rules';

describe('validateAvatar', () => {
  it.each(['image/jpeg', 'image/png', 'image/webp'])('accepts %s', (type) => {
    expect(validateAvatar({ type, size: 1000 })).toBeNull();
  });
  it('rejects other types', () => {
    expect(validateAvatar({ type: 'image/gif', size: 1000 })).toMatch(/type not allowed/i);
  });
  it('rejects files over 5 MB but accepts exactly 5 MB', () => {
    expect(validateAvatar({ type: 'image/png', size: MAX_AVATAR_BYTES })).toBeNull();
    expect(validateAvatar({ type: 'image/png', size: MAX_AVATAR_BYTES + 1 })).toMatch(/too large/i);
  });
});
