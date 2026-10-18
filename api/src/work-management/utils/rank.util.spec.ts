import { compareRank, rankAfter, rankBetween, RankOrderError } from './rank.util';

/** Same shape as the J0 SQL backfill: 'U' + 8 hex digits. */
function sqlRank(n: number): string {
  return `U${n.toString(16).padStart(8, '0')}`;
}

describe('rankBetween', () => {
  it('starts at the midpoint when both bounds are open', () => {
    expect(rankBetween(null, null)).toBe('V');
  });

  it('inserts between adjacent SQL backfill keys', () => {
    const left = sqlRank(1);
    const right = sqlRank(2);
    const mid = rankBetween(left, right);
    expect(compareRank(left, mid)).toBeLessThan(0);
    expect(compareRank(mid, right)).toBeLessThan(0);
  });

  it('keeps producing a key between two equal-gap ranks', () => {
    let left = sqlRank(1);
    const right = sqlRank(2);
    for (let step = 0; step < 8; step += 1) {
      const mid = rankBetween(left, right);
      expect(compareRank(left, mid)).toBeLessThan(0);
      expect(compareRank(mid, right)).toBeLessThan(0);
      left = mid;
    }
  });

  it('rejects reversed bounds', () => {
    expect(() => rankBetween(sqlRank(2), sqlRank(1))).toThrow(RankOrderError);
  });
});

describe('rankAfter', () => {
  it('steps the SQL sequence forward', () => {
    expect(rankAfter(sqlRank(1))).toBe(sqlRank(2));
    expect(compareRank(sqlRank(1), rankAfter(sqlRank(1)))).toBeLessThan(0);
  });

  it('appends a midpoint when the key is all max digits', () => {
    const max = 'z';
    const next = rankAfter(max);
    expect(compareRank(max, next)).toBeLessThan(0);
  });

  it('uses the midpoint for the first task', () => {
    expect(rankAfter(null)).toBe('V');
  });
});
