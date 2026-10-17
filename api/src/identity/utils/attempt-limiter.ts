/**
 * In-memory attempt counter for password change.
 * Single-instance only; multi-instance needs Redis / @nestjs/throttler.
 */
export class AttemptLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly maxAttempts: number,
    private readonly windowMs: number,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** @returns false if the key is over the limit */
  tryConsume(key: string): boolean {
    const now = this.now();
    const row = this.hits.get(key);
    if (!row || now >= row.resetAt) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    if (row.count >= this.maxAttempts) {
      return false;
    }
    row.count += 1;
    return true;
  }

  reset(key: string): void {
    this.hits.delete(key);
  }
}
