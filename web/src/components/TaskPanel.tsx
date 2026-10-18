import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import { api } from '../lib/api'
import { formatDateTime, PRIORITY_LABEL } from '../lib/format'
import { resolveStatusesForList } from '../lib/status'
import { useStore } from '../store'
import type { Task } from '../types'
import { chipClass } from '../lib/control-styles'
import { CollapsibleSection } from './CollapsibleSection'
import { DatePicker } from './DatePicker'
import { Select } from './Select'
import { MentionText } from './ui'
import { Button } from './ui/button'
import { FormNotice } from './ui/form-notice'
import { Input } from './ui/input'
import { X } from '../lib/icons'

export function TaskPanel({ task, onClose }: { task: Task; onClose?: () => void }) {
  const store = useStore()
  const auth = useAuth()
  const statuses = resolveStatusesForList(store, task.listId)
  const list = store.lists.find((item) => item.id === task.listId)
  const comments = store.comments.filter((item) => item.taskId === task.id)
  const activity = store.activity.filter((item) => item.taskId === task.id)
  const relations = store.relations.filter((item) => item.fromTaskId === task.id || item.toTaskId === task.id)
  const subtasks = store.tasks.filter((item) => item.parentTaskId === task.id)
  const blocked = relations.some((item) => item.type === 'BLOCKS' && item.toTaskId === task.id)
  const favorite = store.favorites.some((item) => item.entityType === 'TASK' && item.entityId === task.id)
  const isCreator = task.createdByUserId === store.currentUserId
  const isAssignee = task.assigneeIds.includes(store.currentUserId)
  const canAcceptReview =
    Boolean(task.submittedAt) &&
    (isCreator || (auth.user?.role === 'PROJECT_MANAGER' && !isAssignee))
  const statusOptions =
    task.reviewRequired && isAssignee && !isCreator
      ? statuses.filter((item) => item.category !== 'DONE')
      : statuses
  const reviewColumn = statuses.find((item) => item.name === 'На проверке')
  const inProgressColumn = statuses.find((item) => item.name === 'В работе')
  const doneColumn = statuses.find((item) => item.category === 'DONE')
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description)
  const [comment, setComment] = useState('')
  const [checkText, setCheckText] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [stuckReason, setStuckReason] = useState('')
  const [stuckError, setStuckError] = useState<string | null>(null)
  const [brands, setBrands] = useState<Array<{ id: string; name: string }>>([])
  const [taskTypes, setTaskTypes] = useState<Array<{ id: string; name: string }>>([])
  const [statusError, setStatusError] = useState<string | null>(null)

  useEffect(() => {
    setTitle(task.title)
    setDescription(task.description)
  }, [task.description, task.id, task.title])

  useEffect(() => {
    let cancelled = false
    void api.hostEntities({ type: 'brand' }).then((rows) => {
      if (!cancelled) setBrands(rows.map((row) => ({ id: row.id, name: row.name })))
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!list?.spaceId) return
    let cancelled = false
    void api.listTaskTypes(list.spaceId).then((rows) => {
      if (!cancelled) setTaskTypes(rows.map((row) => ({ id: row.id, name: row.name })))
    })
    return () => {
      cancelled = true
    }
  }, [list?.spaceId])

  const brandHref = task.hostEntityId
    ? `/brands/${task.hostEntityId}`
    : task.domainLabel && task.domainEntityType && task.domainEntityId
      ? `/host/${task.domainEntityType}/${task.domainEntityId}`
      : null

  return (
    <aside className="panel sticky top-0 h-screen overflow-y-auto border-l border-border bg-surface px-5 py-6 scrollbar-subtle">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="label-overline mb-1">{list?.name}</p>
          <input
            className="w-full border-0 bg-transparent font-display text-[1.375rem] font-medium leading-tight tracking-[-0.03em] text-foreground outline-none focus:shadow-none"
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
          {task.isStuck ? (
            <p className="blocked">
              Застряла{task.stuckReason ? `: ${task.stuckReason}` : ''}
              {task.stuckAt ? ` · ${formatDateTime(task.stuckAt)}` : ''}
            </p>
          ) : null}
          {brandHref && task.domainLabel ? (
            <p className="page-lead">
              Бренд: <Link to={brandHref}>{task.domainLabel}</Link>
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" variant="ghost" size="compact" onClick={() => void store.toggleFavorite('TASK', task.id)}>
            {favorite ? 'В избранном' : 'В избранное'}
          </Button>
          {onClose ? (
            <Button type="button" variant="outline" size="icon" className="size-9" onClick={onClose} aria-label="Закрыть">
              <X size={16} />
            </Button>
          ) : (
            <Button type="button" variant="outline" size="icon" className="size-9" asChild>
              <Link to={`/lists/${task.listId}`} aria-label="К списку">
                <X size={16} />
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="row-2">
        <div className="field">
          <label>Колонка</label>
          <Select
            value={task.listStatusId ?? ''}
            options={statusOptions.map((status) => ({ value: status.id, label: status.name }))}
            onChange={(listStatusId) => {
              if (!listStatusId) return
              setStatusError(null)
              void store.setStatus(task.id, listStatusId).catch((caught) => {
                setStatusError(caught instanceof Error ? caught.message : 'Не удалось сменить статус')
              })
            }}
          />
        </div>
        <div className="field">
          <label>Приоритет</label>
          <Select
            value={task.priority}
            options={(['URGENT', 'HIGH', 'MEDIUM', 'LOW'] as const).map((priority) => ({
              value: priority,
              label: PRIORITY_LABEL[priority],
            }))}
            onChange={(priority) => void store.patchTask(task.id, { priority })}
          />
        </div>
        {taskTypes.length > 0 ? (
          <div className="field">
            <label>Тип</label>
            <Select
              value={task.taskTypeId ?? ''}
              placeholder="—"
              options={[
                { value: '', label: '—' },
                ...taskTypes.map((item) => ({ value: item.id, label: item.name })),
              ]}
              onChange={(taskTypeId) =>
                void store.patchTask(task.id, { taskTypeId: taskTypeId ? taskTypeId : null })
              }
            />
          </div>
        ) : null}
      </div>

      <div className="field">
        <label>
          <input
            type="checkbox"
            checked={task.reviewRequired}
            onChange={(event) => void store.patchTask(task.id, { reviewRequired: event.target.checked })}
          />{' '}
          Нужна приёмка
        </label>
        {task.submittedAt ? (
          <p className="page-lead">Сдано на проверку {formatDateTime(task.submittedAt)}</p>
        ) : null}
        {statusError ? <FormNotice tone="error">{statusError}</FormNotice> : null}
        {stuckError ? <FormNotice tone="error">{stuckError}</FormNotice> : null}
      </div>

      {(isAssignee || task.ownerUserId === store.currentUserId) && task.status !== 'DONE' && task.status !== 'CANCELLED' ? (
        <div className="me-panel">
          {task.isStuck ? (
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setStuckError(null)
                void store.clearStuck(task.id).catch((caught) => {
                  setStuckError(caught instanceof Error ? caught.message : 'Не удалось снять')
                })
              }}
            >
              Снять «застрял»
            </button>
          ) : isAssignee ? (
            <>
              <div className="field">
                <label htmlFor={`stuck-${task.id}`}>Что блокирует</label>
                <input
                  id={`stuck-${task.id}`}
                  value={stuckReason}
                  onChange={(event) => setStuckReason(event.target.value)}
                  placeholder="Кратко: жду ответ, нет доступа…"
                  maxLength={500}
                />
              </div>
              <button
                type="button"
                className="pill"
                onClick={() => {
                  const reason = stuckReason.trim()
                  if (!reason) {
                    setStuckError('Укажите причину')
                    return
                  }
                  setStuckError(null)
                  void store.markStuck(task.id, reason).then(() => setStuckReason('')).catch((caught) => {
                    setStuckError(caught instanceof Error ? caught.message : 'Не удалось отметить')
                  })
                }}
              >
                Я застрял
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      {task.reviewRequired && isAssignee && !task.submittedAt && reviewColumn ? (
        <div className="top-actions">
          <button
            type="button"
            className="pill"
            onClick={() => {
              setStatusError(null)
              void store.setStatus(task.id, reviewColumn.id).catch((caught) => {
                setStatusError(caught instanceof Error ? caught.message : 'Не удалось сдать')
              })
            }}
          >
            Сдать на проверку
          </button>
        </div>
      ) : null}

      {canAcceptReview ? (
        <div className="me-panel">
          <div className="top-actions">
            {doneColumn ? (
              <button
                type="button"
                className="pill"
                onClick={() => {
                  setStatusError(null)
                  void store.setStatus(task.id, doneColumn.id).catch((caught) => {
                    setStatusError(caught instanceof Error ? caught.message : 'Не удалось принять')
                  })
                }}
              >
                Принять
              </button>
            ) : null}
            {inProgressColumn ? (
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setStatusError(null)
                  void store
                    .setStatus(task.id, inProgressColumn.id, {
                      reviewRejectReason: rejectReason.trim() || undefined,
                    })
                    .catch((caught) => {
                      setStatusError(caught instanceof Error ? caught.message : 'Не удалось вернуть')
                    })
                }}
              >
                Вернуть
              </button>
            ) : null}
          </div>
          <div className="field">
            <label htmlFor={`reject-${task.id}`}>Причина возврата</label>
            <input
              id={`reject-${task.id}`}
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder="Что поправить"
            />
          </div>
        </div>
      ) : null}

      <div className="field">
        <label htmlFor={`brand-${task.id}`}>Бренд</label>
        <Select
          id={`brand-${task.id}`}
          value={task.hostEntityId ?? ''}
          placeholder="Без привязки"
          options={[
            { value: '', label: 'Без привязки' },
            ...brands.map((brand) => ({ value: brand.id, label: brand.name })),
          ]}
          onChange={(hostEntityId) =>
            void store.patchTask(task.id, { hostEntityId: hostEntityId ? hostEntityId : null })
          }
        />
      </div>

      <div className="field">
        <label htmlFor={`due-${task.id}`}>Срок</label>
        <DatePicker
          id={`due-${task.id}`}
          value={task.dueDate ?? ''}
          onChange={(dueDate) => void store.patchTask(task.id, { dueDate: dueDate || null })}
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
                className={chipClass(on)}
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

      <CollapsibleSection title="Чеклист" count={task.checklist.length} defaultOpen padding="sm" variant="nested">
        {task.checklist.map((item) => (
          <label key={item.id} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={item.done}
              onChange={() => void store.toggleChecklist(task.id, item.id)}
            />
            <span>{item.text}</span>
          </label>
        ))}
        <form
          className="flex gap-2 pt-2"
          onSubmit={(event: FormEvent) => {
            event.preventDefault()
            if (!checkText.trim()) return
            void store.addChecklist(task.id, checkText)
            setCheckText('')
          }}
        >
          <Input value={checkText} onChange={(event) => setCheckText(event.target.value)} placeholder="Пункт…" />
        </form>
      </CollapsibleSection>

      <CollapsibleSection title="Комментарии" count={comments.length} defaultOpen padding="sm" variant="nested">
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event: FormEvent) => {
            event.preventDefault()
            if (!comment.trim()) return
            void store.addComment(task.id, comment)
            setComment('')
          }}
        >
          <Input
            className="min-w-[12rem] flex-1"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Комментарий… @[uuid] для упоминания"
          />
          <Button type="submit" size="sm">
            Отправить
          </Button>
        </form>
        {comments.map((item) => {
          const author = store.users.find((user) => user.id === item.userId)
          return (
            <div className="rounded bg-inset/50 px-3 py-2" key={item.id}>
              <small className="text-xs text-muted-foreground">
                {author?.name} · {formatDateTime(item.createdAt)}
              </small>
              <p className="mt-1 text-sm">
                <MentionText body={item.body} users={store.users} />
              </p>
            </div>
          )
        })}
      </CollapsibleSection>

      <CollapsibleSection title="Активность" count={activity.length} padding="sm" variant="nested">
        {activity.length === 0 ? <p className="text-sm text-muted-foreground">Пока нет записей</p> : null}
        {activity.map((item) => {
          const author = store.users.find((user) => user.id === item.userId)
          return (
            <div className="text-sm text-muted-foreground" key={item.id}>
              {author?.name} {item.text} · {formatDateTime(item.createdAt)}
            </div>
          )
        })}
      </CollapsibleSection>
    </aside>
  )
}
