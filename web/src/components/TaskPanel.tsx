import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Task } from '../types'
import { formatDateTime } from '../lib/format'
import { resolveStatusesForList } from '../lib/status'
import { useStore } from '../store'
import { MentionText } from './ui'

export function TaskPanel({ task, onClose }: { task: Task; onClose?: () => void }) {
  const store = useStore()
  const statuses = resolveStatusesForList(store, task.listId)
  const list = store.lists.find((item) => item.id === task.listId)
  const comments = store.comments.filter((item) => item.taskId === task.id)
  const activity = store.activity.filter((item) => item.taskId === task.id)
  const relations = store.relations.filter((item) => item.fromTaskId === task.id || item.toTaskId === task.id)
  const subtasks = store.tasks.filter((item) => item.parentTaskId === task.id)
  const blocked = relations.some((item) => item.type === 'BLOCKS' && item.toTaskId === task.id)
  const favorite = store.favorites.some((item) => item.entityType === 'TASK' && item.entityId === task.id)
  const [comment, setComment] = useState('')
  const [checkText, setCheckText] = useState('')

  return (
    <aside className="panel">
      <div className="panel-head">
        <div>
          <div className="kicker">{list?.name}</div>
          <h2 className="task-title" style={{ fontSize: 22, letterSpacing: '-0.03em' }}>
            {task.title}
          </h2>
          {blocked ? <p className="blocked">Заблокирована входящей связью BLOCKS</p> : null}
        </div>
        <div className="top-actions">
          <button
            type="button"
            className="ghost"
            onClick={() =>
              store.dispatch({ type: 'TOGGLE_FAVORITE', entityType: 'TASK', entityId: task.id })
            }
          >
            {favorite ? 'В избранном' : 'В избранное'}
          </button>
          {onClose ? (
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
              ×
            </button>
          ) : (
            <Link className="icon-btn" to="/" aria-label="Назад" style={{ display: 'grid', placeItems: 'center' }}>
              ×
            </Link>
          )}
        </div>
      </div>

      <div className="row-2">
        <div className="field">
          <label>Колонка</label>
          <select
            value={task.listStatusId}
            onChange={(event) =>
              store.dispatch({ type: 'SET_STATUS', taskId: task.id, listStatusId: event.target.value })
            }
          >
            {statuses.map((status) => (
              <option key={status.id} value={status.id}>
                {status.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Приоритет</label>
          <select
            value={task.priority}
            onChange={(event) =>
              store.dispatch({
                type: 'PATCH_TASK',
                taskId: task.id,
                patch: { priority: event.target.value as Task['priority'] },
              })
            }
          >
            <option value="URGENT">Срочно</option>
            <option value="HIGH">Высокий</option>
            <option value="MEDIUM">Средний</option>
            <option value="LOW">Низкий</option>
          </select>
        </div>
      </div>

      <div className="field">
        <label>Срок</label>
        <input
          type="date"
          value={task.dueDate ?? ''}
          onChange={(event) =>
            store.dispatch({
              type: 'PATCH_TASK',
              taskId: task.id,
              patch: { dueDate: event.target.value || null },
            })
          }
        />
      </div>

      <div className="field">
        <label>Исполнители</label>
        <div className="task-meta">
          {store.users.map((user) => {
            const on = task.assigneeIds.includes(user.id)
            return (
              <button
                key={user.id}
                type="button"
                className={`chip ${on ? '' : ''}`}
                style={on ? { background: 'var(--cta)', color: 'var(--cta-text)', borderColor: 'var(--cta)' } : undefined}
                onClick={() => store.dispatch({ type: 'TOGGLE_ASSIGNEE', taskId: task.id, userId: user.id })}
              >
                {user.name}
              </button>
            )
          })}
        </div>
      </div>

      <div className="field">
        <label>Суть</label>
        <textarea
          value={task.description}
          onChange={(event) =>
            store.dispatch({ type: 'PATCH_TASK', taskId: task.id, patch: { description: event.target.value } })
          }
        />
      </div>

      {relations.length > 0 ? (
        <div className="field">
          <label>Связи</label>
          {relations.map((rel) => {
            const otherId = rel.fromTaskId === task.id ? rel.toTaskId : rel.fromTaskId
            const other = store.tasks.find((item) => item.id === otherId)
            return (
              <div key={rel.id} className="chip">
                {rel.type === 'BLOCKS' && rel.fromTaskId === task.id ? 'блокирует' : rel.type === 'BLOCKS' ? 'ждёт' : 'связана'}{' '}
                {other?.title}
              </div>
            )
          })}
        </div>
      ) : null}

      {subtasks.length > 0 ? (
        <div className="field">
          <label>Подзадачи</label>
          {subtasks.map((item) => (
            <Link key={item.id} to={`/tasks/${item.id}`} className="task-title">
              {item.title}
            </Link>
          ))}
        </div>
      ) : null}

      <div className="field">
        <label>Чеклист</label>
        {task.checklist.map((item) => (
          <label key={item.id} className="check">
            <input
              type="checkbox"
              checked={item.done}
              onChange={() => store.dispatch({ type: 'TOGGLE_CHECK', taskId: task.id, itemId: item.id })}
            />
            <span>{item.text}</span>
          </label>
        ))}
        <form
          className="quick"
          onSubmit={(event) => {
            event.preventDefault()
            if (!checkText.trim()) return
            store.dispatch({ type: 'ADD_CHECK', taskId: task.id, text: checkText })
            setCheckText('')
          }}
        >
          <input value={checkText} onChange={(event) => setCheckText(event.target.value)} placeholder="Пункт…" />
        </form>
      </div>

      <div className="field">
        <label>Комментарии</label>
        <form
          className="quick"
          onSubmit={(event) => {
            event.preventDefault()
            if (!comment.trim()) return
            store.dispatch({ type: 'ADD_COMMENT', taskId: task.id, body: comment })
            setComment('')
          }}
        >
          <input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Комментарий CEO…" />
          <button className="pill" type="submit">
            Отправить
          </button>
        </form>
        {comments.map((item) => {
          const author = store.users.find((user) => user.id === item.userId)
          return (
            <div className="comment" key={item.id}>
              <small>
                {author?.name} · {formatDateTime(item.createdAt)}
              </small>
              <p>
                <MentionText body={item.body} users={store.users} />
              </p>
            </div>
          )
        })}
      </div>

      <div className="field">
        <label>Активность</label>
        {activity.map((item) => {
          const author = store.users.find((user) => user.id === item.userId)
          return (
            <div className="comment" key={item.id}>
              <small>
                {author?.name} {item.text} · {formatDateTime(item.createdAt)}
              </small>
            </div>
          )
        })}
      </div>
    </aside>
  )
}
