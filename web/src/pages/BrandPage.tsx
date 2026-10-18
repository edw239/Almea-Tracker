import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { LoadErrorNotice } from '../components/LoadErrorNotice'
import { PageHeader } from '../components/PageHeader'
import { TaskRow } from '../components/ui'
import { Button } from '../components/ui/button'
import { api, ApiError } from '../lib/api'
import { mapApiTask } from '../lib/mappers'
import { Building2 } from '../lib/icons'
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
    <div className="space-y-6">
      <PageHeader
        overline="Бренд"
        title={name || '…'}
        subtitle={
          <>
            Задачи, видимые вам.{' '}
            {listId ? (
              <Link className="text-link hover:underline" to={`/lists/${listId}`}>
                Открыть list
              </Link>
            ) : null}
          </>
        }
        actions={
          <>
            <Button type="button" variant="secondary" size="sm" onClick={() => void toggleArchive()}>
              {archived ? 'Разархивировать' : 'В архив'}
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/brands">К справочнику</Link>
            </Button>
          </>
        }
      />

      {error ? <LoadErrorNotice message={error} /> : null}

      {tasks.length === 0 && !error ? (
        <EmptyState icon={Building2} title="Задач по бренду нет" description="Создайте задачу с привязкой к этому бренду." />
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
