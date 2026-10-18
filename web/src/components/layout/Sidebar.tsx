import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactElement } from 'react'
import { useEffect, useId, useRef, useState } from 'react'
import { api } from '../../lib/api'
import { createPortal } from 'react-dom'
import { useDroppable } from '@dnd-kit/core'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth'
import {
  NAV_SECTIONS,
  navPathIsActive,
  navVisibleForRole,
  type NavCounterKey,
  type NavItem,
} from '../../config/navigation'
import { listDropId } from '../../lib/mechanics'
import { ChevronLeft, LogOut, PushPin } from '../../lib/icons'
import { initialsFromName } from '../../lib/format'
import { cn } from '../../lib/utils'
import { useStore } from '../../store'
import { BrandMark } from '../BrandMark'
import { createSidebarIdleController } from './sidebar-idle'
import {
  loadSidebarPrefs,
  resolveSidebarDrag,
  saveSidebarPrefs,
  SIDEBAR_COLLAPSE_DRAG_THRESHOLD_PX,
  SIDEBAR_COLLAPSED_WIDTH_PX,
  SIDEBAR_DEFAULT_EXPANDED_WIDTH_PX,
  SIDEBAR_MAX_EXPANDED_WIDTH_PX,
  SIDEBAR_MIN_EXPANDED_WIDTH_PX,
  sidebarDesktopWidthPx,
  type SidebarMode,
  type SidebarPrefs,
} from './sidebar-prefs'

interface SidebarProps {
  mobileOpen: boolean
  onNavigate: () => void
  /** When true, user chip + logout stay in the foot (until TopBar UserMenu lands). */
  showUserFoot?: boolean
}

interface LoupeState {
  label: string
  icon?: NavItem['icon']
  mark?: string
  top: number
  left: number
  active: boolean
}

function treeInitial(name: string): string {
  const trimmed = name.trim()
  return trimmed ? trimmed[0]!.toLocaleUpperCase('ru-RU') : '·'
}

function SidebarLoupe({ state }: { state: LoupeState | null }): ReactElement | null {
  if (state == null || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="pointer-events-none fixed z-[80] hidden -translate-y-1/2 md:block"
      style={{ top: state.top, left: state.left }}
      role="presentation"
      aria-hidden
    >
      <div
        className={cn(
          'sidebar-loupe flex items-center gap-2.5 rounded-full bg-elevated py-1.5 pl-1.5 pr-4 text-foreground',
          state.active && 'sidebar-loupe--active',
        )}
      >
        <span
          className={cn(
            'sidebar-loupe__lens flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold',
            state.active ? 'bg-primary text-primary-foreground' : 'bg-inset text-foreground',
          )}
        >
          {state.icon ? (
            <state.icon size={20} strokeWidth={1.5} className="shrink-0" />
          ) : (
            (state.mark ?? '·')
          )}
        </span>
        <span className="whitespace-nowrap text-sm font-medium tracking-tight">{state.label}</span>
      </div>
    </div>,
    document.body,
  )
}

function CollapsedNavLink({
  item,
  active,
  count,
  alert,
  onNavigate,
  onLoupe,
}: {
  item: NavItem
  active: boolean
  count?: number
  alert?: boolean
  onNavigate: () => void
  onLoupe: (next: LoupeState | null) => void
}): ReactElement {
  const linkRef = useRef<HTMLAnchorElement>(null)

  const showLoupe = (): void => {
    const el = linkRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const label =
      count != null && count > 0 ? `${item.label} · ${count}` : item.label
    onLoupe({
      label,
      icon: item.icon,
      top: rect.top + rect.height / 2,
      left: rect.right + 10,
      active,
    })
  }

  return (
    <Link
      ref={linkRef}
      to={item.to}
      onClick={onNavigate}
      onMouseEnter={showLoupe}
      onFocus={showLoupe}
      onMouseLeave={() => onLoupe(null)}
      onBlur={() => onLoupe(null)}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex items-center justify-center rounded-full px-2.5 py-2 text-sm transition-colors',
        active
          ? 'bg-primary font-medium text-primary-foreground'
          : 'text-foreground hover:bg-inset',
      )}
    >
      <item.icon size={18} strokeWidth={1.5} className="shrink-0" />
      {count != null && count > 0 ? (
        <span
          className={cn(
            'absolute right-1.5 top-1.5 h-2 w-2 rounded-full',
            alert ? 'bg-accent' : 'bg-primary',
          )}
          aria-hidden
        />
      ) : null}
      <span className="sr-only">{item.label}</span>
    </Link>
  )
}

