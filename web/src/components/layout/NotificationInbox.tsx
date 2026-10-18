import type { ReactElement } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell } from '../../lib/icons'
import { cn } from '../../lib/utils'
import { useStore } from '../../store'
import { Button } from '../ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'

export function NotificationInbox(): ReactElement {
  const store = useStore()
  const navigate = useNavigate()
  const unread = store.summary?.unread ?? store.notifications.filter((n) => !n.read).length
  const rows = store.notifications.slice(0, 20)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-inset hover:text-foreground"
          aria-label={unread > 0 ? `Уведомления, непрочитанных ${unread}` : 'Уведомления'}
        >
          <Bell size={18} strokeWidth={1.5} />
          {unread > 0 ? (
            <span className="absolute right-1 top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-foreground">
              {unread > 9 ? '9+' : unread}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <p className="text-sm font-medium text-foreground">Уведомления</p>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="compact"
              onClick={() => void store.markAllNotificationsRead()}
            >
              Прочитать все
            </Button>
            <Button type="button" variant="ghost" size="compact" asChild>
              <Link to="/inbox">Все</Link>
            </Button>
          </div>
        </div>
        <div className="max-h-80 overflow-y-auto scrollbar-subtle">
          {rows.length === 0 ? (
            <p className="px-3 py-6 text-sm text-muted-foreground">Пока пусто</p>
          ) : (
            rows.map((item) => (
              <button
                key={item.id}
                type="button"
                className={cn(
                  'flex w-full flex-col gap-0.5 px-3 py-2.5 text-left text-sm transition-colors hover:bg-inset',
                  !item.read && 'accent-marker bg-surface',
                )}
                onClick={() => {
                  void store.markNotificationRead(item.id)
                  if (item.taskId) navigate(`/tasks/${item.taskId}`)
                  else navigate('/inbox')
                }}
              >
                <span className="font-medium text-foreground">{item.title}</span>
                {item.body ? (
                  <span className="line-clamp-2 text-xs text-muted-foreground">{item.body}</span>
                ) : null}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
