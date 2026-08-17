import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react'
import { useAuth } from './auth'
import { api, ApiError, type TaskPatch } from './lib/api'
import { SYSTEM_LIST_PERSONAL_INBOX } from './lib/constants'
import {
  flattenSpaces,
  mapActivity,
  mapApiTask,
  mapApiUser,
  mapComments,
  mapRelations,
  type ApiTask,
} from './lib/mappers'
import type {
  Activity,
  Comment,
  DemoState,
  Favorite,
  FavoriteEntityType,
  ListStatus,
  Notification,
  Relation,
  Task,
} from './types'

const emptyState: DemoState = {
  users: [],
  spaces: [],
  folders: [],
  lists: [],
  listStatuses: [],
  tasks: [],
  comments: [],
  activity: [],
  relations: [],
  notifications: [],
  favorites: [],
}

type Action =
  | { type: 'CLEAR' }
  | {
      type: 'HYDRATE'
      payload: Pick<
        DemoState,
        'users' | 'spaces' | 'folders' | 'lists' | 'tasks' | 'listStatuses' | 'favorites'
      >
    }
  | { type: 'MERGE_TASKS'; tasks: Task[] }
  | { type: 'REPLACE_LIST_TASKS'; listId: string; tasks: Task[] }
  | { type: 'MERGE_STATUSES'; statuses: ListStatus[] }
  | { type: 'UPSERT_TASK'; task: Task }
  | { type: 'MERGE_COLLAB'; comments: Comment[]; activity: Activity[]; relations: Relation[] }
  | { type: 'SET_ERROR'; message: string | null }
  | { type: 'SET_READY'; ready: boolean }
  | { type: 'SET_FAVORITES'; favorites: Favorite[] }
  | { type: 'SET_NOTIFICATIONS'; notifications: Notification[] }
  | { type: 'PATCH_NOTIFICATION'; id: string; patch: Partial<Notification> }

type StoreState = DemoState & {
  ready: boolean
  error: string | null
}

function mergeById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const map = new Map(current.map((item) => [item.id, item]))
  for (const item of incoming) map.set(item.id, item)
  return [...map.values()]
}

function reducer(state: StoreState, action: Action): StoreState {
  switch (action.type) {
    case 'CLEAR':
      return { ...emptyState, ready: false, error: null }
    case 'HYDRATE':
      return { ...state, ...action.payload, ready: true, error: null }
    case 'MERGE_TASKS':
      return { ...state, tasks: mergeById(state.tasks, action.tasks) }
    case 'REPLACE_LIST_TASKS':
      return {
        ...state,
        tasks: [...state.tasks.filter((task) => task.listId !== action.listId), ...action.tasks],
      }
    case 'MERGE_STATUSES':
      return { ...state, listStatuses: mergeById(state.listStatuses, action.statuses) }
    case 'UPSERT_TASK':
      return { ...state, tasks: mergeById(state.tasks, [action.task]) }
    case 'MERGE_COLLAB':
      return {
        ...state,
        comments: mergeById(state.comments, action.comments),
        activity: mergeById(state.activity, action.activity),
        relations: mergeById(state.relations, action.relations),
      }
    case 'SET_ERROR':
      return { ...state, error: action.message }
    case 'SET_READY':
      return { ...state, ready: action.ready }
    case 'SET_FAVORITES':
      return { ...state, favorites: action.favorites }
    case 'SET_NOTIFICATIONS':
      return { ...state, notifications: action.notifications }
    case 'PATCH_NOTIFICATION':
      return {
        ...state,
        notifications: state.notifications.map((item) =>
          item.id === action.id ? { ...item, ...action.patch } : item,
        ),
      }
    default:
      return state
  }
}

