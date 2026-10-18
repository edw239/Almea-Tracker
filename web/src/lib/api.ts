import type { FavoriteEntityType, TaskPriority, TaskStatus, ViewType } from '../types'
import type { AccountRole } from './account-role'
import type { ApiListStatus, ApiSpace, ApiTask } from './mappers'
import type {
  BoardBacklogPayload,
  BoardColumnInput,
  BoardDetail,
  BoardSummary,
  BoardViewPayload,
  BurndownPayload,
  CreateBoardBody,
  SprintReportPayload,
  SprintRow,
} from './board-types'

const DEFAULT_TIMEOUT_MS = 15_000

export type AuthUser = {
  id: string
  email: string
  name: string
  role: AccountRole
  mustChangePassword: boolean
}

export type MyWorkScope =
  | 'default'
  | 'assigned'
  | 'owned'
  | 'watching'
  | 'mentions'
  | 'checklist'
  | 'created'
  | 'waiting'
  | 'untriaged'
  | 'review'

export type MeMembership = {
  spaceId: string
  spaceName: string
  systemKey: string | null
  isSystem: boolean
  role: 'OWNER' | 'MEMBER' | 'VIEWER'
}

export type MeProfile = {
  id: string
  email: string
  name: string
  role: AccountRole
  timezone: string
  locale: string
  jobTitle: string | null
  createdAt: string
  passwordChangedAt: string | null
  mustChangePassword: boolean
  memberships: MeMembership[]
}

export type MeProfilePatch = {
  name?: string
  timezone?: string
  locale?: 'ru' | 'en'
  jobTitle?: string | null
}

export type NotificationSettingsCode = {
  code: string
  inApp: boolean
}

export type NotificationSettings = {
  quietHoursFrom: number | null
  quietHoursTo: number | null
  snoozeHoursDefault: number
  codes: NotificationSettingsCode[]
}

export type NotificationSettingsPatch = {
  codes: NotificationSettingsCode[]
  quietHoursFrom?: number | null
  quietHoursTo?: number | null
  snoozeHoursDefault?: number | null
}

export type MeSummary = {
  timezone: string
  asOf: string
  overdue: number
  today: number
  week: number
  inProgress: number
  mineOpen: number
  untriaged: number
  unread: number
}

export type OverviewTask = {
  id: string
  title: string
  status: TaskStatus
  listId: string
  listName: string
  dueDate: string | null
  createdAt: string
  updatedAt: string
  submittedAt: string | null
  assigneeIds: string[]
}

export type OverviewRescheduledTask = OverviewTask & {
  dueDateMoveCount: number
}

export type OverviewResponse = {
  timezone: string
  asOf: string
  scope: 'company' | 'visible'
  unassigned: OverviewTask[]
  stale: OverviewTask[]
  blocked: OverviewTask[]
  awaitingReview: OverviewTask[]
  rescheduled: OverviewRescheduledTask[]
  overdueByUser: Array<{
    userId: string
    userName: string
    count: number
    tasks: OverviewTask[]
  }>
}

export type MeBucketsResponse = {
  timezone: string
  asOf: string
  scope: MyWorkScope
  overdue: ApiTask[]
  today: ApiTask[]
  later: ApiTask[]
  none: ApiTask[]
  inProgress: number
}

export type TaskTypeRow = {
  id: string
  spaceId: string
  key: string
  name: string
  color: string
  position: number
  isSystem: boolean
}

export type MeActivityItem = {
  id: string
  action: string
  details: unknown
  createdAt: string
  taskId: string
  taskTitle: string
}

export type MeActivity = {
  days: number
  since: string
  closed: number
  comments: number
  updates: number
  items: MeActivityItem[]
}

export type DirectoryUser = {
  id: string
  email: string
  name: string
  role: AccountRole
  jobTitle: string | null
  isActive: boolean
}

export type ProvisionedUser = DirectoryUser & { temporaryPassword: string }

export type CreateUserBody = {
  email: string
  name: string
  role?: AccountRole
  jobTitle?: string | null
}

