import { useEffect, useRef, type RefObject } from 'react';
import {
  TOUCH_AXIS_LOCK_THRESHOLD_PX,
  TOUCH_BRAKE_FRICTION,
  TOUCH_COAST_FRICTION,
  clampVelocity,
  decayVelocity,
  detectTouchScrollAxis,
  shouldStopCoast,
  type TouchScrollAxis,
} from './horizontal-touch-scroll.util';

interface GestureState {
  axis: TouchScrollAxis;
  originX: number;
  originY: number;
  lastX: number;
  lastT: number;
  velocityPxPerMs: number;
}

/**
 * Touch handling for a horizontal board/funnel strip nested in a vertical page:
 * - first gesture that reads as horizontal locks the page in place and pans the strip
 *   even if the finger drifts up/down;
 * - on release the strip coasts with gradual deceleration;
 * - a second touch while coasting lets the page scroll and brakes the strip smoothly.
 */
export function useAxisLockedHorizontalScroll<T extends HTMLElement>(): RefObject<T | null> {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (node == null) {
      return;
    }
    const el: T = node;

    let gesture: GestureState | null = null;
    let coastRaf = 0;
    let coastVelocity = 0;
    let coastLastT = 0;
    let coastFriction = TOUCH_COAST_FRICTION;
    let reducedMotion = false;

    const motionQuery =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;

    function syncReducedMotion(): void {
      reducedMotion = motionQuery?.matches ?? false;
    }

    syncReducedMotion();
    motionQuery?.addEventListener('change', syncReducedMotion);

    function cancelCoast(): void {
      if (coastRaf !== 0) {
        cancelAnimationFrame(coastRaf);
        coastRaf = 0;
      }
      coastVelocity = 0;
    }

    function stepCoast(now: number): void {
      if (coastVelocity === 0) {
        coastRaf = 0;
        return;
      }
      const dt = Math.min(32, Math.max(0, now - coastLastT));
      coastLastT = now;
      coastVelocity = decayVelocity(coastVelocity, coastFriction, dt);
      if (shouldStopCoast(coastVelocity)) {
        cancelCoast();
        return;
      }
      el.scrollLeft -= coastVelocity * dt;
      const atStart = coastVelocity > 0 && el.scrollLeft <= 0;
      const atEnd = coastVelocity < 0 && el.scrollLeft + el.clientWidth >= el.scrollWidth - 0.5;
      if (atStart || atEnd) {
        cancelCoast();
        return;
      }
      coastRaf = requestAnimationFrame(stepCoast);
    }

    function startCoast(velocityPxPerMs: number, friction: number): void {
      cancelCoast();
      if (reducedMotion || shouldStopCoast(velocityPxPerMs)) {
        return;
      }
      coastFriction = friction;
      coastVelocity = clampVelocity(velocityPxPerMs);
      coastLastT = performance.now();
      coastRaf = requestAnimationFrame(stepCoast);
    }

    function onTouchStart(event: TouchEvent): void {
      // Second finger (or any multi-touch): yield the page and brake the strip.
      if (event.touches.length > 1) {
        const velocity = gesture?.axis === 'horizontal' ? gesture.velocityPxPerMs : coastVelocity;
        if (gesture?.axis === 'horizontal' || coastRaf !== 0) {
          startCoast(velocity, TOUCH_BRAKE_FRICTION);
        }
        gesture = null;
        return;
      }

      const touch = event.touches[0];
      if (touch == null) {
        return;
      }

      // Second touch while the strip is still coasting: brake gradually and do
      // not steal the gesture — the page (or a nested column) can scroll.
      if (coastRaf !== 0) {
        startCoast(coastVelocity, TOUCH_BRAKE_FRICTION);
        gesture = null;
        return;
      }

      gesture = {
        axis: 'none',
        originX: touch.clientX,
        originY: touch.clientY,
        lastX: touch.clientX,
        lastT: performance.now(),
        velocityPxPerMs: 0,
      };
    }

    function onTouchMove(event: TouchEvent): void {
      if (gesture == null || event.touches.length !== 1) {
        return;
      }
      const touch = event.touches[0];
      if (touch == null) {
        return;
      }

      if (gesture.axis === 'none') {
        const locked = detectTouchScrollAxis(
          touch.clientX - gesture.originX,
          touch.clientY - gesture.originY,
          TOUCH_AXIS_LOCK_THRESHOLD_PX,
        );
        if (locked === 'none') {
          return;
        }
        gesture.axis = locked;
        if (locked === 'vertical') {
          // Page / nested column owns the gesture; stop tracking.
          gesture = null;
          return;
        }
      }

      if (gesture.axis !== 'horizontal') {
        return;
      }

      // Keep the page still for the whole horizontal gesture, including vertical drift.
      if (event.cancelable) {
        event.preventDefault();
      }

      const now = performance.now();
      const dx = touch.clientX - gesture.lastX;
      const dt = Math.max(1, now - gesture.lastT);
      el.scrollLeft -= dx;
      gesture.velocityPxPerMs = clampVelocity(dx / dt);
      gesture.lastX = touch.clientX;
      gesture.lastT = now;
    }

    function onTouchEnd(): void {
      if (gesture == null) {
        return;
      }
      if (gesture.axis === 'horizontal') {
        startCoast(gesture.velocityPxPerMs, TOUCH_COAST_FRICTION);
      }
      gesture = null;
    }

    function onTouchCancel(): void {
      gesture = null;
      cancelCoast();
    }

    el.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
    el.addEventListener('touchmove', onTouchMove, { capture: true, passive: false });
    el.addEventListener('touchend', onTouchEnd, { capture: true, passive: true });
    el.addEventListener('touchcancel', onTouchCancel, { capture: true, passive: true });

    return () => {
      motionQuery?.removeEventListener('change', syncReducedMotion);
      cancelCoast();
      el.removeEventListener('touchstart', onTouchStart, true);
      el.removeEventListener('touchmove', onTouchMove, true);
      el.removeEventListener('touchend', onTouchEnd, true);
      el.removeEventListener('touchcancel', onTouchCancel, true);
    };
  }, []);

  return ref;
}
