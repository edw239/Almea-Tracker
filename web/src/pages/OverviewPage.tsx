import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { TaskRow } from '../components/ui'
import { api, ApiError, type OverviewResponse } from '../lib/api'
import { formatDateTime } from '../lib/format'
import type { Task } from '../types'

function overviewTaskToTask(
  row: OverviewResponse['unassigned'][number] | OverviewResponse['rescheduled'][number],
): Task {
  return {
    id: row.id,
    listId: row.listId,
    parentTaskId: null,
    title: row.title,
    description: '',
    status: row.status,
    listStatusId: null,
    priority: 'MEDIUM',
    position: 0,
    ownerUserId: '',
    createdByUserId: null,
    assigneeIds: row.assigneeIds,
    watcherIds: [],
    dueDate: row.dueDate ? row.dueDate.slice(0, 10) : null,
    startDate: null,
    completedAt: null,
    reviewRequired: false,
    submittedAt: row.submittedAt,
    checklist: [],
    domainLabel: null,
    domainEntityId: null,
    domainEntityType: null,
    hostEntityId: null,
    isStuck: false,
    dueDateMoveCount: 'dueDateMoveCount' in row ? row.dueDateMoveCount : 0,
  }
}

function Block({
  title,
  count,
  tasks,
  onOpen,
  empty,
}: {
  title: string
  count: number
  tasks: Task[]
  onOpen: (id: string) => void
  empty: string
}) {
  return (
    <section className="group">
      <div className="group-h">
        <h2>{title}</h2>
        <span>{count}</span>
      </div>
      {tasks.length === 0 ? (
        <p className="empty">{empty}</p>
      ) : (
        <div className="card-list">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} onOpen={() => onOpen(task.id)} />
          ))}
        </div>
      )}
    </section>
  )
}

export function OverviewPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<OverviewResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const overview = await api.overview()
        if (!cancelled) {
          setData(overview)
          setError(null)
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить обзор')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const open = (id: string) => navigate(`/tasks/${id}`)

  return (
    <>
      <header className="topbar">
        <div>
          <div className="kicker">Владелец</div>
          <h1 className="page-title">Что горит</h1>
          <p className="page-lead">
            Шесть блоков в таймзоне профиля
            {data ? ` (${data.timezone})` : ''}. Только задачи, которые вам видны
            {data?.scope === 'company' ? ' · срез компании' : ''}.
          </p>
          {data ? <p className="muted">на {formatDateTime(data.asOf)}</p> : null}
          {error ? <p className="form-error">{error}</p> : null}
        </div>
        <Link className="ghost" to="/?scope=review">
          На проверке
        </Link>
      </header>
      <div className="content">
        {loading ? <p className="muted">Загрузка…</p> : null}
        {data ? (
          <>
            <Block
              title="Без исполнителя"
              count={data.unassigned.length}
              tasks={data.unassigned.map(overviewTaskToTask)}
              onOpen={open}
              empty="Нет залежавшихся без исполнителя"
            />
            <Block
              title="Без движения ≥ 3 раб. дня"
              count={data.stale.length}
              tasks={data.stale.map(overviewTaskToTask)}
              onOpen={open}
              empty="Всё двигается"
            />
            <Block
              title="Заблокировано"
              count={data.blocked.length}
              tasks={data.blocked.map(overviewTaskToTask)}
              onOpen={open}
              empty="Активных блокеров нет"
            />
            <Block
              title="Ждёт приёмки"
              count={data.awaitingReview.length}
              tasks={data.awaitingReview.map(overviewTaskToTask)}
              onOpen={open}
              empty="Очередь приёмки пуста"
            />
            <Block
              title="Переносили срок ≥2 раз"
              count={data.rescheduled.length}
              tasks={data.rescheduled.map(overviewTaskToTask)}
              onOpen={open}
              empty="Задач с частым переносом срока нет"
            />
            <section className="group">
              <div className="group-h">
                <h2>Просрочено по людям</h2>
                <span>{data.overdueByUser.reduce((sum, row) => sum + row.count, 0)}</span>
              </div>
              {data.overdueByUser.length === 0 ? (
                <p className="empty">Просроченных нет</p>
              ) : (
                data.overdueByUser.map((row) => (
                  <div key={row.userId} style={{ marginBottom: 16 }}>
                    <div className="group-h">
                      <h3>
                        <Link to={`/users/${row.userId}`}>{row.userName}</Link>
                      </h3>
                      <span>{row.count}</span>
                    </div>
                    <div className="card-list">
                      {row.tasks.map((task) => (
                        <TaskRow
                          key={`${row.userId}-${task.id}`}
                          task={overviewTaskToTask(task)}
                          onOpen={() => open(task.id)}
                        />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </section>
          </>
        ) : null}
      </div>
    </>
  )
}
