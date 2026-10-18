/** Drop-id and grouping helpers — unit-tested, shared by views/DnD. */

export const COLUMN_PREFIX = 'column-'
export const LIST_DROP_PREFIX = 'list-drop-'

/**
 * Optimistically reorder a task within (or into) a list.
 * Places `taskId` immediately after `afterTaskId` (null = top of list).
 * Returns a new tasks array; unknown taskId returns the original reference.
 */
export function applyOptimisticMove<T extends { id: string; listId: string; position: number }>(
  tasks: readonly T[],
  taskId: string,
  afterTaskId: string | null,
  listId?: string,
): T[] {
  const moving = tasks.find((task) => task.id === taskId)
  if (!moving) return tasks as T[]

  const targetListId = listId ?? moving.listId
  const others = tasks.filter((task) => task.id !== taskId)
  const inTarget = others
    .filter((task) => task.listId === targetListId)
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))

  let insertAt = 0
  if (afterTaskId != null) {
    const afterIndex = inTarget.findIndex((task) => task.id === afterTaskId)
    insertAt = afterIndex >= 0 ? afterIndex + 1 : inTarget.length
  }

  const reordered = [...inTarget]
  reordered.splice(insertAt, 0, { ...moving, listId: targetListId })
  const positioned = reordered.map((task, index) =>
    task.position === index && task.listId === targetListId ? task : { ...task, position: index, listId: targetListId },
  )

  const outside = others.filter((task) => task.listId !== targetListId)
  return [...outside, ...positioned]
}

export function columnDropId(statusId: string): string {
  return `${COLUMN_PREFIX}${statusId}`
}

export function parseColumnDropId(id: string): string | null {
  return id.startsWith(COLUMN_PREFIX) ? id.slice(COLUMN_PREFIX.length) : null
}

export function listDropId(listId: string): string {
  return `${LIST_DROP_PREFIX}${listId}`
}

export function parseListDropId(id: string): string | null {
  return id.startsWith(LIST_DROP_PREFIX) ? id.slice(LIST_DROP_PREFIX.length) : null
}

export type GroupBy = 'NONE' | 'STATUS' | 'PRIORITY' | 'ASSIGNEE' | 'DUE_DATE'

export type GroupBucket<T> = {
  key: string
  label: string
  tasks: T[]
}

export function mapViewType(raw: string | null | undefined): 'LIST' | 'BOARD' | 'TABLE' | 'CALENDAR' {
  if (raw === 'BOARD' || raw === 'TABLE' || raw === 'CALENDAR' || raw === 'LIST') return raw
  return 'LIST'
}

export function groupTasks<
  T extends {
    id: string
    status: string
    priority: string
    assigneeIds: string[]
    dueDate: string | null
    listStatusId: string | null
  },
>(tasks: T[], groupBy: GroupBy, statusName?: (id: string | null) => string): GroupBucket<T>[] {
  if (groupBy === 'NONE') {
    return [{ key: 'all', label: 'Все', tasks }]
  }
  const map = new Map<string, GroupBucket<T>>()
  const ensure = (key: string, label: string) => {
    let bucket = map.get(key)
    if (!bucket) {
      bucket = { key, label, tasks: [] }
      map.set(key, bucket)
    }
    return bucket
  }
  for (const task of tasks) {
    if (groupBy === 'STATUS') {
      const key = task.listStatusId ?? task.status
      ensure(key, statusName?.(task.listStatusId) ?? task.status).tasks.push(task)
    } else if (groupBy === 'PRIORITY') {
      ensure(task.priority, task.priority).tasks.push(task)
    } else if (groupBy === 'ASSIGNEE') {
      if (task.assigneeIds.length === 0) {
        ensure('unassigned', 'Без исполнителя').tasks.push(task)
      } else {
        for (const id of task.assigneeIds) {
          ensure(id, id).tasks.push(task)
        }
      }
    } else if (groupBy === 'DUE_DATE') {
      ensure(task.dueDate ?? 'none', task.dueDate ?? 'Без даты').tasks.push(task)
    }
  }
  return [...map.values()]
}
