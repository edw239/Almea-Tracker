/**
 * Calendar-day bounds in an IANA timezone, expressed as UTC instants.
 */

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function zonedParts(date: Date, timeZone: string): ZonedParts {
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

/** UTC instant for local Y-M-D 00:00:00 in `timeZone`. */
export function zonedDayStartUtc(year: number, month: number, day: number, timeZone: string): Date {
  let utcMs = Date.UTC(year, month - 1, day, 0, 0, 0);
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
    const wanted = Date.UTC(year, month - 1, day, 0, 0, 0);
    utcMs += wanted - asUtc;
  }
  return new Date(utcMs);
}

/** Start of the calendar day containing `now` in `timeZone`, plus `dayOffset` days. */
export function startOfZonedDay(now: Date, timeZone: string, dayOffset = 0): Date {
  const parts = zonedParts(now, timeZone);
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + dayOffset));
  return zonedDayStartUtc(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth() + 1,
    shifted.getUTCDate(),
    timeZone,
  );
}

export type SummaryDayBounds = {
  todayStart: Date;
  tomorrowStart: Date;
  weekEnd: Date;
};

export function summaryDayBounds(now: Date, timeZone: string): SummaryDayBounds {
  const todayStart = startOfZonedDay(now, timeZone, 0);
  const tomorrowStart = startOfZonedDay(now, timeZone, 1);
  const weekEnd = startOfZonedDay(now, timeZone, 7);
  return { todayStart, tomorrowStart, weekEnd };
}
