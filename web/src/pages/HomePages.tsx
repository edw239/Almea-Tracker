import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { QuickAdd, TaskRow } from '../components/ui'
import type { MyWorkScope } from '../lib/api'
import { isOverdue } from '../lib/format'
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
    <section className="group">
      <div className="group-h">
        <h2>{title}</h2>
        <span>{tasks.length}</span>
      </div>
      <div className="card-list">
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

  return (
    <>
      <header className="topbar">
        <div>
          <div className="kicker">My Work</div>
          <h1 className="page-title">Что требует внимания</h1>
          <p className="page-lead">
            Задачи, где вы исполнитель или владелец. Другие роли — переключателем ниже. Захват во
            входящие — внизу, командная работа — в дереве слева.
          </p>
          {store.error ? <p className="form-error">{store.error}</p> : null}
        </div>
        {inboxId ? (
          <Link className="pill" to={`/lists/${inboxId}`}>
            Входящие
          </Link>
        ) : null}
      </header>
      <div className="content">
        <div className="seg me-tabs" role="tablist" aria-label="Скоуп My Work">
          {SCOPE_OPTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={scope === item.id}
              className={scope === item.id ? 'active' : undefined}
              onClick={() => setScope(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="stats">
          <div className="stat">
            <b>{store.summary?.overdue ?? 0}</b>
            <span>просрочено</span>
          </div>
          <div className="stat">
            <b>{store.summary?.today ?? 0}</b>
            <span>сегодня</span>
          </div>
          <div className="stat">
            <b>{store.summary?.inProgress ?? 0}</b>
            <span>в работе</span>
          </div>
          <div className="stat">
            <b>{store.summary?.untriaged ?? 0}</b>
            <span>неразобранных</span>
          </div>
          <div className="stat">
            <b>{store.summary?.unread ?? 0}</b>
            <span>непрочитанных</span>
          </div>
        </div>

        {loadingScope ? <p className="muted">Загрузка…</p> : null}
        {!loadingScope && totalCount === 0 ? (
          <p className="muted">В этом скоупе пока нет задач.</p>
        ) : null}

        <Section title="Просрочено" tasks={source.overdue} onOpen={open} />
        <Section title="Сегодня" tasks={source.today} onOpen={open} />
        <Section title="Дальше по сроку" tasks={source.later} onOpen={open} />
        <Section title="Без даты" tasks={source.none} onOpen={open} />
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
    </>
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
    <>
      <header className="topbar">
        <div>
          <div className="kicker">Management</div>
          <h1 className="page-title">Просрочено</h1>
          <p className="page-lead">По видимым пространствам. Для разговора: что блокирует отгрузку и полку.</p>
        </div>
      </header>
      <div className="content">
        <div className="card-list">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} onOpen={() => navigate(`/tasks/${task.id}`)} />
          ))}
        </div>
      </div>
    </>
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

  return (
    <>
      <header className="topbar">
        <div>
          <div className="kicker">Favorites</div>
          <h1 className="page-title">Закреплено</h1>
        </div>
      </header>
      <div className="content">
        <div className="space-grid">
          {lists.map((list) => (
            <Link key={list.id} to={`/lists/${list.id}`} className="space-card">
              <h3>{list.name}</h3>
              <p>Избранный список</p>
            </Link>
          ))}
        </div>
        <div className="card-list">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} onOpen={() => navigate(`/tasks/${task.id}`)} />
          ))}
        </div>
      </div>
    </>
  )
}
