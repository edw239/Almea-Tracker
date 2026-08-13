export const TaskStatuses = ['OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED'] as const
export type TaskStatus = (typeof TaskStatuses)[number]

export const TaskPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const
export type TaskPriority = (typeof TaskPriorities)[number]

export const ViewTypes = ['LIST', 'BOARD', 'TABLE', 'CALENDAR'] as const
export type ViewType = (typeof ViewTypes)[number]

export const FavoriteEntityTypes = ['TASK_LIST', 'TASK', 'TASK_VIEW'] as const
export type FavoriteEntityType = (typeof FavoriteEntityTypes)[number]

export const NotificationCodes = [
  'TASK_ASSIGNED',
  'TASK_DUE_SOON',
  'TASK_OVERDUE',
  'TASK_MENTION',
  'TASK_COMMENT',
  'TASK_REMINDER',
  'TASK_STATUS_CHANGED',
] as const
export type NotificationCode = (typeof NotificationCodes)[number]

export type User = {
  id: string
  name: string
  role: string
  initials: string
}

export type Space = {
  id: string
  name: string
  description: string
  isSystem: boolean
  systemKey?: string
}

export type Folder = {
  id: string
  spaceId: string
  name: string
  position: number
}

export type TaskList = {
  id: string
  spaceId: string
  folderId: string | null
  name: string
  position: number
  systemKey?: string
}

export type ListStatus = {
  id: string
  spaceId: string
  listId: string | null
  name: string
  color: string
  order: number
  category: TaskStatus
  isDefault: boolean
}

export type ChecklistItem = {
  id: string
  text: string
  done: boolean
  position: number
}

export type Comment = {
  id: string
  taskId: string
  userId: string
  body: string
  createdAt: string
}

export type Activity = {
  id: string
  taskId: string
  userId: string
  text: string
  createdAt: string
}

export type Relation = {
  id: string
  fromTaskId: string
  toTaskId: string
  type: 'BLOCKS' | 'RELATES'
}

export type Task = {
  id: string
  listId: string
  parentTaskId: string | null
  title: string
  description: string
  status: TaskStatus
  listStatusId: string
  priority: TaskPriority
  position: number
  ownerUserId: string
  assigneeIds: string[]
  watcherIds: string[]
  dueDate: string | null
  startDate: string | null
  completedAt: string | null
  checklist: ChecklistItem[]
  domainLabel: string | null
}

export type Notification = {
  id: string
  code: NotificationCode
  title: string
  body: string
  taskId: string | null
  createdAt: string
  read: boolean
  severity: 'LOW' | 'MEDIUM' | 'HIGH'
}

export type Favorite = {
  entityType: FavoriteEntityType
  entityId: string
}

export type DemoState = {
  users: User[]
  spaces: Space[]
  folders: Folder[]
  lists: TaskList[]
  listStatuses: ListStatus[]
  tasks: Task[]
  comments: Comment[]
  activity: Activity[]
  relations: Relation[]
  notifications: Notification[]
  favorites: Favorite[]
}
