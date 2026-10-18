import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/button'
import { formatDateTime } from '../lib/format'
import { Bell } from '../lib/icons'
import { cn } from '../lib/utils'
import { useStore } from '../store'

export function InboxPage() {
  const store = useStore()
  const navigate = useNavigate()
  const unread = store.notifications.filter((item) => !item.read).length

  useEffect(() => {
    void store.loadNotifications()
  }, [store.loadNotifications])

  return (
    <div className="space-y-6">
      <PageHeader
        overline="Inbox"
        title="Уведомления"
        subtitle="Назначения, упоминания, комментарии, смена статуса, срок. Snooze / clear — без отдельного scheduler."
        actions={
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void store.markAllNotificationsRead()}
          >
            Прочитать все · {unread}
          </Button>
        }
      />

      {store.notifications.length === 0 ? (
        <EmptyState icon={Bell} title="Пока пусто" description="Новые уведомления появятся здесь." />
      ) : (
        <div className="space-y-2">
          {store.notifications.map((item) => (
            <div
              key={item.id}
              className={cn(
                'rounded bg-surface p-2',
                !item.read && 'accent-marker',
              )}
            >
              <button
                type="button"
                className="flex w-full gap-3 text-left"
                onClick={() => {
                  void store.markNotificationRead(item.id)
                  if (item.taskId) navigate(`/tasks/${item.taskId}`)
                }}
              >
                <span
                  className={cn(
                    'mt-2 size-2 shrink-0 rounded-full',
                    item.severity === 'HIGH' && 'bg-destructive',
                    item.severity === 'MEDIUM' && 'bg-accent',
                    item.severity === 'LOW' && 'bg-muted-foreground',
                  )}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <h3 className="text-sm font-medium text-foreground">{item.title}</h3>
                  {item.body ? <p className="mt-0.5 text-sm text-muted-foreground">{item.body}</p> : null}
                </span>
                <time className="shrink-0 text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</time>
              </button>
              <div className="mt-2 flex flex-wrap gap-2 pl-5">
                <Button
                  type="button"
                  variant="ghost"
                  size="compact"
                  onClick={() => void store.snoozeNotification(item.id)}
                >
                  Отложить 4ч
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="compact"
                  onClick={() => void store.clearNotification(item.id)}
                >
                  Скрыть
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