function ListDropLink({
  listId,
  name,
  nested,
  collapsed,
  onNavigate,
  onLoupe,
}: {
  listId: string
  name: string
  nested?: boolean
  collapsed: boolean
  onNavigate: () => void
  onLoupe: (next: LoupeState | null) => void
}): ReactElement {
  const { setNodeRef, isOver } = useDroppable({ id: listDropId(listId) })
  const linkRef = useRef<HTMLAnchorElement>(null)

  const showLoupe = (): void => {
    if (!collapsed) return
    const el = linkRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    onLoupe({
      label: name,
      mark: treeInitial(name),
      top: rect.top + rect.height / 2,
      left: rect.right + 10,
      active: false,
    })
  }

  return (
    <div ref={setNodeRef} className={isOver ? 'ring-2 ring-accent rounded-full' : undefined}>
      <NavLink
        to={`/lists/${listId}`}
        onClick={onNavigate}
        onMouseEnter={showLoupe}
        onFocus={showLoupe}
        onMouseLeave={() => onLoupe(null)}
        onBlur={() => onLoupe(null)}
        ref={linkRef}
        className={({ isActive }) =>
          cn(
            'flex items-center gap-3 rounded-full px-3 py-2 text-sm transition-colors',
            collapsed && 'justify-center px-2.5',
            nested && !collapsed && 'pl-8',
            isActive
              ? 'bg-primary font-medium text-primary-foreground'
              : 'text-foreground hover:bg-inset',
          )
        }
      >
        <span
          className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-inset text-[10px] font-semibold"
          aria-hidden
        >
          {treeInitial(name)}
        </span>
        {!collapsed ? <span className="truncate">{name}</span> : <span className="sr-only">{name}</span>}
      </NavLink>
    </div>
  )
}

function readCounter(
  summary: { mineOpen?: number; overdue?: number; unread?: number } | null | undefined,
  key: NavCounterKey | undefined,
): number {
  if (!key || !summary) return 0
  return summary[key] ?? 0
}

