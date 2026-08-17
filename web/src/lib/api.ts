import type { FavoriteEntityType, TaskPriority, TaskStatus, ViewType } from '../types'
import type { ApiListStatus, ApiSpace, ApiTask, ApiUser } from './mappers'

const DEFAULT_TIMEOUT_MS = 15_000

export type AuthUser = {
  id: string
  email: string
  name: string
  role: 'GLOBAL_ADMIN' | 'MEMBER'
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
}

export type MovePatch = {
  listId?: string
  listStatusId?: string
  status?: TaskStatus
  afterTaskId?: string | null
  position?: number
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
  login: (email: string, password: string) =>
    request<{ user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request<{ ok: true }>('/api/auth/logout', { method: 'POST' }),
  users: () => request<ApiUser[]>('/api/users'),
  spaces: () => request<ApiSpace[]>('/api/task-spaces'),
  myWork: () => request<ApiTask[]>('/api/tasks'),
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
  createTask: (listId: string, title: string) =>
    request<ApiTask>(`/api/task-lists/${listId}/tasks`, {
      method: 'POST',
      body: JSON.stringify({ title }),
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
    request<{ list: { id: string }; entityType: string; entityId: string }>(
      '/api/host/entity-lists/ensure',
      { method: 'POST', body: JSON.stringify(body) },
    ),
  hostEntity: (entityType: string, entityId: string) =>
    request<{
      entityType: string
      entityId: string
      list: { id: string; name: string } | null
      tasks: ApiTask[]
    }>(`/api/host/entities/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`),
}
