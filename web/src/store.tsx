import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react'
import { createSeed, CURRENT_USER_ID, SEED_VERSION } from './data/seed'
import { applyListStatus, defaultStatusForCategory, resolveStatusesForList } from './lib/status'
import { uid } from './lib/format'
import type { DemoState, FavoriteEntityType, Task, TaskPriority } from './types'

const STORAGE_KEY = `almea-tracker-demo-v${SEED_VERSION}`

type Action =
  | { type: 'SET_STATUS'; taskId: string; listStatusId: string }
  | { type: 'PATCH_TASK'; taskId: string; patch: Partial<Pick<Task, 'title' | 'description' | 'priority' | 'dueDate'>> }
  | { type: 'TOGGLE_ASSIGNEE'; taskId: string; userId: string }
  | { type: 'ADD_TASK'; listId: string; title: string }
  | { type: 'TOGGLE_CHECK'; taskId: string; itemId: string }
  | { type: 'ADD_CHECK'; taskId: string; text: string }
  | { type: 'ADD_COMMENT'; taskId: string; body: string }
  | { type: 'MARK_NOTIF'; id: string; read: boolean }
  | { type: 'MARK_ALL_READ' }
  | { type: 'TOGGLE_FAVORITE'; entityType: FavoriteEntityType; entityId: string }
  | { type: 'RESET' }

function loadState(): DemoState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createSeed()
    const parsed = JSON.parse(raw) as DemoState
    if (!parsed.tasks?.length) return createSeed()
    return parsed
  } catch {
    return createSeed()
  }
}

function persist(state: DemoState): DemoState {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  return state
}

function mapTask(state: DemoState, taskId: string, fn: (task: Task) => Task): DemoState {
  return {
    ...state,
    tasks: state.tasks.map((task) => (task.id === taskId ? fn(task) : task)),
  }
}

function reducer(state: DemoState, action: Action): DemoState {
  const now = new Date().toISOString()

  switch (action.type) {
    case 'RESET':
      return persist(createSeed())
    case 'SET_STATUS': {
      const task = state.tasks.find((item) => item.id === action.taskId)
      const listStatus = state.listStatuses.find((item) => item.id === action.listStatusId)
      if (!task || !listStatus) return state
      const next = mapTask(state, action.taskId, (item) => applyListStatus(item, listStatus, now))
      return persist({
        ...next,
        activity: [
          {
            id: uid('a'),
            taskId: action.taskId,
            userId: CURRENT_USER_ID,
            text: `колонка: «${listStatus.name}»`,
            createdAt: now,
          },
          ...next.activity,
        ],
      })
    }
    case 'PATCH_TASK':
      return persist(mapTask(state, action.taskId, (task) => ({ ...task, ...action.patch })))
    case 'TOGGLE_ASSIGNEE':
      return persist(
        mapTask(state, action.taskId, (task) => {
          const has = task.assigneeIds.includes(action.userId)
          return {
            ...task,
            assigneeIds: has
              ? task.assigneeIds.filter((id) => id !== action.userId)
              : [...task.assigneeIds, action.userId],
          }
        }),
      )
    case 'ADD_TASK': {
      const statuses = resolveStatusesForList(state, action.listId)
      const open = defaultStatusForCategory(statuses, 'OPEN')
      if (!open) return state
      const listTasks = state.tasks.filter((item) => item.listId === action.listId && !item.parentTaskId)
      const created: Task = {
        id: uid('t'),
        listId: action.listId,
        parentTaskId: null,
        title: action.title.trim(),
        description: '',
        status: 'OPEN',
        listStatusId: open.id,
        priority: 'MEDIUM' satisfies TaskPriority,
        position: (listTasks.at(-1)?.position ?? 0) + 1,
        ownerUserId: CURRENT_USER_ID,
        assigneeIds: [CURRENT_USER_ID],
        watcherIds: [CURRENT_USER_ID],
        dueDate: null,
        startDate: null,
        completedAt: null,
        checklist: [],
        domainLabel: null,
      }
      return persist({ ...state, tasks: [created, ...state.tasks] })
    }
    case 'TOGGLE_CHECK':
      return persist(
        mapTask(state, action.taskId, (task) => ({
          ...task,
          checklist: task.checklist.map((item) =>
            item.id === action.itemId ? { ...item, done: !item.done } : item,
          ),
        })),
      )
    case 'ADD_CHECK':
      return persist(
        mapTask(state, action.taskId, (task) => ({
          ...task,
          checklist: [
            ...task.checklist,
            { id: uid('c'), text: action.text.trim(), done: false, position: task.checklist.length },
          ],
        })),
      )
    case 'ADD_COMMENT':
      return persist({
        ...state,
        comments: [
          {
            id: uid('cm'),
            taskId: action.taskId,
            userId: CURRENT_USER_ID,
            body: action.body.trim(),
            createdAt: now,
          },
          ...state.comments,
        ],
        notifications: state.notifications,
      })
    case 'MARK_NOTIF':
      return persist({
        ...state,
        notifications: state.notifications.map((item) =>
          item.id === action.id ? { ...item, read: action.read } : item,
        ),
      })
    case 'MARK_ALL_READ':
      return persist({
        ...state,
        notifications: state.notifications.map((item) => ({ ...item, read: true })),
      })
    case 'TOGGLE_FAVORITE': {
      const exists = state.favorites.some(
        (item) => item.entityType === action.entityType && item.entityId === action.entityId,
      )
      return persist({
        ...state,
        favorites: exists
          ? state.favorites.filter(
              (item) => !(item.entityType === action.entityType && item.entityId === action.entityId),
            )
          : [...state.favorites, { entityType: action.entityType, entityId: action.entityId }],
      })
    }
    default:
      return state
  }
}

type StoreValue = DemoState & {
  currentUserId: string
  dispatch: (action: Action) => void
}

const StoreContext = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)
  const value = useMemo(
    () => ({ ...state, currentUserId: CURRENT_USER_ID, dispatch }),
    [state],
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
