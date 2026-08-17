import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { formatDateTime, PRIORITY_LABEL } from '../lib/format'
import { resolveStatusesForList } from '../lib/status'
import { useStore } from '../store'
import type { Task } from '../types'
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
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description)
  const [comment, setComment] = useState('')
  const [checkText, setCheckText] = useState('')

  useEffect(() => {
    setTitle(task.title)
    setDescription(task.description)
  }, [task.description, task.id, task.title])

  return (
    <aside className="panel">
      <div className="panel-head">
        <div>
          <div className="kicker">{list?.name}</div>
          <input
            className="panel-title-input"
            value={title}
            aria-label="Название"
            onChange={(event) => setTitle(event.target.value)}
            onBlur={() => {
              const next = title.trim()
              if (!next) {
                setTitle(task.title)
                return
              }
              if (next !== task.title) void store.patchTask(task.id, { title: next })
            }}
          />
          {blocked ? <p className="blocked">Заблокирована входящей связью BLOCKS</p> : null}
          {task.domainLabel && task.domainEntityType && task.domainEntityId ? (
            <p className="page-lead">
              Host:{' '}
              <Link to={`/host/${task.domainEntityType}/${task.domainEntityId}`}>{task.domainLabel}</Link>
            </p>
          ) : null}
        </div>
        <div className="top-actions">
          <button type="button" className="ghost" onClick={() => void store.toggleFavorite('TASK', task.id)}>
            {favorite ? 'В избранном' : 'В избранное'}
          </button>
          {onClose ? (
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
              ×
            </button>
          ) : (
            <Link className="icon-btn" to={`/lists/${task.listId}`} aria-label="К списку">
              ×
            </Link>
          )}
        </div>
      </div>

      <div className="row-2">
        <div className="field">
          <label>Колонка</label>
          <select
            value={task.listStatusId ?? ''}
            onChange={(event) => {
              if (event.target.value) void store.setStatus(task.id, event.target.value)
            }}
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
              void store.patchTask(task.id, { priority: event.target.value as Task['priority'] })
            }
          >
            {(['URGENT', 'HIGH', 'MEDIUM', 'LOW'] as const).map((value) => (
              <option key={value} value={value}>
                {PRIORITY_LABEL[value]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label>Срок</label>
        <input
          type="date"
          value={task.dueDate ?? ''}
          onChange={(event) => void store.patchTask(task.id, { dueDate: event.target.value || null })}
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
                className={`chip ${on ? 'on' : ''}`}
                onClick={() => void store.toggleAssignee(task.id, user.id)}
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
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          onBlur={() => {
            if (description !== task.description) void store.patchTask(task.id, { description })
          }}
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
                {rel.type === 'BLOCKS' && rel.fromTaskId === task.id
                  ? 'блокирует'
                  : rel.type === 'BLOCKS'
                    ? 'ждёт'
                    : 'связана'}{' '}
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
              onChange={() => void store.toggleChecklist(task.id, item.id)}
            />
            <span>{item.text}</span>
          </label>
        ))}
        <form
          className="quick"
          onSubmit={(event: FormEvent) => {
            event.preventDefault()
            if (!checkText.trim()) return
            void store.addChecklist(task.id, checkText)
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
          onSubmit={(event: FormEvent) => {
            event.preventDefault()
            if (!comment.trim()) return
            void store.addComment(task.id, comment)
            setComment('')
          }}
        >
          <input
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Комментарий… @[uuid] для упоминания"
          />
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
        {activity.length === 0 ? <p className="muted">Пока нет записей</p> : null}
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
