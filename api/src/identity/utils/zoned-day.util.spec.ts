import { startOfZonedDay, summaryDayBounds, zonedDayStartUtc } from './zoned-day.util';

describe('zoned-day', () => {
  it('resolves Asia/Dubai midnight for a known UTC instant', () => {
    // 2026-08-18 20:00 UTC = 2026-08-19 00:00 Dubai
    const now = new Date('2026-08-18T20:30:00.000Z');
    const start = startOfZonedDay(now, 'Asia/Dubai');
    expect(start.toISOString()).toBe('2026-08-18T20:00:00.000Z');
  });

  it('resolves UTC midnight', () => {
    const now = new Date('2026-08-18T15:00:00.000Z');
    const start = startOfZonedDay(now, 'UTC');
    expect(start.toISOString()).toBe('2026-08-18T00:00:00.000Z');
  });

  it('summaryDayBounds spans today and 7 days', () => {
    const now = new Date('2026-08-18T10:00:00.000Z');
    const bounds = summaryDayBounds(now, 'UTC');
    expect(bounds.todayStart.toISOString()).toBe('2026-08-18T00:00:00.000Z');
    expect(bounds.tomorrowStart.toISOString()).toBe('2026-08-19T00:00:00.000Z');
    expect(bounds.weekEnd.toISOString()).toBe('2026-08-25T00:00:00.000Z');
  });

  it('zonedDayStartUtc matches startOfZonedDay', () => {
    const a = zonedDayStartUtc(2026, 8, 18, 'Europe/Moscow');
    const b = startOfZonedDay(new Date('2026-08-18T12:00:00.000Z'), 'Europe/Moscow');
    expect(a.getTime()).toBe(b.getTime());
  });
});
