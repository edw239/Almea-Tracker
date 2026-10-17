import { AttemptLimiter } from './attempt-limiter';

describe('AttemptLimiter', () => {
  it('allows up to maxAttempts within the window', () => {
    let now = 1_000;
    const limiter = new AttemptLimiter(3, 60_000, () => now);
    expect(limiter.tryConsume('u1')).toBe(true);
    expect(limiter.tryConsume('u1')).toBe(true);
    expect(limiter.tryConsume('u1')).toBe(true);
    expect(limiter.tryConsume('u1')).toBe(false);
  });

  it('resets after the window', () => {
    let now = 1_000;
    const limiter = new AttemptLimiter(1, 100, () => now);
    expect(limiter.tryConsume('u1')).toBe(true);
    expect(limiter.tryConsume('u1')).toBe(false);
    now = 1_200;
    expect(limiter.tryConsume('u1')).toBe(true);
  });

  it('reset clears a key', () => {
    const limiter = new AttemptLimiter(1, 60_000);
    expect(limiter.tryConsume('u1')).toBe(true);
    expect(limiter.tryConsume('u1')).toBe(false);
    limiter.reset('u1');
    expect(limiter.tryConsume('u1')).toBe(true);
  });
});
