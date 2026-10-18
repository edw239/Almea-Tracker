import { describe, expect, it } from 'vitest';
import {
  TOUCH_AXIS_LOCK_THRESHOLD_PX,
  clampVelocity,
  decayVelocity,
  detectTouchScrollAxis,
  shouldStopCoast,
} from './horizontal-touch-scroll.util';

describe('detectTouchScrollAxis', () => {
  it('stays undecided inside the dead-zone', () => {
    expect(detectTouchScrollAxis(3, 2)).toBe('none');
    expect(detectTouchScrollAxis(0, 0)).toBe('none');
  });

  it('locks horizontal when dx dominates past the threshold', () => {
    expect(detectTouchScrollAxis(TOUCH_AXIS_LOCK_THRESHOLD_PX, 2)).toBe('horizontal');
    expect(detectTouchScrollAxis(-20, 8)).toBe('horizontal');
  });

  it('locks vertical when dy dominates past the threshold', () => {
    expect(detectTouchScrollAxis(2, TOUCH_AXIS_LOCK_THRESHOLD_PX)).toBe('vertical');
    expect(detectTouchScrollAxis(8, -20)).toBe('vertical');
  });

  it('prefers horizontal on a tie', () => {
    expect(detectTouchScrollAxis(12, 12)).toBe('horizontal');
  });
});

describe('decayVelocity', () => {
  it('leaves velocity unchanged for non-positive dt or friction', () => {
    expect(decayVelocity(1, 3, 0)).toBe(1);
    expect(decayVelocity(1, 0, 16)).toBe(1);
  });

  it('reduces magnitude over time', () => {
    const next = decayVelocity(1, 3.2, 100);
    expect(next).toBeGreaterThan(0);
    expect(next).toBeLessThan(1);
  });
});

describe('clampVelocity / shouldStopCoast', () => {
  it('clamps runaway flings', () => {
    expect(clampVelocity(10, 2.5)).toBe(2.5);
    expect(clampVelocity(-10, 2.5)).toBe(-2.5);
  });

  it('stops coast below the minimum', () => {
    expect(shouldStopCoast(0.01)).toBe(true);
    expect(shouldStopCoast(0.2)).toBe(false);
  });
});