type StoreValue = StoreState & {
  currentUserId: string
  personalInboxListId: string | null
  ensureList: (listId: string, filters?: string) => Promise<void>
  ensureTask: (taskId: string) => Promise<void>
  loadOverdue: () => Promise<void>
  addTask: (listId: string, title: string) => Promise<Task>
  patchTask: (taskId: string, patch: TaskPatch) => Promise<void>
  setStatus: (taskId: string, listStatusId: string) => Promise<void>
  moveTask: (taskId: string, afterTaskId: string | null, listId?: string) => Promise<void>
  toggleAssignee: (taskId: string, userId: string) => Promise<void>
  toggleFavorite: (entityType: FavoriteEntityType, entityId: string) => Promise<void>
  addComment: (taskId: string, body: string) => Promise<void>
  addChecklist: (taskId: string, text: string) => Promise<void>
  toggleChecklist: (taskId: string, itemId: string) => Promise<void>
  bulkUpdate: (taskIds: string[], patch: Omit<TaskPatch, 'title' | 'description' | 'dueDate'>) => Promise<void>
  loadNotifications: () => Promise<void>
  markNotificationRead: (id: string) => Promise<void>
  markAllNotificationsRead: () => Promise<void>
  snoozeNotification: (id: string) => Promise<void>
  clearNotification: (id: string) => Promise<void>
}

const StoreContext = createContext<StoreValue | null>(null)

