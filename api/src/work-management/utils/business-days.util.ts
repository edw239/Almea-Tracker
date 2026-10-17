import { startOfZonedDay } from '../../identity/utils/zoned-day.util';

function weekdayInZone(instant: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
  });
  const label = formatter.format(instant);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const day = map[label];
  if (day === undefined) {
    throw new Error(`Unexpected weekday label: ${label}`);
  }
  return day;
}

function isWeekendInZone(instant: Date, timeZone: string): boolean {
  const day = weekdayInZone(instant, timeZone);
  return day === 0 || day === 6;
}

/**
 * UTC instant of local midnight that is `days` business days before the
 * start of `now`'s calendar day in `timeZone`. Weekends (Sat/Sun) are skipped.
 */
export function businessDaysAgo(now: Date, days: number, timeZone: string): Date {
  if (!Number.isInteger(days) || days < 0) {
    throw new Error('days must be a non-negative integer');
  }
  let cursor = startOfZonedDay(now, timeZone, 0);
  let remaining = days;
  let guard = 0;
  while (remaining > 0) {
    cursor = startOfZonedDay(cursor, timeZone, -1);
    if (!isWeekendInZone(cursor, timeZone)) {
      remaining -= 1;
    }
    guard += 1;
    if (guard > days + 14) {
      throw new Error('businessDaysAgo exceeded safety bound');
    }
  }
  return cursor;
}

export { weekdayInZone, isWeekendInZone };
