import { ScheduleFrequency } from '@prisma/client';
import { startOfZonedDay } from '../../identity/utils/zoned-day.util';

type CivilParts = {
  year: number;
  month: number;
  day: number;
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function zonedParts(date: Date, timeZone: string): CivilParts & { hour: number; minute: number; second: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const bag = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour: Number(bag.hour),
    minute: Number(bag.minute),
    second: Number(bag.second),
  };
}

/** Monday=1 … Sunday=7 for a civil Y-M-D. */
export function isoWeekday(year: number, month: number, day: number): number {
  const wd = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return wd === 0 ? 7 : wd;
}

function isoWeekYearWeek(year: number, month: number, day: number): { year: number; week: number } {
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const isoYear = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return { year: isoYear, week };
}

/** Period key for the civil day/week/month containing `at` in `timeZone`. */
export function schedulePeriodKey(
  at: Date,
  frequency: ScheduleFrequency,
  timeZone: string,
): string {
  const parts = zonedParts(at, timeZone);
  if (frequency === ScheduleFrequency.DAILY) {
    return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
  }
  if (frequency === ScheduleFrequency.MONTHLY) {
    return `${parts.year}-${pad2(parts.month)}`;
  }
  const { year, week } = isoWeekYearWeek(parts.year, parts.month, parts.day);
  return `${year}-W${pad2(week)}`;
}

/**
 * UTC instant for local Y-M-D + atMinute in `timeZone`.
 * Iterative correction handles DST gaps/overlaps without inventing a second run.
 */
export function zonedAtMinuteUtc(
  year: number,
  month: number,
  day: number,
  atMinute: number,
  timeZone: string,
): Date {
  const hour = Math.floor(atMinute / 60);
  const minute = atMinute % 60;
  let utcMs = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let i = 0; i < 4; i += 1) {
    const parts = zonedParts(new Date(utcMs), timeZone);
    const asUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    const wanted = Date.UTC(year, month - 1, day, hour, minute, 0);
    utcMs += wanted - asUtc;
  }
  return new Date(utcMs);
}

function dayMatches(
  parts: CivilParts,
  frequency: ScheduleFrequency,
  byWeekday: number | null | undefined,
  byMonthday: number | null | undefined,
): boolean {
  if (frequency === ScheduleFrequency.DAILY) {
    return true;
  }
  if (frequency === ScheduleFrequency.WEEKLY) {
    return byWeekday != null && isoWeekday(parts.year, parts.month, parts.day) === byWeekday;
  }
  return byMonthday != null && parts.day === byMonthday;
}

export type ScheduleTimingInput = {
  frequency: ScheduleFrequency;
  byWeekday?: number | null;
  byMonthday?: number | null;
  atMinute: number;
  timezone: string;
};

/**
 * Next fire time at or after `from` (if inclusive) / strictly after `from`.
 * Scans civil days in schedule timezone so DST does not double or skip a cycle.
 */
export function computeNextRunAt(
  from: Date,
  input: ScheduleTimingInput,
  options: { inclusive?: boolean } = {},
): Date {
  const inclusive = options.inclusive ?? false;
  const maxDays = 400;
  for (let offset = 0; offset < maxDays; offset += 1) {
    const dayStart = startOfZonedDay(from, input.timezone, offset);
    const parts = zonedParts(dayStart, input.timezone);
    if (!dayMatches(parts, input.frequency, input.byWeekday, input.byMonthday)) {
      continue;
    }
    const candidate = zonedAtMinuteUtc(
      parts.year,
      parts.month,
      parts.day,
      input.atMinute,
      input.timezone,
    );
    if (inclusive ? candidate.getTime() >= from.getTime() : candidate.getTime() > from.getTime()) {
      return candidate;
    }
  }
  throw new Error('Unable to compute next schedule run');
}
