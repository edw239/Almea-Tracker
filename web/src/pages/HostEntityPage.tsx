import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { TaskRow } from '../components/ui'
import { api } from '../lib/api'
import { mapApiTask } from '../lib/mappers'
import type { Task } from '../types'

export function HostEntityPage() {
  const { entityType = '', entityId = '' } = useParams()
  const navigate = useNavigate()
  const [tasks, setTasks] = useState<Task[]>([])
  const [listId, setListId] = useState<string | null>(null)
  const [label, setLabel] = useState(entityId)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
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
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Host entity недоступен')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [entityId, entityType])

  return (
    <>
      <header className="topbar">
        <div>
          <div className="kicker">Host · {entityType}</div>
          <h1 className="page-title">{label}</h1>
          <p className="page-lead">
            Deep-link из доменной карточки. Список entity создаётся идемпотентно через host plugin.
            {listId ? (
              <>
                {' '}
                <Link to={`/lists/${listId}`}>Открыть list</Link>
              </>
            ) : null}
          </p>
          {error ? <p className="form-error">{error}</p> : null}
        </div>
      </header>
      <div className="content">
        <div className="card-list">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} onOpen={() => navigate(`/tasks/${task.id}`)} />
          ))}
        </div>
        {tasks.length === 0 && !error ? <p className="empty">Нет задач на этой сущности</p> : null}
      </div>
    </>
  )
}
