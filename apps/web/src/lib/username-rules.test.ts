import { describe, expect, it } from 'vitest';
import {
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_PATTERN,
  USERNAME_RULE_MESSAGE,
} from './username-rules';

describe('username rules', () => {
  it('mirrors the API bounds', () => {
    expect(USERNAME_MIN_LENGTH).toBe(3);
    expect(USERNAME_MAX_LENGTH).toBe(30);
  });

  it.each(['abc', 'Bob_1', 'a-b', 'x'.repeat(30)])('accepts %j', (name) => {
    expect(USERNAME_PATTERN.test(name)).toBe(true);
  });

  it.each(['ab', 'a!c', 'has space', 'x'.repeat(31), ''])('rejects %j', (name) => {
    expect(USERNAME_PATTERN.test(name)).toBe(false);
  });

  it('builds the message from the constants', () => {
    expect(USERNAME_RULE_MESSAGE).toBe('Use 3–30 characters: letters, digits, _ or -.');
  });
});