export function Sidebar({
  mobileOpen,
  onNavigate,
  showUserFoot = true,
}: SidebarProps): ReactElement {
  const { user, logout } = useAuth()
  const store = useStore()
  const [favoriteBoards, setFavoriteBoards] = useState<Array<{ id: string; name: string }>>([])
  useEffect(() => {
    const ids = new Set(
      store.favorites.filter((item) => item.entityType === 'BOARD').map((item) => item.entityId),
    )
    if (ids.size === 0) {
      setFavoriteBoards([])
      return
    }
    void api.boards().then((rows) => {
      setFavoriteBoards(rows.filter((board) => ids.has(board.id)).map((board) => ({ id: board.id, name: board.name })))
    }).catch(() => setFavoriteBoards([]))
  }, [store.favorites])
  const { pathname } = useLocation()
  const [prefs, setPrefs] = useState<SidebarPrefs>(() => loadSidebarPrefs())
  const [loupe, setLoupe] = useState<LoupeState | null>(null)
  const [resizing, setResizing] = useState(false)
  const [dragWidthPx, setDragWidthPx] = useState<number | null>(null)
  const prefsRef = useRef(prefs)
  const dragStartRef = useRef<{ pointerId: number; startX: number; startWidth: number } | null>(
    null,
  )
  const idleRef = useRef(
    createSidebarIdleController(() => {
      setPrefs((prev) => {
        if (prev.pinned || prev.mode === 'collapsed') return prev
        const next: SidebarPrefs = { ...prev, mode: 'collapsed' }
        saveSidebarPrefs(next)
        return next
      })
      setLoupe(null)
    }),
  )
  const pinHintId = useId()
  const role = user?.role ?? 'MEMBER'
  const collapsed = prefs.mode === 'collapsed'
  const desktopWidthPx = dragWidthPx ?? sidebarDesktopWidthPx(prefs)

  const sections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => navVisibleForRole(item, role)),
  })).filter((section) => section.items.length > 0)

  const navTos = sections.flatMap((section) => section.items.map((item) => item.to))
  const itemActive = (item: NavItem): boolean => navPathIsActive(pathname, item.to, navTos)

  const spaces = store.spaces.map((space) => {
    const folders = store.folders.filter((folder) => folder.spaceId === space.id)
    const lists = store.lists.filter((list) => list.spaceId === space.id)
    return { space, folders, lists }
  })

  useEffect(() => {
    prefsRef.current = prefs
    idleRef.current.sync({ pinned: prefs.pinned, collapsed: prefs.mode === 'collapsed' })
  }, [prefs])

  useEffect(() => () => idleRef.current.dispose(), [])

  useEffect(() => {
    if (!resizing) return

    const onMove = (event: PointerEvent): void => {
      const drag = dragStartRef.current
      if (!drag || event.pointerId !== drag.pointerId) return
      const nextWidth = drag.startWidth + (event.clientX - drag.startX)
      setDragWidthPx(
        Math.max(SIDEBAR_COLLAPSED_WIDTH_PX, Math.min(SIDEBAR_MAX_EXPANDED_WIDTH_PX, nextWidth)),
      )
    }

    const finish = (event: PointerEvent): void => {
      const drag = dragStartRef.current
      if (!drag || event.pointerId !== drag.pointerId) return
      const rawWidth = drag.startWidth + (event.clientX - drag.startX)
      const resolved = resolveSidebarDrag(rawWidth)
      const prev = prefsRef.current
      const next: SidebarPrefs =
        resolved.mode === 'collapsed'
          ? { ...prev, mode: 'collapsed' }
          : { ...prev, mode: 'expanded', expandedWidth: resolved.expandedWidth }
      setPrefs(next)
      saveSidebarPrefs(next)
      if (next.mode === 'collapsed') setLoupe(null)
      dragStartRef.current = null
      setDragWidthPx(null)
      setResizing(false)
      document.body.style.removeProperty('cursor')
      document.body.style.removeProperty('user-select')
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
      document.body.style.removeProperty('cursor')
      document.body.style.removeProperty('user-select')
    }
  }, [resizing])

  const setMode = (mode: SidebarMode): void => {
    const next = { ...prefs, mode }
    setPrefs(next)
    saveSidebarPrefs(next)
    if (mode === 'collapsed') setLoupe(null)
  }

  const togglePinned = (): void => {
    const next = { ...prefs, pinned: !prefs.pinned }
    setPrefs(next)
    saveSidebarPrefs(next)
  }

  const toggleMode = (): void => {
    setMode(prefs.mode === 'collapsed' ? 'expanded' : 'collapsed')
  }

  const markEngaged = (): void => {
    idleRef.current.markEngaged()
  }

  const markIdle = (): void => {
    if (resizing) return
    setLoupe(null)
    idleRef.current.markIdle()
  }

  const onResizePointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    markEngaged()
    const startWidth = collapsed ? SIDEBAR_COLLAPSED_WIDTH_PX : prefs.expandedWidth
    dragStartRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth,
    }
    setDragWidthPx(startWidth)
    setResizing(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  const onResizeKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    const step = 16
    let nextWidth = collapsed ? SIDEBAR_COLLAPSED_WIDTH_PX : prefs.expandedWidth
    if (event.key === 'ArrowRight') nextWidth += step
    else if (event.key === 'ArrowLeft') nextWidth -= step
    else if (event.key === 'Home') nextWidth = SIDEBAR_MIN_EXPANDED_WIDTH_PX
    else if (event.key === 'End') nextWidth = SIDEBAR_MAX_EXPANDED_WIDTH_PX
    else return
    event.preventDefault()
    const resolved = resolveSidebarDrag(nextWidth)
    const next: SidebarPrefs =
      resolved.mode === 'collapsed'
        ? { ...prefs, mode: 'collapsed' }
        : { ...prefs, mode: 'expanded', expandedWidth: resolved.expandedWidth }
    setPrefs(next)
    saveSidebarPrefs(next)
  }

  const onResizeDoubleClick = (): void => {
    const next = {
      ...prefs,
      mode: 'expanded' as const,
      expandedWidth: SIDEBAR_DEFAULT_EXPANDED_WIDTH_PX,
    }
    setPrefs(next)
    saveSidebarPrefs(next)
    setLoupe(null)
  }

  const liveCollapsed =
    dragWidthPx != null ? dragWidthPx < SIDEBAR_COLLAPSE_DRAG_THRESHOLD_PX : collapsed

  const initials = user ? initialsFromName(user.name) : '?'

  return (
      <aside
        className={cn(
          'relative z-50 flex flex-shrink-0 flex-col border-r border-border bg-[var(--sidebar)] text-muted-foreground',
          !resizing && 'transition-[width] duration-300 ease-[var(--ease-out)]',
          'fixed inset-y-0 left-0 md:static md:flex',
          mobileOpen ? 'flex' : 'hidden md:flex',
          'w-[var(--sidebar-w)]',
        )}
        style={{ ['--sidebar-w' as string]: `${desktopWidthPx}px` }}
        onPointerEnter={markEngaged}
        onPointerLeave={markIdle}
        onFocusCapture={markEngaged}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            markIdle()
          }
        }}
      >
        <div className="flex items-center px-4 pb-2 pt-5">
          <button
            type="button"
            className={cn(
              'min-w-0 rounded-lg text-left outline-none transition-opacity focus-visible:shadow-[var(--focus-ring)]',
              liveCollapsed && 'mx-auto',
            )}
            onClick={toggleMode}
            title={liveCollapsed ? 'Развернуть меню' : 'Свернуть меню'}
            aria-label={liveCollapsed ? 'Развернуть меню' : 'Свернуть меню'}
            aria-pressed={!liveCollapsed}
          >
            <BrandMark collapsed={liveCollapsed} />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4 scrollbar-subtle">
          {sections.map((section) => (
            <div key={section.label} className="mb-5">
              {!liveCollapsed && <p className="label-overline mb-1.5 px-3">{section.label}</p>}
              <div className="flex flex-col gap-0.5">
                {section.items.map((item) => {
                  const active = itemActive(item)
                  const count = readCounter(store.summary, item.counter)
                  return liveCollapsed ? (
                    <CollapsedNavLink
                      key={item.to}
                      item={item}
                      active={active}
                      count={count}
                      alert={item.counterAlert}
                      onNavigate={onNavigate}
                      onLoupe={setLoupe}
                    />
                  ) : (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-3 rounded-full px-3 py-2 text-sm transition-colors',
                        active
                          ? 'bg-primary font-medium text-primary-foreground'
                          : 'text-foreground hover:bg-inset',
                      )}
                    >
                      <item.icon size={18} strokeWidth={1.5} className="shrink-0" />
                      <span className="truncate">{item.label}</span>
                      {count > 0 ? (
                        <span
                          className={cn(
                            'ml-auto inline-flex min-w-[1.35rem] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold',
                            item.counterAlert
                              ? 'bg-accent text-accent-foreground'
                              : 'text-subtle-foreground',
                          )}
                        >
                          {count}
                        </span>
                      ) : null}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}

          {favoriteBoards.length > 0 ? (
            <div className="mb-4">
              {!liveCollapsed && <p className="label-overline mb-1.5 px-3">Доски</p>}
              {favoriteBoards.map((board) => (
                <Link
                  key={board.id}
                  to={`/boards/${board.id}`}
                  onClick={onNavigate}
                  className="flex items-center gap-3 rounded-full px-3 py-2 text-sm hover:bg-inset"
                >
                  {!liveCollapsed ? board.name : board.name.slice(0, 1)}
                </Link>
              ))}
            </div>
          ) : null}
          <div className="mb-2">
            {!liveCollapsed && <p className="label-overline mb-1.5 px-3">Пространства</p>}
            <div className="flex flex-col gap-0.5">
              {spaces.map(({ space, folders, lists }) => (
                <div key={space.id} className="mb-2">
                  <NavLink
                    to={`/spaces/${space.id}`}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-full px-3 py-2 text-sm transition-colors',
                        liveCollapsed && 'justify-center px-2.5',
                        isActive
                          ? 'bg-primary font-medium text-primary-foreground'
                          : 'text-foreground hover:bg-inset',
                      )
                    }
                  >
                    <span
                      className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-inset text-[10px] font-semibold"
                      aria-hidden
                    >
                      {treeInitial(space.name)}
                    </span>
                    {!liveCollapsed ? (
                      <span className="truncate font-medium">{space.name}</span>
                    ) : (
                      <span className="sr-only">{space.name}</span>
                    )}
                  </NavLink>
                  {lists
                    .filter((list) => !list.folderId)
                    .map((list) => (
                      <ListDropLink
                        key={list.id}
                        listId={list.id}
                        name={list.name}
                        collapsed={liveCollapsed}
                        onNavigate={onNavigate}
                        onLoupe={setLoupe}
                      />
                    ))}
                  {folders.map((folder) => (
                    <div key={folder.id}>
                      {!liveCollapsed ? (
                        <div className="px-3 py-1 text-xs text-subtle-foreground">{folder.name}</div>
                      ) : null}
                      {lists
                        .filter((list) => list.folderId === folder.id)
                        .map((list) => (
                          <ListDropLink
                            key={list.id}
                            listId={list.id}
                            name={list.name}
                            nested
                            collapsed={liveCollapsed}
                            onNavigate={onNavigate}
                            onLoupe={setLoupe}
                          />
                        ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </nav>

        <div className="mt-auto p-4">
          {showUserFoot && user ? (
            <div
              className={cn(
                'mb-3 flex',
                liveCollapsed ? 'flex-col items-center gap-2' : 'items-center gap-2',
              )}
            >
              <Link
                to="/me"
                onClick={onNavigate}
                className={cn(
                  'flex min-w-0 flex-1 items-center gap-2 rounded-full px-1 py-1 hover:bg-inset',
                  liveCollapsed && 'flex-none justify-center',
                )}
                title={`${user.name} · ${user.email}`}
              >
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-semibold uppercase text-primary-foreground">
                  {initials}
                </span>
                {!liveCollapsed ? (
                  <span className="min-w-0 truncate text-left">
                    <span className="block truncate text-sm text-foreground">{user.name}</span>
                    <span className="block truncate text-xs text-subtle-foreground">
                      {user.email}
                    </span>
                  </span>
                ) : null}
              </Link>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-subtle-foreground transition-colors hover:bg-inset hover:text-foreground"
                aria-label="Выйти"
                title="Выйти"
                onClick={() => void logout()}
              >
                <LogOut size={16} strokeWidth={1.5} />
              </button>
            </div>
          ) : null}

          <div
            className={cn(
              'flex',
              liveCollapsed ? 'flex-col items-center gap-2' : 'items-center justify-end gap-1.5',
            )}
          >
            <button
              type="button"
              onClick={toggleMode}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-subtle-foreground transition-colors hover:bg-inset hover:text-foreground"
              title={liveCollapsed ? 'Длинное меню' : 'Короткое меню'}
              aria-label={liveCollapsed ? 'Длинное меню' : 'Короткое меню'}
              aria-pressed={!liveCollapsed}
            >
              <ChevronLeft
                size={16}
                className={cn('transition-transform', liveCollapsed && 'rotate-180')}
              />
            </button>
            <button
              type="button"
              onClick={togglePinned}
              className={cn(
                'inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors',
                prefs.pinned
                  ? 'bg-inset text-foreground'
                  : 'text-subtle-foreground hover:bg-inset hover:text-foreground',
              )}
              title={
                prefs.pinned
                  ? 'Открепить меню'
                  : liveCollapsed
                    ? 'Закрепить короткое меню'
                    : 'Закрепить длинное меню'
              }
              aria-label={prefs.pinned ? 'Открепить меню' : 'Закрепить меню'}
              aria-pressed={prefs.pinned}
              aria-describedby={pinHintId}
            >
              <PushPin
                size={16}
                strokeWidth={prefs.pinned ? 2.2 : 1.5}
                className={cn(prefs.pinned && 'rotate-45')}
              />
            </button>
            <span id={pinHintId} className="sr-only">
              {prefs.pinned
                ? 'Меню закреплено. Кнопка со стрелкой переключает длинный и короткий вид.'
                : 'Без закрепления меню свернётся в короткое через 30 секунд без наведения. Ширину длинного меню можно тянуть за правый край.'}
            </span>
          </div>
        </div>

        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Изменить ширину меню"
          aria-valuemin={SIDEBAR_MIN_EXPANDED_WIDTH_PX}
          aria-valuemax={SIDEBAR_MAX_EXPANDED_WIDTH_PX}
          aria-valuenow={Math.round(desktopWidthPx)}
          tabIndex={0}
          title="Тяните, чтобы изменить ширину. Двойной клик — ширина по умолчанию."
          className={cn(
            'absolute inset-y-0 right-0 z-20 hidden w-2 translate-x-1/2 cursor-col-resize touch-none md:block',
            'after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-transparent after:transition-colors',
            'hover:after:bg-border active:after:bg-foreground/30',
            resizing && 'after:bg-foreground/30',
          )}
          onPointerDown={onResizePointerDown}
          onDoubleClick={onResizeDoubleClick}
          onKeyDown={onResizeKeyDown}
        />

        {liveCollapsed ? <SidebarLoupe state={loupe} /> : null}
      </aside>
  )
}
