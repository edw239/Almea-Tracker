import { isValidIanaTimezone } from './timezone.util';

describe('isValidIanaTimezone', () => {
  it('accepts known IANA zones', () => {
    expect(isValidIanaTimezone('Asia/Dubai')).toBe(true);
    expect(isValidIanaTimezone('Europe/Moscow')).toBe(true);
    expect(isValidIanaTimezone('UTC')).toBe(true);
    expect(isValidIanaTimezone('Etc/UTC')).toBe(true);
  });

  it('rejects empty and garbage', () => {
    expect(isValidIanaTimezone('')).toBe(false);
    expect(isValidIanaTimezone('Not/AZone')).toBe(false);
    expect(isValidIanaTimezone('GMT+4')).toBe(false);
  });
});
