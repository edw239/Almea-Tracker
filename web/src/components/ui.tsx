import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ListStatus, Task, User } from '../types'
import { api, ApiError } from '../lib/api'
import { BADGE_BASE } from '../lib/control-styles'
import { dueLabel, isOverdue, progress } from '../lib/format'
import { cn } from '../lib/utils'
import { resolveStatusesForList } from '../lib/status'
import { useStore } from '../store'
import { DatePicker } from './DatePicker'
import { Select } from './Select'
import { Button } from './ui/button'
import { FormNotice } from './ui/form-notice'
import { Input } from './ui/input'

export function Avatars({ ids }: { ids: string[] }) {
  const navigate = useNavigate()
  const { users, currentUserId } = useStore()
  const resolved = ids
    .map((id) => users.find((item) => item.id === id))
    .filter((user): user is User => user != null)
  const shown = resolved.slice(0, 3)
  const overflow = resolved.length - shown.length

  if (shown.length === 0) return null

  return (
    <span className="inline-flex items-center" onClick={(event) => event.stopPropagation()} role="presentation">
      {shown.map((user, index) => (
        <button
          type="button"
          key={user.id}
          title={user.name}
          aria-label={user.name}
          className={cn(
            'relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground ring-2 ring-elevated',
            index > 0 && '-ml-1.5',
          )}
          style={{ zIndex: shown.length - index }}
          onClick={() => navigate(user.id === currentUserId ? '/me' : `/users/${user.id}`)}
        >
          {user.initials}
        </button>
      ))}
      {overflow > 0 ? (
        <span
          className="-ml-1.5 relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-inset text-[10px] font-semibold text-muted-foreground ring-2 ring-elevated"
          title={`Ещё ${overflow}`}
        >
          +{overflow}
        </span>
      ) : null}
    </span>
  )
}

export function StatusChip({ task, statuses }: { task: Task; statuses: ListStatus[] }) {
  const status = statuses.find((item) => item.id === task.listStatusId)
  return <span className={BADGE_BASE}>{status?.name ?? task.status}</span>
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
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-3 rounded px-3 py-2.5 text-left transition-colors hover:bg-inset',
        active && 'accent-marker bg-surface',
      )}
      onClick={onOpen}
    >
      <span
        className={cn(
          'h-8 w-1 shrink-0 rounded-full',
          task.priority === 'URGENT' && 'bg-destructive',
          task.priority === 'HIGH' && 'bg-accent',
          task.priority === 'MEDIUM' && 'bg-muted-foreground/40',
          task.priority === 'LOW' && 'bg-inset',
        )}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{task.title}</span>
        <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
          {list ? <span className={BADGE_BASE}>{list.name}</span> : null}
          <StatusChip task={task} statuses={statuses} />
          {task.domainLabel ? <span className={BADGE_BASE}>{task.domainLabel}</span> : null}
          {due ? (
            <span
              className={cn(
                BADGE_BASE,
                overdue && 'bg-[var(--danger-soft)] text-destructive',
                !overdue && due === 'сегодня' && 'bg-accent text-accent-foreground',
              )}
            >
              {due}
            </span>
          ) : null}
          {bar.total > 0 ? (
            <span className="text-muted-foreground">
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
        return (
          <strong key={index} className="font-medium text-foreground">
            @{user?.name ?? match[1]}
          </strong>
        )
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
      className="flex flex-wrap items-end gap-2 rounded bg-surface p-3"
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
      <Input
        name="title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder={placeholder}
        disabled={pending}
        aria-label="Название"
        className="min-w-[12rem] flex-1"
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
      <DatePicker
        value={dueDate}
        onChange={setDueDate}
        disabled={pending}
        className="w-40"
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
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? '…' : 'Добавить'}
      </Button>
      {error ? (
        <FormNotice tone="error" className="w-full">
          {error}
        </FormNotice>
      ) : null}
    </form>
  )
}
