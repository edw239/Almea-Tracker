import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { LoadErrorNotice } from '../components/LoadErrorNotice'
import { PageHeader } from '../components/PageHeader'
import { TaskRow } from '../components/ui'
import { api } from '../lib/api'
import { mapApiTask } from '../lib/mappers'
import { Link2 } from '../lib/icons'
import type { Task } from '../types'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function HostEntityPage() {
  const { entityType = '', entityId = '' } = useParams()
  const navigate = useNavigate()
  const [tasks, setTasks] = useState<Task[]>([])
  const [listId, setListId] = useState<string | null>(null)
  const [label, setLabel] = useState(entityId)
  const [error, setError] = useState<string | null>(null)
  const redirectToBrand = entityType === 'brand' && UUID_RE.test(entityId)

  useEffect(() => {
    if (redirectToBrand) return
    let cancelled = false
    void (async () => {
      try {
        const ensured = await api.ensureHostEntity({
          entityType,
          entityId,
          name: entityId,
        })
        if (cancelled) return
        setListId(ensured.list.id)
        setLabel(entityId)
        const bundle = await api.hostEntity(entityType, entityId)
        if (cancelled) return
        setTasks(bundle.tasks.map(mapApiTask))
        if (bundle.list?.name) setLabel(bundle.list.name)
        if (entityType === 'brand' && bundle.id && UUID_RE.test(bundle.id)) {
          navigate(`/brands/${bundle.id}`, { replace: true })
        }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Host entity недоступен')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [entityId, entityType, navigate, redirectToBrand])

  if (redirectToBrand) {
    return <Navigate to={`/brands/${entityId}`} replace />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        overline={`Host · ${entityType}`}
        title={label}
        subtitle={
          <>
            Deep-link из доменной карточки. Список entity создаётся идемпотентно через host plugin.
            {listId ? (
              <>
                {' '}
                <Link className="text-link hover:underline" to={`/lists/${listId}`}>
                  Открыть list
                </Link>
              </>
            ) : null}
          </>
        }
      />

      {error ? <LoadErrorNotice message={error} /> : null}

      {tasks.length === 0 && !error ? (
        <EmptyState
          icon={Link2}
          title="Нет задач на этой сущности"
          description="Создайте задачу из списка или привяжите существующую."
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
