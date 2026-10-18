export const RANK_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

const BASE = RANK_ALPHABET.length;
const MID = RANK_ALPHABET[Math.floor(BASE / 2)] ?? 'V';
const RANK_LIMIT = 48;

export class RankOrderError extends Error {
  constructor() {
    super('Rank bounds are out of order');
    this.name = 'RankOrderError';
  }
}

function charIndex(char: string): number {
  const index = RANK_ALPHABET.indexOf(char);
  if (index < 0) {
    throw new RankOrderError();
  }
  return index;
}

/** Binary order, matching PostgreSQL COLLATE "C" for this ASCII alphabet. */
export function compareRank(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

/**
 * A string strictly between `before` and `after`.
 * Null bound means the open end of the order.
 */
export function rankBetween(before: string | null, after: string | null): string {
  if (before !== null && after !== null && compareRank(before, after) >= 0) {
    throw new RankOrderError();
  }
  if (before === null && after === null) {
    return MID;
  }
  const left = before ?? '';
  let prefix = '';
  let index = 0;
  while (prefix.length < RANK_LIMIT) {
    const leftCode = index < left.length ? charIndex(left[index]!) : 0;
    const rightCode =
      after == null ? BASE : index < after.length ? charIndex(after[index]!) : BASE;
    if (rightCode - leftCode > 1) {
      const mid = leftCode + Math.floor((rightCode - leftCode) / 2);
      return prefix + RANK_ALPHABET[mid];
    }
    prefix += RANK_ALPHABET[leftCode] ?? MID;
    index += 1;
  }
  throw new RankOrderError();
}

/** Next rank after `rank`. Does not collide with rankAfter of a different key. */
export function rankAfter(rank: string | null): string {
  if (!rank) return MID;
  const chars = [...rank];
  for (let index = chars.length - 1; index >= 0; index -= 1) {
    const code = charIndex(chars[index]!);
    if (code < BASE - 1) {
      chars[index] = RANK_ALPHABET[code + 1]!;
      return chars.slice(0, index + 1).join('');
    }
  }
  return rank + MID;
}
