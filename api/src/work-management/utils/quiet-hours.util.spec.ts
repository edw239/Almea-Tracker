import {
  isInQuietHours,
  minutesInTimezone,
  quietHoursEndUtc,
} from './quiet-hours.util';

describe('quiet-hours', () => {
  it('detects window within the same day', () => {
    // 2026-08-18 10:30 UTC → Asia/Dubai 14:30 (870)
    const noonIsh = new Date('2026-08-18T10:30:00.000Z');
    expect(minutesInTimezone(noonIsh, 'Asia/Dubai')).toBe(14 * 60 + 30);
    expect(isInQuietHours(noonIsh, 'Asia/Dubai', 14 * 60, 16 * 60)).toBe(true);
    expect(isInQuietHours(noonIsh, 'Asia/Dubai', 16 * 60, 18 * 60)).toBe(false);
  });

  it('handles overnight window', () => {
    const late = new Date('2026-08-18T19:00:00.000Z'); // Dubai 23:00
    const early = new Date('2026-08-18T01:00:00.000Z'); // Dubai 05:00
    const mid = new Date('2026-08-18T08:00:00.000Z'); // Dubai 12:00
    expect(isInQuietHours(late, 'Asia/Dubai', 22 * 60, 7 * 60)).toBe(true);
    expect(isInQuietHours(early, 'Asia/Dubai', 22 * 60, 7 * 60)).toBe(true);
    expect(isInQuietHours(mid, 'Asia/Dubai', 22 * 60, 7 * 60)).toBe(false);
  });

  it('quietHoursEndUtc lands on local `to`', () => {
    const now = new Date('2026-08-18T10:00:00.000Z'); // Dubai 14:00
    const end = quietHoursEndUtc(now, 'Asia/Dubai', 16 * 60);
    expect(minutesInTimezone(end, 'Asia/Dubai')).toBe(16 * 60);
    expect(end.getTime()).toBeGreaterThan(now.getTime());
  });

  it('disabled when from/to null or equal', () => {
    const now = new Date();
    expect(isInQuietHours(now, 'UTC', null, 10)).toBe(false);
    expect(isInQuietHours(now, 'UTC', 10, 10)).toBe(false);
  });
});
