import { ScheduleFrequency } from '@prisma/client';
import {
  computeNextRunAt,
  schedulePeriodKey,
  zonedAtMinuteUtc,
} from './schedule-timing.util';

describe('schedule-timing.util', () => {
  it('builds daily / weekly / monthly period keys in timezone', () => {
    // 2026-08-19 12:00 UTC = 16:00 Asia/Dubai
    const at = new Date('2026-08-19T12:00:00.000Z');
    expect(schedulePeriodKey(at, ScheduleFrequency.DAILY, 'Asia/Dubai')).toBe('2026-08-19');
    expect(schedulePeriodKey(at, ScheduleFrequency.MONTHLY, 'Asia/Dubai')).toBe('2026-08');
    expect(schedulePeriodKey(at, ScheduleFrequency.WEEKLY, 'Asia/Dubai')).toBe('2026-W34');
  });

  it('does not double-fire across Europe/Berlin spring DST', () => {
    // 2026-03-29 01:00 CET → clocks jump to 03:00 CEST
    const before = new Date('2026-03-28T22:00:00.000Z');
    const first = computeNextRunAt(
      before,
      {
        frequency: ScheduleFrequency.DAILY,
        atMinute: 2 * 60 + 30,
        timezone: 'Europe/Berlin',
      },
      { inclusive: true },
    );
    const second = computeNextRunAt(
      first,
      {
        frequency: ScheduleFrequency.DAILY,
        atMinute: 2 * 60 + 30,
        timezone: 'Europe/Berlin',
      },
      { inclusive: false },
    );
    expect(schedulePeriodKey(first, ScheduleFrequency.DAILY, 'Europe/Berlin')).not.toBe(
      schedulePeriodKey(second, ScheduleFrequency.DAILY, 'Europe/Berlin'),
    );
    const gapHours = (second.getTime() - first.getTime()) / 3_600_000;
    expect(gapHours).toBeGreaterThan(20);
    expect(gapHours).toBeLessThan(28);
  });

  it('resolves weekly Monday slot after a Sunday reference', () => {
    const sunday = new Date('2026-08-16T12:00:00.000Z');
    const next = computeNextRunAt(
      sunday,
      {
        frequency: ScheduleFrequency.WEEKLY,
        byWeekday: 1,
        atMinute: 9 * 60,
        timezone: 'Asia/Dubai',
      },
      { inclusive: true },
    );
    expect(schedulePeriodKey(next, ScheduleFrequency.WEEKLY, 'Asia/Dubai')).toBe('2026-W34');
    const local = zonedAtMinuteUtc(2026, 8, 17, 9 * 60, 'Asia/Dubai');
    expect(next.getTime()).toBe(local.getTime());
  });
});
