import { businessDaysAgo, isWeekendInZone, weekdayInZone } from './business-days.util';
import { startOfZonedDay } from '../../identity/utils/zoned-day.util';

describe('businessDaysAgo', () => {
  it('skips weekend when walking 3 business days from Friday', () => {
    // Friday 2026-08-14 12:00 UTC ≈ Friday in UTC
    const friday = new Date('2026-08-14T12:00:00.000Z');
    expect(weekdayInZone(friday, 'UTC')).toBe(5);
    const cutoff = businessDaysAgo(friday, 3, 'UTC');
    // Mon 10, Tue 11, Wed 12 → cutoff = start of Tue 11? 
    // Walk: Fri start → back Thu (1), Wed (2), Tue (3) → Tuesday Aug 11
    expect(cutoff.toISOString()).toBe(startOfZonedDay(new Date('2026-08-11T12:00:00.000Z'), 'UTC').toISOString());
  });

  it('from Saturday still counts only business days', () => {
    const saturday = new Date('2026-08-15T12:00:00.000Z');
    expect(isWeekendInZone(startOfZonedDay(saturday, 'UTC'), 'UTC')).toBe(true);
    const cutoff = businessDaysAgo(saturday, 3, 'UTC');
    // Sat start → Fri(1), Thu(2), Wed(3) → Wednesday Aug 12
    expect(cutoff.toISOString()).toBe(startOfZonedDay(new Date('2026-08-12T12:00:00.000Z'), 'UTC').toISOString());
  });

  it('timezone shifts calendar day boundary', () => {
    // 2026-08-14 22:00 UTC = already Aug 15 in Asia/Dubai (UTC+4)
    const instant = new Date('2026-08-14T22:00:00.000Z');
    const utcToday = startOfZonedDay(instant, 'UTC');
    const dubaiToday = startOfZonedDay(instant, 'Asia/Dubai');
    expect(utcToday.toISOString()).not.toBe(dubaiToday.toISOString());
    const utcCut = businessDaysAgo(instant, 1, 'UTC');
    const dubaiCut = businessDaysAgo(instant, 1, 'Asia/Dubai');
    expect(utcCut.toISOString()).not.toBe(dubaiCut.toISOString());
  });
});
