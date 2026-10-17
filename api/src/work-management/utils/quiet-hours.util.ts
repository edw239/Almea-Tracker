/**
 * Quiet hours are minutes from local midnight in the user's IANA timezone (0..1439).
 * Window may wrap past midnight (e.g. 22:00 → 07:00).
 */

export function minutesInTimezone(now: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

export function isInQuietHours(
  now: Date,
  timeZone: string,
  from: number | null | undefined,
  to: number | null | undefined,
): boolean {
  if (from == null || to == null) {
    return false;
  }
  if (from === to) {
    return false;
  }
  const minutes = minutesInTimezone(now, timeZone);
  if (from < to) {
    return minutes >= from && minutes < to;
  }
  return minutes >= from || minutes < to;
}

/** First instant (UTC) when local minutes equal `to`, within the next 24h. */
export function quietHoursEndUtc(now: Date, timeZone: string, to: number): Date {
  for (let step = 1; step <= 24 * 60; step += 1) {
    const candidate = new Date(now.getTime() + step * 60_000);
    if (minutesInTimezone(candidate, timeZone) === to) {
      return candidate;
    }
  }
  return new Date(now.getTime() + 8 * 3600_000);
}
