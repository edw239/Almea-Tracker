import { useMemo } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { TaskPanel } from '../components/TaskPanel'
import { Avatars, QuickAdd, StatusChip, TaskRow } from '../components/ui'
import { formatDay, isoDate, monthGrid, startOfDay } from '../lib/format'
import { boardColumns, resolveStatusesForList } from '../lib/status'
import { useStore } from '../store'
import type { ViewType } from '../types'

const VIEWS: { id: ViewType; label: string }[] = [
  { id: 'LIST', label: 'Список' },
  { id: 'BOARD', label: 'Доска' },
  { id: 'TABLE', label: 'Таблица' },
  { id: 'CALENDAR', label: 'Календарь' },
]

export function ListPage() {
  const { listId } = useParams()
  const [params, setParams] = useSearchParams()
  const store = useStore()
  const list = store.lists.find((item) => item.id === listId)
  const view = (params.get('view') as ViewType | null) ?? 'LIST'
  const selectedId = params.get('task')
  if (!list) return <p className="content">Список не найден</p>

  const statuses = resolveStatusesForList(store, list.id)
  const tasks = store.tasks.filter((task) => task.listId === list.id && !task.parentTaskId)
  const selected = tasks.find((task) => task.id === selectedId) ?? store.tasks.find((task) => task.id === selectedId)
  const starred = store.favorites.some((item) => item.entityType === 'TASK_LIST' && item.entityId === list.id)
  const openTask = (id: string) => {
    const next = new URLSearchParams(params)
    next.set('task', id)
    setParams(next)
  }

  return (
    <div className={selected ? 'with-panel' : undefined}>
      <div>
        <header className="topbar">
          <div>
            <div className="kicker">List</div>
            <h1 className="page-title">{list.name}</h1>
            <p className="page-lead">Единица работы. Dual status: колонка UI и канонический статус для отчётов.</p>
          </div>
          <div className="top-actions">
            <div className="seg">
              {VIEWS.map((item) => (
                <Link
                  key={item.id}
                  to={`/lists/${list.id}?view=${item.id}`}
                  className={view === item.id ? 'active' : ''}
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <button
              type="button"
              className="ghost"
              onClick={() =>
                store.dispatch({ type: 'TOGGLE_FAVORITE', entityType: 'TASK_LIST', entityId: list.id })
              }
            >
              {starred ? 'В избранном' : 'В избранное'}
            </button>
          </div>
        </header>
        <div className="content">
          {view === 'LIST' ? (
            <>
              <div className="card-list">
                {tasks.map((task) => (
                  <TaskRow key={task.id} task={task} active={task.id === selectedId} onOpen={() => openTask(task.id)} />
                ))}
              </div>
              <QuickAdd listId={list.id} />
            </>
          ) : null}
          {view === 'BOARD' ? (
            <div className="board">
              {boardColumns(statuses).map((column) => (
                <div className="column" key={column.id}>
                  <h3>
                    {column.name} · {tasks.filter((task) => task.listStatusId === column.id).length}
                  </h3>
                  {tasks
                    .filter((task) => task.listStatusId === column.id)
                    .map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        className={`kanban-card ${task.id === selectedId ? 'active' : ''}`}
                        onClick={() => openTask(task.id)}
                      >
                        <strong>{task.title}</strong>
                        <p>{task.domainLabel ?? '—'}</p>
                      </button>
                    ))}
                </div>
              ))}
            </div>
          ) : null}
          {view === 'TABLE' ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Задача</th>
                    <th>Колонка</th>
                    <th>Приоритет</th>
                    <th>Срок</th>
                    <th>Люди</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <tr key={task.id} className="clickable" onClick={() => openTask(task.id)}>
                      <td>{task.title}</td>
                      <td>
                        <StatusChip task={task} statuses={statuses} />
                      </td>
                      <td>{task.priority}</td>
                      <td>{task.dueDate ?? '—'}</td>
                      <td>
                        <Avatars ids={task.assigneeIds} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {view === 'CALENDAR' ? <CalendarView onOpen={openTask} listId={list.id} /> : null}
        </div>
      </div>
      {selected ? (
        <TaskPanel
          task={selected}
          onClose={() => {
            const next = new URLSearchParams(params)
            next.delete('task')
            setParams(next)
          }}
        />
      ) : null}
    </div>
  )
}

function CalendarView({ listId, onOpen }: { listId: string; onOpen: (id: string) => void }) {
  const store = useStore()
  const days = useMemo(() => monthGrid(new Date()), [])
  const today = isoDate(startOfDay(new Date()))
  const tasks = store.tasks.filter((task) => task.listId === listId && task.dueDate)
  const heads = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс']
  const month = new Date().getMonth()

  return (
    <div className="calendar">
      {heads.map((head) => (
        <div className="cal-head" key={head}>
          {head}
        </div>
      ))}
      {days.map((day) => {
        const key = isoDate(day)
        const items = tasks.filter((task) => task.dueDate === key)
        return (
          <div key={key} className={`cal-cell ${day.getMonth() !== month ? 'out' : ''} ${key === today ? 'today' : ''}`}>
            <div className="cal-day">{formatDay(key)}</div>
            {items.map((task) => (
              <button key={task.id} type="button" className="cal-task" onClick={() => onOpen(task.id)}>
                {task.title}
              </button>
            ))}
          </div>
        )
      })}
    </div>
  )
}
