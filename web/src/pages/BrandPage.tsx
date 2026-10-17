import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { TaskRow } from '../components/ui'
import { api, ApiError } from '../lib/api'
import { mapApiTask } from '../lib/mappers'
import type { Task } from '../types'

export function BrandPage() {
  const { brandId = '' } = useParams()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [listId, setListId] = useState<string | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [error, setError] = useState<string | null>(null)
  const [archived, setArchived] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const data = await api.getHostEntity(brandId)
        if (cancelled) return
        setName(data.name)
        setArchived(data.isArchived)
        setListId(data.list?.id ?? null)
        setTasks(data.tasks.map(mapApiTask))
        if (!data.list) {
          const ensured = await api.ensureHostEntity({
            entityType: data.entityType,
            entityId: data.id,
            name: data.name,
          })
          if (!cancelled) setListId(ensured.list.id)
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof ApiError ? caught.message : 'Бренд недоступен')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [brandId])

  async function toggleArchive() {
    try {
      const updated = await api.patchHostEntity(brandId, { isArchived: !archived })
      setArchived(updated.isArchived)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось изменить')
    }
  }

  return (
    <>
      <header className="topbar">
        <div>
          <div className="kicker">Бренд</div>
          <h1 className="page-title">{name || '…'}</h1>
          <p className="page-lead">
            Задачи, видимые вам. {listId ? <Link to={`/lists/${listId}`}>Открыть list</Link> : null}
          </p>
          {error ? <p className="form-error">{error}</p> : null}
        </div>
        <div className="top-actions">
          <button type="button" className="ghost" onClick={() => void toggleArchive()}>
            {archived ? 'Разархивировать' : 'В архив'}
          </button>
          <Link className="ghost" to="/brands">
            К справочнику
          </Link>
        </div>
      </header>
      <div className="content">
        <div className="card-list">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} onOpen={() => navigate(`/tasks/${task.id}`)} />
          ))}
        </div>
        {tasks.length === 0 && !error ? <p className="empty">Нет видимых задач</p> : null}
      </div>
    </>
  )
}
