import { Link, useParams } from 'react-router-dom'
import { TaskPanel } from '../components/TaskPanel'
import { useStore } from '../store'

export function TaskPage() {
  const { taskId } = useParams()
  const store = useStore()
  const task = store.tasks.find((item) => item.id === taskId)
  if (!task) {
    return (
      <div className="content">
        <p>Задача не найдена.</p>
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
            <h1 className="page-title">{task.title}</h1>
            <p className="page-lead">
              Deep-link карточки. List:{' '}
              <Link to={`/lists/${task.listId}`}>{list?.name}</Link>
            </p>
          </div>
        </header>
        <div className="content">
          <p className="page-lead">{task.description}</p>
        </div>
      </div>
      <TaskPanel task={task} />
    </div>
  )
}
