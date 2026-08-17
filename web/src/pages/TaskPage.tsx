import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { TaskPanel } from '../components/TaskPanel'
import { useStore } from '../store'

export function TaskPage() {
  const { taskId } = useParams()
  const store = useStore()
  const task = store.tasks.find((item) => item.id === taskId)

  useEffect(() => {
    if (taskId) void store.ensureTask(taskId)
  }, [store, taskId])

  if (!task) {
    return (
      <div className="content">
        <p>{store.ready ? 'Задача не найдена.' : 'Загрузка…'}</p>
        <Link to="/">Назад</Link>
      </div>
    )
  }
  const list = store.lists.find((item) => item.id === task.listId)
  return (
    <div className="with-panel">
      <div>
        <header className="topbar">
          <div>
            <div className="kicker">Task</div>
            <h1 className="page-title">Карточка</h1>
            <p className="page-lead">
              Deep-link. <Link to={`/lists/${task.listId}`}>{list?.name ?? 'Список'}</Link>
            </p>
          </div>
        </header>
      </div>
      <TaskPanel task={task} />
    </div>
  )
}
