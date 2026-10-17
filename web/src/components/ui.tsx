import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ListStatus, Task, User } from '../types'
import { api, ApiError } from '../lib/api'
import { dueLabel, isOverdue, progress } from '../lib/format'
import { resolveStatusesForList } from '../lib/status'
import { useStore } from '../store'
import { Select } from './Select'

export function Avatars({ ids }: { ids: string[] }) {
  const navigate = useNavigate()
  const { users, currentUserId } = useStore()
  const shown = ids.slice(0, 3)
  return (
    <span className="avatars">
      {shown.map((id) => {
        const user = users.find((item) => item.id === id)
        if (!user) return null
        return (
          <button
            type="button"
            className="avatar sm stack"
            key={id}
            title={user.name}
            aria-label={user.name}
            onClick={(event) => {
              event.stopPropagation()
              navigate(id === currentUserId ? '/me' : `/users/${id}`)
            }}
          >
            {user.initials}
          </button>
        )
      })}
    </span>
  )
}

export function StatusChip({ task, statuses }: { task: Task; statuses: ListStatus[] }) {
  const status = statuses.find((item) => item.id === task.listStatusId)
  return <span className="chip">{status?.name ?? task.status}</span>
}

export function TaskRow({
  task,
  active,
  onOpen,
}: {
  task: Task
  active?: boolean
  onOpen: () => void
}) {
  const store = useStore()
  const list = store.lists.find((item) => item.id === task.listId)
  const statuses = resolveStatusesForList(store, task.listId)
  const overdue = isOverdue(task)
  const due = dueLabel(task)
  const bar = progress(task)

  return (
    <button type="button" className={`task-row ${active ? 'active' : ''}`} onClick={onOpen}>
      <span className={`prio ${task.priority}`} />
      <span>
        <span className="task-title">{task.title}</span>
        <span className="task-meta">
          {list ? <span className="chip">{list.name}</span> : null}
          <StatusChip task={task} statuses={statuses} />
          {task.domainLabel ? <span className="chip">{task.domainLabel}</span> : null}
          {due ? <span className={`chip ${overdue ? 'warn' : due === 'сегодня' ? 'today' : ''}`}>{due}</span> : null}
          {bar.total > 0 ? (
            <span>
              {bar.done}/{bar.total}
            </span>
          ) : null}
        </span>
      </span>
      <Avatars ids={task.assigneeIds} />
    </button>
  )
}

export function MentionText({ body, users }: { body: string; users: User[] }) {
  const parts = body.split(/(@\[[^\]]+\])/)
  return (
    <>
      {parts.map((part, index) => {
        const match = part.match(/^@\[(.+)\]$/)
        if (!match) return <span key={index}>{part}</span>
        const user = users.find((item) => item.id === match[1])
        return <strong key={index}>@{user?.name ?? match[1]}</strong>
      })}
    </>
  )
}

export function QuickAdd({
  listId,
  placeholder = 'Быстрая задача…',
  onCreated,
}: {
  listId: string
  placeholder?: string
  onCreated?: (taskId: string) => void
}) {
  const store = useStore()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [brandId, setBrandId] = useState('')
  const [brands, setBrands] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    let cancelled = false
    void api.hostEntities({ type: 'brand' }).then((rows) => {
      if (!cancelled) setBrands(rows.map((row) => ({ id: row.id, name: row.name })))
    })
    return () => {
      cancelled = true
    }
  }, [])

  function reset() {
    setTitle('')
    setAssigneeId('')
    setDueDate('')
    setBrandId('')
    setError(null)
  }

  async function submit() {
    const nextTitle = title.trim()
    if (!nextTitle || pending) return
    const otherAssignee = Boolean(assigneeId && assigneeId !== store.currentUserId)
    if (otherAssignee && !dueDate) {
      setError('Поручение другому требует срок')
      return
    }
    setPending(true)
    setError(null)
    try {
      const task = await store.addTask(listId, {
        title: nextTitle,
        assigneeIds: assigneeId ? [assigneeId] : [],
        dueDate: dueDate || null,
        hostEntityId: brandId || null,
      })
      reset()
      onCreated?.(task.id)
      void store.loadSummary()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось создать')
    } finally {
      setPending(false)
    }
  }

  return (
    <form
      className="quick quick-row"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          reset()
        }
      }}
    >
      <input
        name="title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder={placeholder}
        disabled={pending}
        aria-label="Название"
      />
      <Select
        variant="inline"
        aria-label="Исполнитель"
        value={assigneeId}
        disabled={pending}
        placeholder="Без исполнителя"
        options={[
          { value: '', label: 'Без исполнителя' },
          ...store.users.map((user) => ({ value: user.id, label: user.name })),
        ]}
        onChange={setAssigneeId}
      />
      <input
        name="due"
        type="date"
        value={dueDate}
        onChange={(event) => setDueDate(event.target.value)}
        disabled={pending}
        aria-label="Срок"
        required={Boolean(assigneeId && assigneeId !== store.currentUserId)}
      />
      <Select
        variant="inline"
        aria-label="Бренд"
        value={brandId}
        disabled={pending}
        placeholder="Бренд"
        options={[
          { value: '', label: 'Бренд' },
          ...brands.map((brand) => ({ value: brand.id, label: brand.name })),
        ]}
        onChange={setBrandId}
      />
      <button className="pill" type="submit" disabled={pending}>
        {pending ? '…' : 'Добавить'}
      </button>
      {error ? <p className="form-error quick-error">{error}</p> : null}
    </form>
  )
}