function hydrateDetail(dispatch: (action: Action) => void, row: ApiTask) {
  const task = mapApiTask(row)
  dispatch({ type: 'UPSERT_TASK', task })
  dispatch({
    type: 'MERGE_COLLAB',
    comments: mapComments(row.comments),
    activity: mapActivity(row.activities),
    relations: mapRelations(row.relationsFrom, row.relationsTo),
  })
  return task
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const [state, dispatch] = useReducer(reducer, { ...emptyState, ready: false, error: null })
  const stateRef = useRef(state)
  stateRef.current = state
  const userId = auth.user?.id

  const fail = useCallback((error: unknown, fallback: string) => {
    const message = error instanceof ApiError ? error.message : fallback
    dispatch({ type: 'SET_ERROR', message })
  }, [])

  useEffect(() => {
    if (!userId) {
      dispatch({ type: 'CLEAR' })
      return
    }
    let cancelled = false
    void (async () => {
      dispatch({ type: 'SET_READY', ready: false })
      try {
        const [users, spaces, myWork, favorites, notifications] = await Promise.all([
          api.users(),
          api.spaces(),
          api.myWork(),
          api.favorites().catch(() => []),
          api.notifications().catch(() => []),
        ])
        if (cancelled) return
        const tree = flattenSpaces(spaces)
        const tasks = myWork.map(mapApiTask)
        const listIds = [...new Set(tasks.map((task) => task.listId))]
        const statusGroups = await Promise.all(listIds.map((id) => api.listStatuses(id)))
        if (cancelled) return
        dispatch({
          type: 'HYDRATE',
          payload: {
            users: users.map(mapApiUser),
            spaces: tree.spaces,
            folders: tree.folders,
            lists: tree.lists,
            tasks,
            listStatuses: statusGroups.flat(),
            favorites: favorites.map((item) => ({
              entityType: item.entityType,
              entityId: item.entityId,
            })),
          },
        })
        dispatch({
          type: 'SET_NOTIFICATIONS',
          notifications: notifications.map((item) => ({
            id: item.id,
            code: item.code as Notification['code'],
            title: item.title,
            body: item.body,
            taskId: item.taskId,
            createdAt: item.createdAt,
            read: Boolean(item.readAt),
            severity: item.severity,
          })),
        })
      } catch (error) {
        if (cancelled) return
        fail(error, 'Не удалось загрузить данные')
        dispatch({ type: 'SET_READY', ready: true })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [fail, userId])

  const ensureList = useCallback(
    async (listId: string, filters?: string) => {
      try {
        const [page, statuses] = await Promise.all([
          api.listTasks(listId, filters ? { filters } : undefined),
          api.listStatuses(listId),
        ])
        dispatch({ type: 'REPLACE_LIST_TASKS', listId, tasks: page.items.map(mapApiTask) })
        dispatch({ type: 'MERGE_STATUSES', statuses })
      } catch (error) {
        fail(error, 'Не удалось загрузить список')
      }
    },
    [fail],
  )

  const ensureTask = useCallback(
    async (taskId: string) => {
      try {
        const row = await api.task(taskId)
        const task = hydrateDetail(dispatch, row)
        await ensureList(task.listId)
      } catch (error) {
        fail(error, 'Не удалось загрузить задачу')
      }
    },
    [ensureList, fail],
  )

  const loadOverdue = useCallback(async () => {
    try {
      const rows = await api.overdue()
      dispatch({ type: 'MERGE_TASKS', tasks: rows.map(mapApiTask) })
    } catch (error) {
      fail(error, 'Не удалось загрузить просроченные')
    }
  }, [fail])

  const addTask = useCallback(async (listId: string, title: string) => {
    const created = mapApiTask(await api.createTask(listId, title))
    dispatch({ type: 'UPSERT_TASK', task: created })
    return created
  }, [])

  const patchTask = useCallback(
    async (taskId: string, patch: TaskPatch) => {
      const previous = stateRef.current.tasks.find((item) => item.id === taskId)
      try {
        const updated = mapApiTask(await api.updateTask(taskId, patch))
        dispatch({ type: 'UPSERT_TASK', task: updated })
      } catch (error) {
        if (previous) dispatch({ type: 'UPSERT_TASK', task: previous })
        fail(error, 'Не удалось сохранить задачу')
        throw error
      }
    },
    [fail],
  )

  const setStatus = useCallback(
    async (taskId: string, listStatusId: string) => {
      const previous = stateRef.current.tasks.find((item) => item.id === taskId)
      const column = stateRef.current.listStatuses.find((item) => item.id === listStatusId)
      if (previous && column) {
        dispatch({
          type: 'UPSERT_TASK',
          task: {
            ...previous,
            listStatusId: column.id,
            status: column.category,
            completedAt: column.category === 'DONE' ? (previous.completedAt ?? new Date().toISOString()) : null,
          },
        })
      }
      try {
        const updated = mapApiTask(await api.moveTask(taskId, { listStatusId }))
        dispatch({ type: 'UPSERT_TASK', task: updated })
      } catch (error) {
        if (previous) dispatch({ type: 'UPSERT_TASK', task: previous })
        fail(error, 'Не удалось сменить статус')
      }
    },
    [fail],
  )

  const moveTask = useCallback(
    async (taskId: string, afterTaskId: string | null, listId?: string) => {
      const previous = stateRef.current.tasks.find((item) => item.id === taskId)
      try {
        const updated = mapApiTask(await api.moveTask(taskId, { afterTaskId, listId }))
        dispatch({ type: 'UPSERT_TASK', task: updated })
      } catch (error) {
        if (previous) dispatch({ type: 'UPSERT_TASK', task: previous })
        fail(error, 'Не удалось переместить задачу')
      }
    },
    [fail],
  )

  const toggleAssignee = useCallback(
    async (taskId: string, targetUserId: string) => {
      const task = stateRef.current.tasks.find((item) => item.id === taskId)
      if (!task) return
      const has = task.assigneeIds.includes(targetUserId)
      const assigneeIds = has
        ? task.assigneeIds.filter((id) => id !== targetUserId)
        : [...task.assigneeIds, targetUserId]
      await patchTask(taskId, { assigneeIds })
    },
    [patchTask],
  )

  const toggleFavorite = useCallback(
    async (entityType: FavoriteEntityType, entityId: string) => {
      const exists = stateRef.current.favorites.some(
        (item) => item.entityType === entityType && item.entityId === entityId,
      )
      const next = exists
        ? stateRef.current.favorites.filter(
            (item) => !(item.entityType === entityType && item.entityId === entityId),
          )
        : [...stateRef.current.favorites, { entityType, entityId }]
      dispatch({ type: 'SET_FAVORITES', favorites: next })
      try {
        if (exists) await api.removeFavorite(entityType, entityId)
        else await api.addFavorite(entityType, entityId)
      } catch (error) {
        dispatch({ type: 'SET_FAVORITES', favorites: stateRef.current.favorites })
        fail(error, 'Не удалось обновить избранное')
      }
    },
    [fail],
  )

  const addComment = useCallback(
    async (taskId: string, body: string) => {
      try {
        const row = (await api.addComment(taskId, body)) as {
          id: string
          taskId: string
          userId: string
          body: string
          createdAt: string
        }
        dispatch({
          type: 'MERGE_COLLAB',
          comments: mapComments([row]),
          activity: [],
          relations: [],
        })
      } catch (error) {
        fail(error, 'Не удалось отправить комментарий')
      }
    },
    [fail],
  )

  const addChecklist = useCallback(
    async (taskId: string, text: string) => {
      try {
        await api.addChecklist(taskId, text)
        const row = await api.task(taskId)
        hydrateDetail(dispatch, row)
      } catch (error) {
        fail(error, 'Не удалось добавить пункт')
      }
    },
    [fail],
  )

  const toggleChecklist = useCallback(
    async (taskId: string, itemId: string) => {
      try {
        await api.toggleChecklist(taskId, itemId)
        const row = await api.task(taskId)
        hydrateDetail(dispatch, row)
      } catch (error) {
        fail(error, 'Не удалось обновить чеклист')
      }
    },
    [fail],
  )

  const bulkUpdate = useCallback(
    async (taskIds: string[], patch: Omit<TaskPatch, 'title' | 'description' | 'dueDate'>) => {
      try {
        const rows = await api.bulkUpdate({ taskIds, ...patch })
        dispatch({ type: 'MERGE_TASKS', tasks: rows.map(mapApiTask) })
      } catch (error) {
        fail(error, 'Не удалось обновить задачи')
      }
    },
    [fail],
  )

  const loadNotifications = useCallback(async () => {
    try {
      const rows = await api.notifications()
      dispatch({
        type: 'SET_NOTIFICATIONS',
        notifications: rows.map((item) => ({
          id: item.id,
          code: item.code as Notification['code'],
          title: item.title,
          body: item.body,
          taskId: item.taskId,
          createdAt: item.createdAt,
          read: Boolean(item.readAt),
          severity: item.severity,
        })),
      })
    } catch (error) {
      fail(error, 'Не удалось загрузить inbox')
    }
  }, [fail])

  const markNotificationRead = useCallback(
    async (id: string) => {
      dispatch({ type: 'PATCH_NOTIFICATION', id, patch: { read: true } })
      try {
        await api.markNotificationRead(id)
      } catch (error) {
        fail(error, 'Не удалось отметить прочитанным')
        await loadNotifications()
      }
    },
    [fail, loadNotifications],
  )

  const markAllNotificationsRead = useCallback(async () => {
    dispatch({
      type: 'SET_NOTIFICATIONS',
      notifications: stateRef.current.notifications.map((item) => ({ ...item, read: true })),
    })
    try {
      await api.markAllNotificationsRead()
    } catch (error) {
      fail(error, 'Не удалось отметить все')
      await loadNotifications()
    }
  }, [fail, loadNotifications])

  const snoozeNotification = useCallback(
    async (id: string) => {
      try {
        await api.snoozeNotification(id)
        dispatch({
          type: 'SET_NOTIFICATIONS',
          notifications: stateRef.current.notifications.filter((item) => item.id !== id),
        })
      } catch (error) {
        fail(error, 'Не удалось отложить')
      }
    },
    [fail],
  )

  const clearNotification = useCallback(
    async (id: string) => {
      try {
        await api.clearNotification(id)
        dispatch({
          type: 'SET_NOTIFICATIONS',
          notifications: stateRef.current.notifications.filter((item) => item.id !== id),
        })
      } catch (error) {
        fail(error, 'Не удалось очистить')
      }
    },
    [fail],
  )

  const personalInboxListId =
    state.lists.find((item) => item.systemKey === SYSTEM_LIST_PERSONAL_INBOX)?.id ?? null

  const value = useMemo<StoreValue>(
    () => ({
      ...state,
      currentUserId: userId ?? '',
      personalInboxListId,
      ensureList,
      ensureTask,
      loadOverdue,
      addTask,
      patchTask,
      setStatus,
      moveTask,
      toggleAssignee,
      toggleFavorite,
      addComment,
      addChecklist,
      toggleChecklist,
      bulkUpdate,
      loadNotifications,
      markNotificationRead,
      markAllNotificationsRead,
      snoozeNotification,
      clearNotification,
    }),
    [
      addChecklist,
      addComment,
      addTask,
      bulkUpdate,
      clearNotification,
      ensureList,
      ensureTask,
      loadNotifications,
      loadOverdue,
      markAllNotificationsRead,
      markNotificationRead,
      moveTask,
      patchTask,
      personalInboxListId,
      setStatus,
      snoozeNotification,
      state,
      toggleAssignee,
      toggleChecklist,
      toggleFavorite,
      userId,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('StoreProvider missing')
  return ctx
}

export function useCurrentUser() {
  const store = useStore()
  const user = store.users.find((item) => item.id === store.currentUserId)
  if (!user) throw new Error('Current user missing')
  return user
}
