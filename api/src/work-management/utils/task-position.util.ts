import { MIN_GAP, POSITION_STEP } from '../../common/constants';

export type Positioned = { id: string; position: number };

/**
 * Next position at the end of a list (top-level tasks only).
 */
export function nextPosition(maxPosition: number | null | undefined): number {
  return (maxPosition ?? 0) + POSITION_STEP;
}

/**
 * Mid-point between `after` and the next item.
 * Returns null when gap is below MIN_GAP and renumber is required.
 */
export function midPoint(after: number, next: number | null | undefined): number | null {
  if (next == null) {
    return after + POSITION_STEP;
  }
  if (next - after < MIN_GAP) {
    return null;
  }
  return (after + next) / 2;
}

/**
 * Re-number positions as (i+1) * POSITION_STEP in current order.
 */
export function renumberPositions<T extends Positioned>(items: T[]): Array<T & { position: number }> {
  return items.map((item, index) => ({
    ...item,
    position: (index + 1) * POSITION_STEP,
  }));
}

/**
 * Compute insert position after `afterId` within `ordered` (by position asc).
 * If gap is too small, returns `{ needsRenumber: true }`.
 */
export function positionAfter(
  ordered: Positioned[],
  afterId: string | null | undefined,
): { position: number; needsRenumber: false } | { needsRenumber: true } {
  if (!afterId) {
    const first = ordered[0];
    if (!first) {
      return { position: POSITION_STEP, needsRenumber: false };
    }
    if (first.position < MIN_GAP * 2) {
      return { needsRenumber: true };
    }
    return { position: first.position / 2, needsRenumber: false };
  }

  const index = ordered.findIndex((item) => item.id === afterId);
  if (index < 0) {
    const last = ordered.at(-1);
    return { position: nextPosition(last?.position), needsRenumber: false };
  }

  const after = ordered[index]!;
  const next = ordered[index + 1];
  const mid = midPoint(after.position, next?.position);
  if (mid == null) {
    return { needsRenumber: true };
  }
  return { position: mid, needsRenumber: false };
}
