import { describe, expect, it, vi } from 'vitest'
import { createSidebarIdleController } from './sidebar-idle'

function fakeScheduler() {
  let nextId = 1
  const pending = new Map<number, { fn: () => void; ms: number }>()
  let now = 0
  return {
    scheduler: {
      setTimeout: (fn: () => void, ms: number) => {
        const id = nextId++
        pending.set(id, { fn, ms: now + ms })
        return id as unknown as ReturnType<typeof setTimeout>
      },
      clearTimeout: (handle: ReturnType<typeof setTimeout>) => {
        pending.delete(handle as unknown as number)
      },
    },
    flush: (advanceMs: number) => {
      now += advanceMs
      for (const [id, job] of [...pending.entries()]) {
        if (job.ms <= now) {
          pending.delete(id)
          job.fn()
        }
      }
    },
    pendingCount: () => pending.size,
  }
}

describe('createSidebarIdleController', () => {
  it('collapses after idle when unpinned and expanded', () => {
    const onCollapse = vi.fn()
    const { scheduler, flush } = fakeScheduler()
    const ctrl = createSidebarIdleController(onCollapse, scheduler, 1000)
    ctrl.sync({ pinned: false, collapsed: false })
    flush(1000)
    expect(onCollapse).toHaveBeenCalledTimes(1)
    ctrl.dispose()
  })

  it('does not collapse when pinned', () => {
    const onCollapse = vi.fn()
    const { scheduler, flush } = fakeScheduler()
    const ctrl = createSidebarIdleController(onCollapse, scheduler, 1000)
    ctrl.sync({ pinned: true, collapsed: false })
    flush(1000)
    expect(onCollapse).not.toHaveBeenCalled()
    ctrl.dispose()
  })

  it('defers collapse on engage then restarts on idle', () => {
    const onCollapse = vi.fn()
    const { scheduler, flush } = fakeScheduler()
    const ctrl = createSidebarIdleController(onCollapse, scheduler, 1000)
    ctrl.sync({ pinned: false, collapsed: false })
    flush(500)
    ctrl.markEngaged()
    flush(1000)
    expect(onCollapse).not.toHaveBeenCalled()
    ctrl.markIdle()
    flush(1000)
    expect(onCollapse).toHaveBeenCalledTimes(1)
    ctrl.dispose()
  })

  it('does not schedule when already collapsed', () => {
    const onCollapse = vi.fn()
    const { scheduler, flush, pendingCount } = fakeScheduler()
    const ctrl = createSidebarIdleController(onCollapse, scheduler, 1000)
    ctrl.sync({ pinned: false, collapsed: true })
    expect(pendingCount()).toBe(0)
    flush(1000)
    expect(onCollapse).not.toHaveBeenCalled()
    ctrl.dispose()
  })
})
