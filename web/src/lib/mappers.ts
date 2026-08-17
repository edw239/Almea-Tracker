import { initialsFromName } from './format'
import type {
  Activity,
  ChecklistItem,
  Comment,
  ListStatus,
  Relation,
  Space,
  Task,
  TaskList,
  TaskPriority,
  TaskStatus,
  User,
} from '../types'

export type ApiUser = {
  id: string
  email: string
  name: string
  role: string
}

export type ApiAssignee = { userId: string }
export type ApiWatcher = { userId: string }

export type ApiChecklist = {
  id: string
  text: string
  isDone: boolean
  position: number
}

export type ApiComment = {
  id: string
  taskId: string
  userId: string
  body: string
  createdAt: string
}

export type ApiActivity = {
  id: string
  taskId: string
  userId: string | null
  action: string
  createdAt: string
  details?: { reason?: string } | null
}

export type ApiRelation = {
  id: string
  fromTaskId: string
  toTaskId: string
  relationType: 'BLOCKS' | 'RELATES'
}

export type ApiTask = {
  id: string
  listId: string
  parentTaskId: string | null
  ownerUserId: string | null
  title: string
  description: string | null
  status: TaskStatus
  listStatusId: string | null
  priority: TaskPriority
  dueDate: string | null
  startDate: string | null
  completedAt: string | null
  position: number
  assignees?: ApiAssignee[]
  watchers?: ApiWatcher[]
  checklist?: ApiChecklist[]
  comments?: ApiComment[]
  activities?: ApiActivity[]
  relationsFrom?: ApiRelation[]
  relationsTo?: ApiRelation[]
  domainEntityId?: string | null
  domainEntityType?: string | null
  domainLabel?: string | null
  list?: { id: string; name: string; spaceId: string }
  _count?: { children?: number }
}

export type ApiFolder = {
  id: string
  spaceId: string
  name: string
  position: number
}

export type ApiList = {
  id: string
  spaceId: string
  folderId: string | null
  name: string
  position: number
  systemKey: string | null
}

export type ApiSpace = {
  id: string
  name: string
  description: string | null
  isSystem: boolean
  systemKey: string | null
  folders: ApiFolder[]
  lists: ApiList[]
}

export type ApiListStatus = ListStatus

export function toDateOnly(value: string | null | undefined): string | null {
  if (!value) return null
  return value.slice(0, 10)
}

export function mapApiUser(row: ApiUser): User {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    initials: initialsFromName(row.name),
  }
}

export function mapChecklist(items: ApiChecklist[] | undefined): ChecklistItem[] {
  return (items ?? []).map((item) => ({
    id: item.id,
    text: item.text,
    done: item.isDone,
    position: item.position,
  }))
}

export function mapApiTask(row: ApiTask): Task {
  return {
    id: row.id,
    listId: row.listId,
    parentTaskId: row.parentTaskId,
    title: row.title,
    description: row.description ?? '',
    status: row.status,
    listStatusId: row.listStatusId,
    priority: row.priority,
    position: row.position,
    ownerUserId: row.ownerUserId ?? '',
    assigneeIds: (row.assignees ?? []).map((item) => item.userId),
    watcherIds: (row.watchers ?? []).map((item) => item.userId),
    dueDate: toDateOnly(row.dueDate),
    startDate: toDateOnly(row.startDate),
    completedAt: row.completedAt,
    checklist: mapChecklist(row.checklist),
    domainLabel: row.domainLabel ?? null,
    domainEntityId: row.domainEntityId ?? null,
    domainEntityType: row.domainEntityType ?? null,
  }
}

export function mapComments(rows: ApiComment[] | undefined): Comment[] {
  return (rows ?? []).map((row) => ({
    id: row.id,
    taskId: row.taskId,
    userId: row.userId,
    body: row.body,
    createdAt: row.createdAt,
  }))
}

export function mapActivity(rows: ApiActivity[] | undefined): Activity[] {
  return (rows ?? []).map((row) => ({
    id: row.id,
    taskId: row.taskId,
    userId: row.userId ?? '',
    text: row.action,
    createdAt: row.createdAt,
  }))
}

export function mapRelations(from: ApiRelation[] = [], to: ApiRelation[] = []): Relation[] {
  const all = [...from, ...to]
  const seen = new Set<string>()
  return all
    .filter((row) => {
      if (seen.has(row.id)) return false
      seen.add(row.id)
      return true
    })
    .map((row) => ({
      id: row.id,
      fromTaskId: row.fromTaskId,
      toTaskId: row.toTaskId,
      type: row.relationType,
    }))
}

export function flattenSpaces(rows: ApiSpace[]): {
  spaces: Space[]
  folders: ApiFolder[]
  lists: TaskList[]
} {
  return {
    spaces: rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description ?? '',
      isSystem: row.isSystem,
      systemKey: row.systemKey ?? undefined,
    })),
    folders: rows.flatMap((row) => row.folders),
    lists: rows.flatMap((row) =>
      row.lists.map((list) => ({
        id: list.id,
        spaceId: list.spaceId,
        folderId: list.folderId,
        name: list.name,
        position: list.position,
        systemKey: list.systemKey ?? undefined,
      })),
    ),
  }
}
