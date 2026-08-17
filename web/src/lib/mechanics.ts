/** Drop-id and grouping helpers — unit-tested, shared by views/DnD. */

export const COLUMN_PREFIX = 'column-'
export const LIST_DROP_PREFIX = 'list-drop-'

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
