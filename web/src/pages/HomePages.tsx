import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { LoadErrorNotice } from '../components/LoadErrorNotice'
import { PageHeader } from '../components/PageHeader'
import { PageToolbar } from '../components/PageToolbar'
import { StatCard, StatTiles } from '../components/StatCard'
import { QuickAdd, TaskRow } from '../components/ui'
import { Button } from '../components/ui/button'
import { CardSkeleton } from '../components/ui/Skeleton'
import type { MyWorkScope } from '../lib/api'
import { SEGMENT_TRACK, segmentItemClass } from '../lib/control-styles'
import { isOverdue } from '../lib/format'
import { Bell, Flame, Inbox, ListTodo, Star } from '../lib/icons'
import { cn } from '../lib/utils'
import { useStore } from '../store'
import type { Task } from '../types'

type WorkBuckets = {
  overdue: Task[]
  today: Task[]
  later: Task[]
  none: Task[]
}

function Section({ title, tasks, onOpen }: { title: string; tasks: Task[]; onOpen: (id: string) => void }) {
  if (tasks.length === 0) return null
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-medium text-foreground">{title}</h2>
        <span className="text-sm tabular-nums text-muted-foreground">{tasks.length}</span>
      </div>
      <div className="space-y-1 rounded bg-surface p-1">
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} onOpen={() => onOpen(task.id)} />
        ))}
      </div>
    </section>
  )
}

const SCOPE_OPTIONS: Array<{ id: MyWorkScope; label: string }> = [
  { id: 'default', label: 'Все' },
  { id: 'untriaged', label: 'Неразобранные' },
  { id: 'review', label: 'На проверке' },
  { id: 'assigned', label: 'Исполнитель' },
  { id: 'owned', label: 'Владелец' },
  { id: 'created', label: 'Поставил' },
  { id: 'waiting', label: 'Жду' },
  { id: 'watching', label: 'Наблюдаю' },
  { id: 'mentions', label: 'Упоминания' },
  { id: 'checklist', label: 'Чеклист' },
]

function parseScope(raw: string | null): MyWorkScope {
  const hit = SCOPE_OPTIONS.find((item) => item.id === raw)
  return hit?.id ?? 'default'
}

