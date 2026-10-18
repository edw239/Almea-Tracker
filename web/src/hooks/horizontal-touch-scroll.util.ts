/** Dominant axis after the finger leaves a small dead-zone. */
export type TouchScrollAxis = 'none' | 'horizontal' | 'vertical';

/** Pixels of movement before we commit to an axis (filters jitter). */
export const TOUCH_AXIS_LOCK_THRESHOLD_PX = 8;

/** Exponential friction for post-release coast (1/s). */
export const TOUCH_COAST_FRICTION = 3.2;

/** Stronger friction when a second touch interrupts coasting (1/s). */
export const TOUCH_BRAKE_FRICTION = 10;

/** Stop the coast when |velocity| drops below this (px/ms). */
export const TOUCH_COAST_MIN_VELOCITY_PX_PER_MS = 0.04;

/** Clamp swipe velocity so a fling cannot runaway-scroll. */
export const TOUCH_MAX_VELOCITY_PX_PER_MS = 2.5;

export function detectTouchScrollAxis(
  dx: number,
  dy: number,
  thresholdPx: number = TOUCH_AXIS_LOCK_THRESHOLD_PX,
): TouchScrollAxis {
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  if (absX < thresholdPx && absY < thresholdPx) {
    return 'none';
  }
  return absX >= absY ? 'horizontal' : 'vertical';
}

/** Exponential velocity decay for a frame of `dtMs` milliseconds. */
export function decayVelocity(
  velocityPxPerMs: number,
  frictionPerSec: number,
  dtMs: number,
): number {
  if (dtMs <= 0 || frictionPerSec <= 0) {
    return velocityPxPerMs;
  }
  return velocityPxPerMs * Math.exp((-frictionPerSec * dtMs) / 1000);
}

export function clampVelocity(
  velocityPxPerMs: number,
  maxAbs: number = TOUCH_MAX_VELOCITY_PX_PER_MS,
): number {
  if (velocityPxPerMs > maxAbs) return maxAbs;
  if (velocityPxPerMs < -maxAbs) return -maxAbs;
  return velocityPxPerMs;
}

export function shouldStopCoast(
  velocityPxPerMs: number,
  minAbs: number = TOUCH_COAST_MIN_VELOCITY_PX_PER_MS,
): boolean {
  return Math.abs(velocityPxPerMs) < minAbs;
}