export type UpdateUserBody = {
  name?: string
  role?: AccountRole
  jobTitle?: string | null
  isActive?: boolean
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export type TaskPatch = {
  title?: string
  description?: string
  status?: TaskStatus
  listStatusId?: string
  priority?: TaskPriority
  dueDate?: string | null
  assigneeIds?: string[]
  domainEntityId?: string | null
  domainEntityType?: string | null
  domainLabel?: string | null
  hostEntityId?: string | null
  reviewRequired?: boolean
  reviewRejectReason?: string
  taskTypeId?: string | null
  epicId?: string | null
  storyPoints?: number | null
  labelIds?: string[]
  sprintId?: string | null
}

export type MovePatch = {
  listId?: string
  listStatusId?: string
  status?: TaskStatus
  afterTaskId?: string | null
  position?: number
  reviewRejectReason?: string
}

export type ListTasksPage = {
  items: ApiTask[]
  nextCursor: string | null
}

function apiBase(): string {
  const configured = import.meta.env.VITE_API_URL
  return typeof configured === 'string' ? configured.replace(/\/$/, '') : ''
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    credentials: 'include',
    headers,
    signal: init.signal ?? AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  })

  if (res.status === 204) {
    return undefined as T
  }

  const payload: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const body = payload as { code?: string; message?: string } | null
    throw new ApiError(res.status, body?.code ?? 'REQUEST_FAILED', body?.message ?? res.statusText)
  }
  return payload as T
}

