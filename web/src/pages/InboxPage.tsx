import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDateTime } from '../lib/format'
import { useStore } from '../store'

export function InboxPage() {
  const store = useStore()
  const navigate = useNavigate()
  const unread = store.notifications.filter((item) => !item.read).length

  useEffect(() => {
    void store.loadNotifications()
  }, [store.loadNotifications])

  return (
    <>
      <header className="topbar">
        <div>
          <div className="kicker">Inbox</div>
          <h1 className="page-title">Уведомления</h1>
          <p className="page-lead">
            Назначения, упоминания, комментарии, смена статуса, срок. Snooze / clear — без отдельного scheduler.
          </p>
        </div>
        <button type="button" className="ghost" onClick={() => void store.markAllNotificationsRead()}>
          Прочитать все · {unread}
        </button>
      </header>
      <div className="content">
        {store.notifications.length === 0 ? <p className="empty">Пока пусто</p> : null}
        <div className="inbox">
          {store.notifications.map((item) => (
            <div key={item.id} className={`notif ${item.read ? 'read' : ''}`}>
              <button
                type="button"
                className="notif-main"
                onClick={() => {
                  void store.markNotificationRead(item.id)
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
              <div className="notif-actions">
                <button type="button" className="ghost" onClick={() => void store.snoozeNotification(item.id)}>
                  Snooze 4ч
                </button>
                <button type="button" className="ghost" onClick={() => void store.clearNotification(item.id)}>
                  Clear
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
