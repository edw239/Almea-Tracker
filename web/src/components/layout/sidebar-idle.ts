import { SIDEBAR_IDLE_COLLAPSE_MS } from './sidebar-prefs'

export type TimerHandle = ReturnType<typeof setTimeout>

export interface IdleScheduler {
  setTimeout: (fn: () => void, ms: number) => TimerHandle
  clearTimeout: (handle: TimerHandle) => void
}

export interface SidebarIdleController {
  markEngaged: () => void
  markIdle: () => void
  /** Call when pinned/mode prefs change. */
  sync: (opts: { pinned: boolean; collapsed: boolean }) => void
  dispose: () => void
}

/**
 * Pure controller for unpinned idle auto-collapse. Timer injection keeps it unit-testable.
 */
/** Bound wrappers — bare `{ setTimeout }` loses `window` and throws Illegal invocation. */
const defaultScheduler: IdleScheduler = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (handle) => globalThis.clearTimeout(handle),
}

export function createSidebarIdleController(
  onCollapse: () => void,
  scheduler: IdleScheduler = defaultScheduler,
  idleMs = SIDEBAR_IDLE_COLLAPSE_MS,
): SidebarIdleController {
  let timer: TimerHandle | null = null
  let engaged = false
  let pinned = false
  let collapsed = false

  const clear = (): void => {
    if (timer != null) {
      scheduler.clearTimeout(timer)
      timer = null
    }
  }

  const schedule = (): void => {
    clear()
    if (pinned || collapsed || engaged) return
    timer = scheduler.setTimeout(() => {
      timer = null
      if (pinned || collapsed || engaged) return
      onCollapse()
    }, idleMs)
  }

  return {
    markEngaged: () => {
      engaged = true
      clear()
    },
    markIdle: () => {
      engaged = false
      schedule()
    },
    sync: (opts) => {
      pinned = opts.pinned
      collapsed = opts.collapsed
      if (pinned || collapsed) clear()
      else if (!engaged) schedule()
    },
    dispose: clear,
  }
}
