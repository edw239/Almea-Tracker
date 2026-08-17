import { parseDurationToSeconds } from './auth.constants';

describe('parseDurationToSeconds', () => {
  it('parses hours and days', () => {
    expect(parseDurationToSeconds('8h')).toBe(8 * 3600);
    expect(parseDurationToSeconds('7d')).toBe(7 * 86400);
  });

  it('rejects unknown units', () => {
    expect(() => parseDurationToSeconds('8hours')).toThrow(/Invalid duration/);
  });
});
