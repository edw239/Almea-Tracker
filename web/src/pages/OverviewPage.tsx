import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { LoadErrorNotice } from '../components/LoadErrorNotice'
import { PageHeader } from '../components/PageHeader'
import { TaskRow } from '../components/ui'
import { Button } from '../components/ui/button'
import { CardSkeleton } from '../components/ui/Skeleton'
import { api, ApiError, type OverviewResponse } from '../lib/api'
import { formatDateTime } from '../lib/format'
import { Gauge } from '../lib/icons'
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
    <section className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-medium text-foreground">{title}</h2>
        <span className="text-sm tabular-nums text-muted-foreground">{count}</span>
      </div>
      {tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="space-y-1 rounded bg-surface p-1">
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

  const subtitle = (
    <>
      Шесть блоков в таймзоне профиля
      {data ? ` (${data.timezone})` : ''}. Только задачи, которые вам видны
      {data?.scope === 'company' ? ' · срез компании' : ''}.
      {data ? (
        <span className="mt-1 block text-xs text-muted-foreground">на {formatDateTime(data.asOf)}</span>
      ) : null}
    </>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        overline="Владелец"
        title="Что горит"
        subtitle={subtitle}
        actions={
          <Button variant="secondary" size="sm" asChild>
            <Link to="/?scope=review">На проверке</Link>
          </Button>
        }
      />

      {error ? <LoadErrorNotice message={error} onRetry={() => window.location.reload()} /> : null}

      {loading ? (
        <div className="space-y-3">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : null}

      {data ? (
        <div className="space-y-8">
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
          <section className="space-y-4">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-lg font-medium text-foreground">Просрочено по людям</h2>
              <span className="text-sm tabular-nums text-muted-foreground">
                {data.overdueByUser.reduce((sum, row) => sum + row.count, 0)}
              </span>
            </div>
            {data.overdueByUser.length === 0 ? (
              <EmptyState
                icon={Gauge}
                title="Просроченных нет"
                description="У команды нет просроченных задач в этом срезе."
              />
            ) : (
              data.overdueByUser.map((row) => (
                <div key={row.userId} className="space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-base font-medium">
                      <Link className="text-link hover:underline" to={`/users/${row.userId}`}>
                        {row.userName}
                      </Link>
                    </h3>
                    <span className="text-sm tabular-nums text-muted-foreground">{row.count}</span>
                  </div>
                  <div className="space-y-1 rounded bg-surface p-1">
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
        </div>
      ) : null}
    </div>
  )
}
