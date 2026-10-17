import {
  DndContext,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth'
import { ensureNotificationPermission } from '../lib/browser-notifications'
import { initialsFromName } from '../lib/format'
import { listDropId, parseListDropId } from '../lib/mechanics'
import { useStore } from '../store'
import {
  IconBrand,
  IconChevron,
  IconFavorites,
  IconInbox,
  IconLogout,
  IconMyWork,
  IconOverdue,
  IconPeople,
  IconWeek,
} from './icons'

const SIDEBAR_COLLAPSED_KEY = 'almea.sidebar.collapsed'

function treeInitial(name: string): string {
  const trimmed = name.trim()
  return trimmed ? trimmed[0]!.toLocaleUpperCase('ru-RU') : '·'
}

function ListDropLink({
  listId,
  name,
  nested,
  collapsed,
}: {
  listId: string
  name: string
  nested?: boolean
  collapsed?: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id: listDropId(listId) })
  return (
    <div ref={setNodeRef} className={isOver ? 'drop-target' : undefined}>
      <NavLink
        to={`/lists/${listId}`}
        title={collapsed ? name : undefined}
        className={({ isActive }) =>
          `tree-link ${nested ? 'nested' : ''} ${isActive ? 'active' : ''}`
        }
      >
        <span className="tree-mark" aria-hidden>
          {treeInitial(name)}
        </span>
        <span className="nav-text">{name}</span>
      </NavLink>
    </div>
  )
}

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

export function AppShell() {
  const store = useStore()
  const auth = useAuth()
  const user = auth.user
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 10 } }))

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0')
    } catch {
      /* ignore quota / private mode */
    }
  }, [collapsed])

  useEffect(() => {
    if (auth.user?.mustChangePassword) return
    void ensureNotificationPermission()
    void store.loadNotifications()
    void store.loadSummary()
    const timer = window.setInterval(() => {
      void store.loadNotifications()
      void store.loadSummary()
    }, 60_000)
    return () => window.clearInterval(timer)
  }, [auth.user?.mustChangePassword, store.loadNotifications, store.loadSummary])

  if (!user) return null
  const initials = initialsFromName(user.name)
  const mineCount = store.summary?.mineOpen ?? 0
  const overdue = store.summary?.overdue ?? 0
  const unread = store.summary?.unread ?? 0

  const spaces = store.spaces.map((space) => {
    const folders = store.folders.filter((folder) => folder.spaceId === space.id)
    const lists = store.lists.filter((list) => list.spaceId === space.id)
    return { space, folders, lists }
  })

  const onDragEnd = (event: DragEndEvent) => {
    const overId = event.over?.id
    if (overId == null) return
    const targetListId = parseListDropId(String(overId))
    if (!targetListId) return
    const taskId = String(event.active.id)
    void store.moveTask(taskId, null, targetListId)
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className={`app ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <aside className="sidebar" aria-label="Навигация">
          <div className="brand">
            <span className="brand-name">{collapsed ? 'a' : 'almea'}</span>
            <span className="brand-meta">tracker</span>
          </div>

          <nav className="nav-block">
            <NavLink
              to="/"
              end
              title="Моя работа"
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <IconMyWork />
              <span className="nav-text">Моя работа</span>
              <span className="nav-count">{mineCount}</span>
            </NavLink>
            <NavLink
              to="/overview"
              title="Обзор"
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <IconWeek />
              <span className="nav-text">Обзор</span>
            </NavLink>
            <NavLink
              to="/overdue"
              title="Просрочено"
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <IconOverdue />
              <span className="nav-text">Просрочено</span>
              {overdue > 0 ? <span className="nav-count alert">{overdue}</span> : null}
            </NavLink>
            <NavLink
              to="/inbox"
              title="Inbox"
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <IconInbox />
              <span className="nav-text">Inbox</span>
              {unread > 0 ? (
                <span className="nav-count alert">{unread}</span>
              ) : (
                <span className="nav-count">0</span>
              )}
            </NavLink>
            <NavLink
              to="/favorites"
              title="Избранное"
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <IconFavorites />
              <span className="nav-text">Избранное</span>
            </NavLink>
            <NavLink
              to="/brands"
              title="Бренды"
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <IconBrand />
              <span className="nav-text">Бренды</span>
            </NavLink>
            {user.role === 'GLOBAL_ADMIN' ? (
              <NavLink
                to="/people"
                title="Люди"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                <IconPeople />
                <span className="nav-text">Люди</span>
              </NavLink>
            ) : null}
          </nav>

          <div className="tree">
            <div className="nav-label">Пространства</div>
            {spaces.map(({ space, folders, lists }) => (
              <div key={space.id} className="tree-branch">
                <NavLink
                  to={`/spaces/${space.id}`}
                  title={collapsed ? space.name : undefined}
                  className={({ isActive }) => `tree-space ${isActive ? 'active' : ''}`}
                >
                  <span className="tree-mark" aria-hidden>
                    {treeInitial(space.name)}
                  </span>
                  <span className="nav-text">{space.name}</span>
                </NavLink>
                {lists
                  .filter((list) => !list.folderId)
                  .map((list) => (
                    <ListDropLink
                      key={list.id}
                      listId={list.id}
                      name={list.name}
                      collapsed={collapsed}
                    />
                  ))}
                {folders.map((folder) => (
                  <div key={folder.id} className="tree-folder-block">
                    <div className="tree-folder">{folder.name}</div>
                    {lists
                      .filter((list) => list.folderId === folder.id)
                      .map((list) => (
                        <ListDropLink
                          key={list.id}
                          listId={list.id}
                          name={list.name}
                          nested
                          collapsed={collapsed}
                        />
                      ))}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="sidebar-foot">
            <div className="user-row">
              <Link className="user-chip" to="/me" title={`${user.name} · ${user.email}`}>
                <span className="avatar">{initials}</span>
                <div className="user-meta">
                  <div>{user.name}</div>
                  <small>{user.email}</small>
                </div>
              </Link>
              <button
                type="button"
                className="logout-btn"
                aria-label="Выйти"
                title="Выйти"
                onClick={() => void auth.logout()}
              >
                <IconLogout />
              </button>
            </div>
            <button
              type="button"
              className="sidebar-toggle"
              aria-label={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
              aria-expanded={!collapsed}
              title={collapsed ? 'Развернуть' : 'Свернуть'}
              onClick={() => setCollapsed((value) => !value)}
            >
              <IconChevron direction={collapsed ? 'right' : 'left'} />
            </button>
          </div>
        </aside>

        <div className="main" key={location.pathname}>
          {!store.ready ? <div className="content muted">Загрузка данных…</div> : <Outlet />}
        </div>
      </div>
    </DndContext>
  )
}
