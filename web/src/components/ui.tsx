import { useState } from 'react'
import type { ListStatus, Task, User } from '../types'
import { dueLabel, isOverdue, progress } from '../lib/format'
import { resolveStatusesForList } from '../lib/status'
import { useStore } from '../store'

export function Avatars({ ids }: { ids: string[] }) {
  const { users } = useStore()
  const shown = ids.slice(0, 3)
  return (
    <span className="avatars">
      {shown.map((id) => {
        const user = users.find((item) => item.id === id)
        if (!user) return null
        return (
          <span className="avatar sm stack" key={id} title={user.name}>
            {user.initials}
          </span>
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
  return (
    <form
      className="quick"
      onSubmit={(event) => {
        event.preventDefault()
        const form = event.currentTarget
        const input = form.elements.namedItem('title') as HTMLInputElement
        const title = input.value.trim()
        if (!title || pending) return
        setPending(true)
        void store
          .addTask(listId, title)
          .then((task) => {
            input.value = ''
            onCreated?.(task.id)
          })
          .finally(() => setPending(false))
      }}
    >
      <input name="title" placeholder={placeholder} disabled={pending} />
      <button className="pill" type="submit" disabled={pending}>
        {pending ? '…' : 'Добавить'}
      </button>
    </form>
  )
}
