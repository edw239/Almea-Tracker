import type { DemoState, ListStatus, Task, TaskStatus } from '../types'

export const DEFAULT_STATUSES: Omit<ListStatus, 'id' | 'spaceId' | 'listId'>[] = [
  { name: 'К выполнению', color: '#94a3b8', order: 0, category: 'OPEN', isDefault: true },
  { name: 'В работе', color: '#3b82f6', order: 1, category: 'IN_PROGRESS', isDefault: false },
  { name: 'Готово', color: '#22c55e', order: 2, category: 'DONE', isDefault: false },
  { name: 'Отменено', color: '#ef4444', order: 3, category: 'CANCELLED', isDefault: false },
]

export function resolveStatusesForList(state: DemoState, listId: string): ListStatus[] {
  const list = state.lists.find((item) => item.id === listId)
  const own = state.listStatuses
    .filter((item) => item.listId === listId)
    .sort((a, b) => a.order - b.order)
  if (own.length > 0) return own
  if (!list) return []
  return state.listStatuses
    .filter((item) => item.spaceId === list.spaceId && item.listId === null)
    .sort((a, b) => a.order - b.order)
}

export function defaultStatusForCategory(
  statuses: ListStatus[],
  category: TaskStatus,
): ListStatus | undefined {
  return (
    statuses.find((item) => item.category === category && item.isDefault) ??
    statuses.find((item) => item.category === category)
  )
}

export function applyListStatus(task: Task, listStatus: ListStatus, nowIso: string): Task {
  const done = listStatus.category === 'DONE'
  return {
    ...task,
    listStatusId: listStatus.id,
    status: listStatus.category,
    completedAt: done ? (task.completedAt ?? nowIso) : null,
  }
}

export function boardColumns(statuses: ListStatus[]): ListStatus[] {
  return statuses.filter((item) => item.category !== 'CANCELLED')
}