export const api = {
  me: () => request<AuthUser>('/api/auth/me'),
  profile: () => request<MeProfile>('/api/me'),
  updateProfile: (patch: MeProfilePatch) =>
    request<Omit<MeProfile, 'memberships'>>('/api/me', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: true }>('/api/me/password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  notificationSettings: () => request<NotificationSettings>('/api/me/notification-settings'),
  putNotificationSettings: (body: NotificationSettingsPatch) =>
    request<NotificationSettings>('/api/me/notification-settings', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  meSummary: () => request<MeSummary>('/api/me/summary'),
  meBuckets: (scope?: MyWorkScope) => {
    const q = scope && scope !== 'default' ? `?scope=${encodeURIComponent(scope)}` : ''
    return request<MeBucketsResponse>(`/api/me/buckets${q}`)
  },
  overview: () => request<OverviewResponse>('/api/overview'),
  meActivity: (opts?: { days?: number; limit?: number }) => {
    const q = new URLSearchParams()
    if (opts?.days) q.set('days', String(opts.days))
    if (opts?.limit) q.set('limit', String(opts.limit))
    const suffix = q.toString() ? `?${q}` : ''
    return request<MeActivity>(`/api/me/activity${suffix}`)
  },
  login: (email: string, password: string) =>
    request<{ user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request<{ ok: true }>('/api/auth/logout', { method: 'POST' }),
  users: (includeInactive = false) =>
    request<DirectoryUser[]>(`/api/users${includeInactive ? '?includeInactive=true' : ''}`),
  createUser: (body: CreateUserBody) =>
    request<ProvisionedUser>('/api/users', { method: 'POST', body: JSON.stringify(body) }),
  updateUser: (userId: string, body: UpdateUserBody) =>
    request<DirectoryUser>(`/api/users/${userId}`, { method: 'PATCH', body: JSON.stringify(body) }),
  resetUserPassword: (userId: string) =>
    request<ProvisionedUser>(`/api/users/${userId}/reset-password`, { method: 'POST' }),
  user: (userId: string) =>
    request<{
      id: string
      name: string
      role: string
      jobTitle: string | null
      stats: { open: number; overdue: number; shown: number } | null
      tasks: ApiTask[]
    }>(`/api/users/${userId}`),
  spaces: () => request<ApiSpace[]>('/api/task-spaces'),
  myWork: (scope?: MyWorkScope) => {
    const q = scope && scope !== 'default' ? `?scope=${encodeURIComponent(scope)}` : ''
    return request<ApiTask[]>(`/api/tasks${q}`)
  },
  overdue: () => request<ApiTask[]>('/api/tasks/overdue'),
  listTasks: (listId: string, opts?: { filters?: string; cursor?: string; limit?: number }) => {
    const q = new URLSearchParams()
    if (opts?.filters) q.set('filters', opts.filters)
    if (opts?.cursor) q.set('cursor', opts.cursor)
    if (opts?.limit) q.set('limit', String(opts.limit))
    const suffix = q.toString() ? `?${q}` : ''
    return request<ListTasksPage>(`/api/task-lists/${listId}/tasks${suffix}`)
  },
  listStatuses: (listId: string) => request<ApiListStatus[]>(`/api/task-lists/${listId}/statuses`),
  task: (taskId: string) => request<ApiTask>(`/api/tasks/${taskId}`),
  createTask: (
    listId: string,
    body: {
      title: string
      assigneeIds?: string[]
      dueDate?: string | null
      hostEntityId?: string | null
    },
  ) =>
    request<ApiTask>(`/api/task-lists/${listId}/tasks`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateTask: (taskId: string, patch: TaskPatch) =>
    request<ApiTask>(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  moveTask: (taskId: string, patch: MovePatch) =>
    request<ApiTask>(`/api/tasks/${taskId}/move`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  markStuck: (taskId: string, reason: string) =>
    request<ApiTask>(`/api/tasks/${taskId}/stuck`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  clearStuck: (taskId: string) => request<ApiTask>(`/api/tasks/${taskId}/stuck`, { method: 'DELETE' }),
  createListStatus: (
    listId: string,
    body: { name: string; color: string; category: TaskStatus; order?: number },
  ) =>
    request<ApiListStatus>(`/api/task-lists/${listId}/statuses`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateListStatus: (
    id: string,
    body: Partial<{ name: string; color: string; category: TaskStatus; order: number; isDefault: boolean }>,
  ) =>
    request<ApiListStatus>(`/api/task-list-statuses/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteListStatus: (id: string, reassignToStatusId?: string) =>
    request<{ ok: true }>(`/api/task-list-statuses/${id}`, {
      method: 'DELETE',
      body: JSON.stringify(reassignToStatusId ? { reassignToStatusId } : {}),
    }),
  listTaskTypes: (spaceId: string) => request<TaskTypeRow[]>(`/api/task-spaces/${spaceId}/task-types`),
  bulkUpdate: (body: {
    taskIds: string[]
    status?: TaskStatus
    listStatusId?: string
    priority?: TaskPriority
    assigneeIds?: string[]
  }) =>
    request<ApiTask[]>('/api/tasks/bulk', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  addComment: (taskId: string, body: string) =>
    request(`/api/tasks/${taskId}/comments`, { method: 'POST', body: JSON.stringify({ body }) }),
  listComments: (taskId: string) => request(`/api/tasks/${taskId}/comments`),
  addChecklist: (taskId: string, text: string) =>
    request(`/api/tasks/${taskId}/checklist`, { method: 'POST', body: JSON.stringify({ text }) }),
  toggleChecklist: (taskId: string, itemId: string) =>
    request(`/api/tasks/${taskId}/checklist/${itemId}`, { method: 'PATCH' }),
  listActivity: (taskId: string) => request(`/api/tasks/${taskId}/activity`),
  listRelations: (taskId: string) => request(`/api/tasks/${taskId}/relations`),
  getViewPreference: (listId: string) =>
    request<{ viewType: ViewType; groupBy: string } | null>(
      `/api/task-view-preferences?listId=${listId}`,
    ),
  putViewPreference: (body: {
    listId: string
    viewType?: ViewType
    groupBy?: string
    filters?: unknown
  }) => request('/api/task-view-preferences', { method: 'PUT', body: JSON.stringify(body) }),
  listViews: (listId: string) =>
    request<
      Array<{
        id: string
        name: string
        viewType: ViewType
        groupBy: string
        filters: unknown
        isShared: boolean
        ownerId: string
      }>
    >(`/api/task-lists/${listId}/views`),
  createView: (body: {
    listId: string
    name: string
    viewType: ViewType
    groupBy?: string
    isShared?: boolean
    filters?: unknown
  }) =>
    request<{ id: string }>('/api/task-views', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  deleteView: (viewId: string) => request<{ ok: true }>(`/api/task-views/${viewId}`, { method: 'DELETE' }),
  listTemplates: (listId: string) =>
    request<Array<{ id: string; name: string; items: unknown }>>(`/api/task-lists/${listId}/templates`),
  createFromTemplate: (listId: string, templateId: string) =>
    request<ApiTask[]>(`/api/task-lists/${listId}/tasks/from-template/${templateId}`, {
      method: 'POST',
    }),
  listSchedules: (listId: string) =>
    request<
      Array<{
        id: string
        title: string
        frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY'
        byWeekday: number | null
        atMinute: number
        timezone: string
        isActive: boolean
        nextRunAt: string
        lastRunAt: string | null
        templateId: string | null
      }>
    >(`/api/task-lists/${listId}/schedules`),
  createSchedule: (
    listId: string,
    body: {
      title: string
      frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY'
      byWeekday?: number
      byMonthday?: number
      atMinute: number
      timezone: string
      templateId?: string
      assigneeUserId?: string
      dueInDays?: number
    },
  ) =>
    request<{ id: string }>(`/api/task-lists/${listId}/schedules`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateSchedule: (
    id: string,
    body: { isActive?: boolean; title?: string; atMinute?: number },
  ) =>
    request(`/api/task-schedules/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  favorites: () => request<Array<{ entityType: FavoriteEntityType; entityId: string }>>('/api/user-favorites'),
  addFavorite: (entityType: FavoriteEntityType, entityId: string) =>
    request('/api/user-favorites', {
      method: 'POST',
      body: JSON.stringify({ entityType, entityId }),
    }),
  removeFavorite: (entityType: FavoriteEntityType, entityId: string) =>
    request(`/api/user-favorites/${entityType}/${entityId}`, { method: 'DELETE' }),
  notifications: () =>
    request<
      Array<{
        id: string
        code: string
        severity: 'LOW' | 'MEDIUM' | 'HIGH'
        title: string
        body: string
        taskId: string | null
        readAt: string | null
        snoozedUntil: string | null
        createdAt: string
      }>
    >('/api/notifications'),
  notificationsUnreadCount: () => request<{ count: number }>('/api/notifications/unread-count'),
  markNotificationRead: (id: string) => request(`/api/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () => request('/api/notifications/read-all', { method: 'POST' }),
  snoozeNotification: (id: string, hours?: number) =>
    request(`/api/notifications/${id}/snooze`, {
      method: 'PATCH',
      body: JSON.stringify({ hours: hours ?? 4 }),
    }),
  clearNotification: (id: string) => request(`/api/notifications/${id}/clear`, { method: 'PATCH' }),
  ensureHostEntity: (body: { entityType: string; entityId: string; name: string }) =>
    request<{
      list: { id: string }
      entityType: string
      entityId: string
      hostEntity?: { id: string; entityType: string; name: string }
    }>('/api/host/entity-lists/ensure', { method: 'POST', body: JSON.stringify(body) }),
  hostEntity: (entityType: string, entityId: string) =>
    request<{
      entityType?: string
      entityId?: string
      id?: string
      name?: string
      list: { id: string; name: string } | null
      tasks: ApiTask[]
    }>(`/api/host/entities/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`),
  hostEntities: (opts?: { type?: string; query?: string; includeArchived?: boolean }) => {
    const q = new URLSearchParams()
    if (opts?.type) q.set('type', opts.type)
    if (opts?.query) q.set('query', opts.query)
    if (opts?.includeArchived) q.set('includeArchived', 'true')
    q.set('visibleOnly', 'true')
    const suffix = q.toString() ? `?${q}` : ''
    return request<
      Array<{
        id: string
        entityType: string
        name: string
        nameKey: string
        externalKey: string | null
        isArchived: boolean
      }>
    >(`/api/host-entities${suffix}`)
  },
  createHostEntity: (body: { entityType: string; name: string }) =>
    request<{
      id: string
      entityType: string
      name: string
      nameKey: string
      isArchived: boolean
    }>('/api/host-entities', { method: 'POST', body: JSON.stringify(body) }),
  getHostEntity: (id: string) =>
    request<{
      id: string
      entityType: string
      name: string
      isArchived: boolean
      list: { id: string; name: string } | null
      tasks: ApiTask[]
    }>(`/api/host-entities/${id}`),
  patchHostEntity: (id: string, body: { name?: string; isArchived?: boolean; externalKey?: string | null }) =>
    request<{ id: string; name: string; externalKey: string | null; isArchived: boolean }>(
      `/api/host-entities/${id}`,
      {
        method: 'PATCH',
        body: JSON.stringify(body),
      },
    ),
  taskByKey: (key: string) => request<ApiTask>(`/api/tasks/by-key/${encodeURIComponent(key)}`),
  boards: () => request<BoardSummary[]>('/api/boards'),
  board: (id: string) => request<BoardDetail>(`/api/boards/${id}`),
  createBoard: (body: CreateBoardBody) =>
    request<BoardDetail>('/api/boards', { method: 'POST', body: JSON.stringify(body) }),
  updateBoard: (id: string, body: Record<string, unknown>) =>
    request<BoardDetail>(`/api/boards/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  archiveBoard: (id: string) => request<{ ok: true }>(`/api/boards/${id}`, { method: 'DELETE' }),
  boardView: (id: string, query?: Record<string, string | undefined>) => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value) params.set(key, value)
    }
    const suffix = params.toString() ? `?${params}` : ''
    return request<BoardViewPayload>(`/api/boards/${id}/view${suffix}`)
  },
  replaceBoardColumns: (id: string, columns: BoardColumnInput[]) =>
    request<BoardColumnInput[]>(`/api/boards/${id}/columns`, {
      method: 'PUT',
      body: JSON.stringify({ columns }),
    }),
  addQuickFilter: (id: string, body: { name: string; filter: unknown }) =>
    request<{ id: string; name: string }>(`/api/boards/${id}/quick-filters`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  removeQuickFilter: (boardId: string, filterId: string) =>
    request<{ ok: true }>(`/api/boards/${boardId}/quick-filters/${filterId}`, { method: 'DELETE' }),
  createBoardCard: (boardId: string, title: string) =>
    request<ApiTask>(`/api/boards/${boardId}/cards`, { method: 'POST', body: JSON.stringify({ title }) }),
  moveBoardCard: (
    boardId: string,
    taskId: string,
    body: { columnId: string; laneKey?: string; beforeId?: string | null; afterId?: string | null; dueDate?: string | null },
  ) =>
    request<ApiTask>(`/api/boards/${boardId}/cards/${taskId}/move`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  boardBacklog: (boardId: string) => request<BoardBacklogPayload>(`/api/boards/${boardId}/backlog`),
  createBacklogTask: (boardId: string, body: { title: string; listId?: string }) =>
    request<ApiTask>(`/api/boards/${boardId}/backlog/tasks`, { method: 'POST', body: JSON.stringify(body) }),
  boardSprints: (boardId: string) => request<SprintRow[]>(`/api/boards/${boardId}/sprints`),
  createSprint: (boardId: string, body: { name: string; goal?: string; startDate?: string; endDate?: string }) =>
    request<SprintRow>(`/api/boards/${boardId}/sprints`, { method: 'POST', body: JSON.stringify(body) }),
  startSprint: (sprintId: string, confirmMissingDue: boolean) =>
    request<SprintRow>(`/api/sprints/${sprintId}/start`, {
      method: 'POST',
      body: JSON.stringify({ confirmMissingDue }),
    }),
  completeSprint: (
    sprintId: string,
    body: {
      unfinishedTo: 'backlog' | 'sprint'
      sprintId?: string
      createSprint?: { name: string; goal?: string; endDate?: string }
    },
  ) => request<SprintRow>(`/api/sprints/${sprintId}/complete`, { method: 'POST', body: JSON.stringify(body) }),
  boardBurndown: (boardId: string, metric: 'points' | 'count') =>
    request<BurndownPayload>(`/api/boards/${boardId}/reports/burndown?metric=${metric}`),
  boardSprintReport: (boardId: string) => request<SprintReportPayload>(`/api/boards/${boardId}/reports/sprint`),
  boardVelocity: (boardId: string) => request<{ sprints: Array<{ sprintId: string; name: string; commitment: number; completed: number }> }>(`/api/boards/${boardId}/reports/velocity`),
  boardCfd: (boardId: string) =>
    request<{ points: Array<{ date: string; column: string; count: number }>; approximate: boolean }>(
      `/api/boards/${boardId}/reports/cfd`,
    ),
  boardCycle: (boardId: string) =>
    request<{ samples: Array<{ taskId: string; days: number }>; median: number | null; approximate: boolean }>(
      `/api/boards/${boardId}/reports/cycle`,
    ),
  searchLabels: (query: string) => request<Array<{ id: string; name: string }>>(`/api/labels?query=${encodeURIComponent(query)}`),
  createLabel: (name: string) =>
    request<{ id: string; name: string }>('/api/labels', { method: 'POST', body: JSON.stringify({ name }) }),
  createTaskType: (spaceId: string, body: { key: string; name: string; color?: string }) =>
    request<{ id: string; key: string; name: string }>(`/api/task-spaces/${spaceId}/task-types`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
}
