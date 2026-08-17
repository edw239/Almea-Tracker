import { api } from '../lib/api'
import type { TaskPatch } from '../lib/api'
import type { FavoriteEntityType, ViewType } from '../types'

/**
 * Data-access boundary. HTTP is the primary implementation (VITE_API_URL).
 * Mock mode keeps demo shell runnable without API for offline smoke checks.
 */
export type TrackerRepository = {
  mode: 'http' | 'mock'
  spaces: () => ReturnType<typeof api.spaces>
  myWork: () => ReturnType<typeof api.myWork>
  listTasks: (listId: string) => ReturnType<typeof api.listTasks>
  createTask: (listId: string, title: string) => ReturnType<typeof api.createTask>
  updateTask: (taskId: string, patch: TaskPatch) => ReturnType<typeof api.updateTask>
  moveTask: (taskId: string, patch: Parameters<typeof api.moveTask>[1]) => ReturnType<typeof api.moveTask>
  putViewPreference: (body: {
    listId: string
    viewType?: ViewType
    groupBy?: string
  }) => ReturnType<typeof api.putViewPreference>
  toggleFavorite: (entityType: FavoriteEntityType, entityId: string, add: boolean) => Promise<unknown>
}

function createHttpRepository(): TrackerRepository {
  return {
    mode: 'http',
    spaces: () => api.spaces(),
    myWork: () => api.myWork(),
    listTasks: (listId) => api.listTasks(listId),
    createTask: (listId, title) => api.createTask(listId, title),
    updateTask: (taskId, patch) => api.updateTask(taskId, patch),
    moveTask: (taskId, patch) => api.moveTask(taskId, patch),
    putViewPreference: (body) => api.putViewPreference(body),
    toggleFavorite: (entityType, entityId, add) =>
      add ? api.addFavorite(entityType, entityId) : api.removeFavorite(entityType, entityId),
  }
}

function createMockRepository(): TrackerRepository {
  const emptyPage = { items: [], nextCursor: null }
  return {
    mode: 'mock',
    spaces: async () => [],
    myWork: async () => [],
    listTasks: async () => emptyPage,
    createTask: async () => {
      throw new Error('Mock repository: enable VITE_API_URL for writes')
    },
    updateTask: async () => {
      throw new Error('Mock repository: enable VITE_API_URL for writes')
    },
    moveTask: async () => {
      throw new Error('Mock repository: enable VITE_API_URL for writes')
    },
    putViewPreference: async () => null,
    toggleFavorite: async () => ({ ok: true }),
  }
}

export function createRepository(): TrackerRepository {
  const url = import.meta.env.VITE_API_URL
  if (typeof url === 'string' && url.length > 0) {
    return createHttpRepository()
  }
  // Default to HTTP against same-origin / vite proxy; mock only when explicitly requested.
  if (import.meta.env.VITE_USE_MOCK === '1') {
    return createMockRepository()
  }
  return createHttpRepository()
}

export const repository = createRepository()
