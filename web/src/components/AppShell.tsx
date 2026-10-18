import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useEffect, useRef, useState, type ReactElement } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth'
import { useInboxPolling } from '../hooks/useInboxPolling'
import { Menu, X } from '../lib/icons'
import { parseListDropId } from '../lib/mechanics'
import { useStore } from '../store'
import { BrandMark } from './BrandMark'
import { ScrollToTopButton } from './ScrollToTopButton'
import { GlobalSearch } from './layout/GlobalSearch'
import { NotificationInbox } from './layout/NotificationInbox'
import { Sidebar } from './layout/Sidebar'
import { TopBar } from './layout/TopBar'
import { UserMenu } from './layout/UserMenu'

export function AppShell(): ReactElement | null {
  const store = useStore()
  const auth = useAuth()
  const user = auth.user
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const mainRef = useRef<HTMLElement>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 10 } }))

  useInboxPolling()

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  if (!user) return null

  const onDragEnd = (event: DragEndEvent): void => {
    const overId = event.over?.id
    if (overId == null) return
    const targetListId = parseListDropId(String(overId))
    if (!targetListId) return
    const taskId = String(event.active.id)
    void store.moveTask(taskId, null, targetListId)
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="flex min-h-screen flex-col bg-base md:flex-row">
        <div className="z-50 flex items-center justify-between gap-2 border-b border-border bg-base p-3.5 md:hidden">
          <BrandMark />
          <div className="flex shrink-0 items-center gap-1">
            <GlobalSearch compact />
            <NotificationInbox />
            <UserMenu />
            <button
              type="button"
              onClick={() => setMobileOpen((value) => !value)}
              aria-label="Меню"
              aria-expanded={mobileOpen}
              className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-inset hover:text-foreground"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {mobileOpen ? (
          <button
            type="button"
            aria-label="Закрыть меню"
            className="fixed inset-0 z-40 bg-foreground/40 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        ) : null}

        <Sidebar
          mobileOpen={mobileOpen}
          onNavigate={() => setMobileOpen(false)}
          showUserFoot={false}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main
            ref={mainRef}
            className="scrollbar-subtle flex-1 overflow-y-auto p-5 sm:px-8 sm:py-7 lg:px-9 lg:py-8"
          >
            <div key={location.pathname} className="page-enter motion-reduce:animate-none">
              {!store.ready ? (
                <div className="text-sm text-muted-foreground">Загрузка данных…</div>
              ) : (
                <Outlet />
              )}
            </div>
          </main>
          <ScrollToTopButton scrollContainerRef={mainRef} />
        </div>
      </div>
    </DndContext>
  )
}
