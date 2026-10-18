import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { TaskPanel } from '../components/TaskPanel'
import { Button } from '../components/ui/button'
import { CardSkeleton } from '../components/ui/Skeleton'
import { ListTodo } from '../lib/icons'
import { useStore } from '../store'

export function TaskPage() {
  const { taskId } = useParams()
  const store = useStore()
  const task = store.tasks.find((item) => item.id === taskId)

  useEffect(() => {
    if (taskId) void store.ensureTask(taskId)
  }, [store, taskId])

  if (!task) {
    return store.ready ? (
      <div className="space-y-4">
        <EmptyState icon={ListTodo} title="Задача не найдена" description="Проверьте ссылку или права доступа." />
        <Button variant="secondary" size="sm" asChild>
          <Link to="/">Назад</Link>
        </Button>
      </div>
    ) : (
      <CardSkeleton />
    )
  }
  const list = store.lists.find((item) => item.id === task.listId)
  return (
    <div className="with-panel">
      <div>
        <PageHeader
          overline="Task"
          title="Карточка"
          subtitle={
            <>
              Deep-link.{' '}
              <Link className="text-link hover:underline" to={`/lists/${task.listId}`}>
                {list?.name ?? 'Список'}
              </Link>
            </>
          }
        />
      </div>
      <TaskPanel task={task} />
    </div>
  )
}
