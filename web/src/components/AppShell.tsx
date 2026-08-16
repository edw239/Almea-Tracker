import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { isOverdue } from '../lib/format'
import { useCurrentUser, useStore } from '../store'

export function AppShell() {
  const store = useStore()
  const user = useCurrentUser()
  const location = useLocation()
  const mine = store.tasks.filter((task) => task.assigneeIds.includes(store.currentUserId) && !task.parentTaskId)
  const overdue = mine.filter((task) => isOverdue(task)).length
  const unread = store.notifications.filter((item) => !item.read).length

  const spaces = store.spaces.map((space) => {
    const folders = store.folders.filter((folder) => folder.spaceId === space.id)
    const lists = store.lists.filter((list) => list.spaceId === space.id)
    return { space, folders, lists }
  })

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-name">almea</span>
          <span className="brand-meta">tracker</span>
        </div>

        <nav className="nav-block">
          <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            Моя работа
            <span className="nav-count">{mine.length}</span>
          </NavLink>
          <NavLink to="/week" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            Неделя CEO
          </NavLink>
          <NavLink to="/overdue" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            Просрочено
            {overdue > 0 ? <span className="nav-count alert">{overdue}</span> : null}
          </NavLink>
          <NavLink to="/inbox" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            Inbox
            {unread > 0 ? <span className="nav-count alert">{unread}</span> : <span className="nav-count">0</span>}
          </NavLink>
          <NavLink to="/favorites" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            Избранное
          </NavLink>
        </nav>

        <div className="tree">
          <div className="nav-label">Пространства</div>
          {spaces.map(({ space, folders, lists }) => (
            <div key={space.id}>
              <NavLink to={`/spaces/${space.id}`} className={({ isActive }) => `tree-space ${isActive ? 'active' : ''}`}>
                {space.name}
              </NavLink>
              {lists
                .filter((list) => !list.folderId)
                .map((list) => (
                  <NavLink
                    key={list.id}
                    to={`/lists/${list.id}`}
                    className={({ isActive }) => `tree-link ${isActive ? 'active' : ''}`}
                  >
                    {list.name}
                  </NavLink>
                ))}
              {folders.map((folder) => (
                <div key={folder.id}>
                  <div className="tree-folder">{folder.name}</div>
                  {lists
                    .filter((list) => list.folderId === folder.id)
                    .map((list) => (
                      <NavLink
                        key={list.id}
                        to={`/lists/${list.id}`}
                        className={({ isActive }) => `tree-link nested ${isActive ? 'active' : ''}`}
                      >
                        {list.name}
                      </NavLink>
                    ))}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="sidebar-foot">
          <div className="user-chip">
            <span className="avatar">{user.initials}</span>
            <div>
              <div>{user.name}</div>
              <small>{user.role} · демо без бэкенда</small>
            </div>
          </div>
          <button type="button" className="ghost" onClick={() => store.dispatch({ type: 'RESET' })}>
            Сбросить демо
          </button>
        </div>
      </aside>

      <div className="main" key={location.pathname}>
        <Outlet />
      </div>
    </div>
  )
}
