export const AUTH_COOKIE_NAME = 'almea_access';
export const AUTH_COOKIE_PATH = '/';

const DURATION = /^(\d+)(s|m|h|d)$/;

const UNIT_SECONDS = {
  s: 1,
  m: 60,
  h: 3600,
  d: 86400,
} as const;

export function parseDurationToSeconds(value: string): number {
  const match = DURATION.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid duration "${value}". Use e.g. 8h, 30m, 7d`);
  }
  const amount = Number(match[1]);
  const unit = match[2] as keyof typeof UNIT_SECONDS;
  return amount * UNIT_SECONDS[unit];
}