export function MyWorkPage() {
  const store = useStore()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const scope = parseScope(params.get('scope'))
  const inboxId = store.personalInboxListId
  const [buckets, setBuckets] = useState<WorkBuckets | null>(null)
  const [loadingScope, setLoadingScope] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoadingScope(true)
      const next = await store.loadMyWorkBuckets(scope)
      if (!cancelled) {
        setBuckets(next)
        setLoadingScope(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [scope, store.loadMyWorkBuckets])

  const open = (id: string) => navigate(`/tasks/${id}`)
  const source = buckets ?? { overdue: [], today: [], later: [], none: [] }
  const totalCount =
    source.overdue.length + source.today.length + source.later.length + source.none.length

  const setScope = (next: MyWorkScope) => {
    const nextParams = new URLSearchParams(params)
    if (next === 'default') nextParams.delete('scope')
    else nextParams.set('scope', next)
    setParams(nextParams, { replace: true })
  }

  const scopeToolbar = (
    <PageToolbar>
      <div className={cn(SEGMENT_TRACK, 'flex-wrap gap-0.5 p-0.5')} role="tablist" aria-label="Скоуп My Work">
        {SCOPE_OPTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={scope === item.id}
            className={segmentItemClass(scope === item.id)}
            onClick={() => setScope(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </PageToolbar>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        overline="My Work"
        title="Что требует внимания"
        subtitle={
          <>
            Задачи, где вы исполнитель или владелец. Другие роли — переключателем ниже. Захват во
            входящие — внизу, командная работа — в дереве слева.
          </>
        }
        actions={
          inboxId ? (
            <Button variant="secondary" size="sm" asChild>
              <Link to={`/lists/${inboxId}`}>Входящие</Link>
            </Button>
          ) : null
        }
        toolbar={scopeToolbar}
      />

      {store.error ? (
        <LoadErrorNotice message={store.error} onRetry={() => void store.loadSummary()} />
      ) : null}

      <StatTiles>
        <StatCard title="просрочено" value={String(store.summary?.overdue ?? 0)} icon={Flame} />
        <StatCard title="сегодня" value={String(store.summary?.today ?? 0)} icon={ListTodo} />
        <StatCard title="в работе" value={String(store.summary?.inProgress ?? 0)} icon={ListTodo} />
        <StatCard title="неразобранных" value={String(store.summary?.untriaged ?? 0)} icon={Inbox} />
        <StatCard title="непрочитанных" value={String(store.summary?.unread ?? 0)} icon={Bell} />
      </StatTiles>

      {loadingScope ? (
        <div className="space-y-3">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : null}

      {!loadingScope && totalCount === 0 ? (
        <EmptyState
          icon={ListTodo}
          title="В этом скоупе пока нет задач"
          description="Переключите скоуп или добавьте задачу во входящие."
        />
      ) : null}

      <div className="space-y-6">
        <Section title="Просрочено" tasks={source.overdue} onOpen={open} />
        <Section title="Сегодня" tasks={source.today} onOpen={open} />
        <Section title="Дальше по сроку" tasks={source.later} onOpen={open} />
        <Section title="Без даты" tasks={source.none} onOpen={open} />
      </div>

      {inboxId && (scope === 'default' || scope === 'untriaged') ? (
        <QuickAdd
          listId={inboxId}
          placeholder="Заголовок → исполнитель → срок → бренд"
          onCreated={() => {
            void store.loadMyWorkBuckets(scope).then(setBuckets)
            void store.loadSummary()
          }}
        />
      ) : null}
    </div>
  )
}

export function OverduePage() {
  const store = useStore()
  const navigate = useNavigate()

  useEffect(() => {
    void store.loadOverdue()
  }, [store.loadOverdue])

  const tasks = store.tasks.filter((task) => isOverdue(task) && !task.parentTaskId)

  return (
    <div className="space-y-6">
      <PageHeader
        overline="Management"
        title="Просрочено"
        subtitle="По видимым пространствам. Для разговора: что блокирует отгрузку и полку."
      />
      {tasks.length === 0 ? (
        <EmptyState
          icon={Flame}
          title="Просроченных задач нет"
          description="Все сроки в порядке по вашим видимым пространствам."
        />
      ) : (
        <div className="space-y-1 rounded bg-surface p-1">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} onOpen={() => navigate(`/tasks/${task.id}`)} />
          ))}
        </div>
      )}
    </div>
  )
}

export function WeekPage() {
  return <Navigate to="/overview" replace />
}

export function FavoritesPage() {
  const store = useStore()
  const navigate = useNavigate()
  const lists = store.favorites
    .filter((item) => item.entityType === 'TASK_LIST')
    .map((item) => store.lists.find((list) => list.id === item.entityId))
    .filter((item) => item != null)
  const tasks = store.favorites
    .filter((item) => item.entityType === 'TASK')
    .map((item) => store.tasks.find((task) => task.id === item.entityId))
    .filter((item) => item != null)

  const empty = lists.length === 0 && tasks.length === 0

  return (
    <div className="space-y-6">
      <PageHeader overline="Favorites" title="Закреплено" />
      {empty ? (
        <EmptyState
          icon={Star}
          title="Избранное пусто"
          description="Закрепите список или задачу из карточки или списка."
        />
      ) : (
        <>
          {lists.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {lists.map((list) => (
                <Link
                  key={list.id}
                  to={`/lists/${list.id}`}
                  className="surface-card block rounded p-4 transition-colors hover:bg-elevated"
                >
                  <h3 className="font-medium text-foreground">{list.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Избранный список</p>
                </Link>
              ))}
            </div>
          ) : null}
          {tasks.length > 0 ? (
            <div className="space-y-1 rounded bg-surface p-1">
              {tasks.map((task) => (
                <TaskRow key={task.id} task={task} onOpen={() => navigate(`/tasks/${task.id}`)} />
              ))}
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
