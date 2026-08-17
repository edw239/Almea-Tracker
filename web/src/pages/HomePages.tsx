import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { QuickAdd, TaskRow } from '../components/ui'
import { isAssignedTo, isDueSoon, isOverdue } from '../lib/format'
import { useStore } from '../store'
import type { Task } from '../types'

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

export function MyWorkPage() {
  const store = useStore()
  const navigate = useNavigate()
  const inboxId = store.personalInboxListId
  const mine = store.tasks.filter((task) => !task.parentTaskId && isAssignedTo(task, store.currentUserId))
  const open = (id: string) => navigate(`/tasks/${id}`)
  const overdue = mine.filter((task) => isOverdue(task))
  const today = mine.filter((task) => isDueSoon(task) && !isOverdue(task))
  const later = mine.filter((task) => task.dueDate && !isOverdue(task) && !isDueSoon(task) && task.status !== 'DONE')
  const none = mine.filter((task) => !task.dueDate && task.status !== 'DONE' && task.status !== 'CANCELLED')

  return (
    <>
      <header className="topbar">
        <div>
          <div className="kicker">My Work</div>
          <h1 className="page-title">Что требует внимания</h1>
          <p className="page-lead">
            Только задачи, где вы исполнитель. Захват во входящие — внизу, командная работа — в дереве слева.
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
        <div className="stats">
          <div className="stat">
            <b>{overdue.length}</b>
            <span>просрочено</span>
          </div>
          <div className="stat">
            <b>{today.length}</b>
            <span>сегодня</span>
          </div>
          <div className="stat">
            <b>{mine.filter((task) => task.status === 'IN_PROGRESS').length}</b>
            <span>в работе</span>
          </div>
          <div className="stat">
            <b>{store.notifications.filter((item) => !item.read).length}</b>
            <span>непрочитанных</span>
          </div>
        </div>
        <Section title="Просрочено" tasks={overdue} onOpen={open} />
        <Section title="Сегодня" tasks={today} onOpen={open} />
        <Section title="Дальше по сроку" tasks={later} onOpen={open} />
        <Section title="Без даты" tasks={none} onOpen={open} />
        {inboxId ? <QuickAdd listId={inboxId} placeholder="Захватить во входящие…" /> : null}
      </div>
    </>
  )
}

export function OverduePage() {
  const store = useStore()
  const navigate = useNavigate()

  useEffect(() => {
    void store.loadOverdue()
  }, [store])

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
  const store = useStore()
  const navigate = useNavigate()
  const decisions = store.tasks
    .filter((task) => task.assigneeIds.includes(store.currentUserId) && task.priority === 'URGENT')
    .slice(0, 8)
  const brandLists = store.lists.filter((list) => !list.systemKey).slice(0, 6)

  return (
    <>
      <header className="topbar">
        <div>
          <div className="kicker">CEO briefing</div>
          <h1 className="page-title">Неделя: решения, не активность</h1>
          <p className="page-lead">Срочные задачи, где вы исполнитель, и быстрый вход в списки.</p>
        </div>
      </header>
      <div className="content">
        <section className="group">
          <div className="group-h">
            <h2>Нужно ваше решение</h2>
          </div>
          <div className="card-list">
            {decisions.map((task) => (
              <TaskRow key={task.id} task={task} onOpen={() => navigate(`/tasks/${task.id}`)} />
            ))}
          </div>
        </section>
        <section className="group">
          <div className="group-h">
            <h2>Списки</h2>
          </div>
          <div className="space-grid">
            {brandLists.map((list) => {
              const open = store.tasks.filter(
                (task) => task.listId === list.id && task.status !== 'DONE' && task.status !== 'CANCELLED',
              )
              return (
                <Link key={list.id} to={`/lists/${list.id}`} className="space-card">
                  <h3>{list.name}</h3>
                  <p>{open.length} открытых задач. Клик — список и доска.</p>
                  <span>открыть list</span>
                </Link>
              )
            })}
          </div>
        </section>
      </div>
    </>
  )
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
