import { useNavigate } from 'react-router-dom'
import { formatDateTime } from '../lib/format'
import { useStore } from '../store'

export function InboxPage() {
  const store = useStore()
  const navigate = useNavigate()
  const unread = store.notifications.filter((item) => !item.read).length

  return (
    <>
      <header className="topbar">
        <div>
          <div className="kicker">Inbox</div>
          <h1 className="page-title">Уведомления</h1>
          <p className="page-lead">Только рабочие события: назначение, срок, упоминание, комментарий, смена статуса.</p>
        </div>
        <button type="button" className="ghost" onClick={() => store.dispatch({ type: 'MARK_ALL_READ' })}>
          Прочитать все · {unread}
        </button>
      </header>
      <div className="content">
        <div className="inbox">
          {store.notifications.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`notif ${item.read ? 'read' : ''}`}
              onClick={() => {
                store.dispatch({ type: 'MARK_NOTIF', id: item.id, read: true })
                if (item.taskId) navigate(`/tasks/${item.taskId}`)
              }}
            >
              <span className={`dot ${item.severity}`} />
              <span>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </span>
              <time>{formatDateTime(item.createdAt)}</time>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
