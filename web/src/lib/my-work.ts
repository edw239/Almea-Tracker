import type { Task } from '../types'
import { isDueSoon, isOverdue } from './format'

export type MyWorkBuckets = {
  overdue: Task[]
  today: Task[]
  later: Task[]
  none: Task[]
  inProgress: number
}

/** Split top-level tasks into due buckets for My Work / cabinet. */
export function bucketMyWorkTasks(tasks: Task[], now = new Date()): MyWorkBuckets {
  const roots = tasks.filter((task) => !task.parentTaskId)
  const overdue = roots.filter((task) => isOverdue(task, now))
  const today = roots.filter((task) => isDueSoon(task, now) && !isOverdue(task, now))
  const later = roots.filter(
    (task) =>
      task.dueDate &&
      !isOverdue(task, now) &&
      !isDueSoon(task, now) &&
      task.status !== 'DONE' &&
      task.status !== 'CANCELLED',
  )
  const none = roots.filter(
    (task) => !task.dueDate && task.status !== 'DONE' && task.status !== 'CANCELLED',
  )
  return {
    overdue,
    today,
    later,
    none,
    inProgress: roots.filter((task) => task.status === 'IN_PROGRESS').length,
  }
}

/** Default My Work membership: owner, assignee, or watcher (matches API scope=default). */
export function isMyWorkTask(task: Task, userId: string): boolean {
  return (
    task.ownerUserId === userId ||
    task.assigneeIds.includes(userId) ||
    task.watcherIds.includes(userId)
  )
}
