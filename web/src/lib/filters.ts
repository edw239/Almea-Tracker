import type { TaskPriority, TaskStatus } from '../types'

export type FilterDraft = {
  status: TaskStatus | ''
  priority: TaskPriority | ''
  assigneeId: string
  title: string
}

export const EMPTY_FILTER: FilterDraft = {
  status: '',
  priority: '',
  assigneeId: '',
  title: '',
}

type FilterCondition = { field: string; operator: string; value?: unknown }
type FilterGroup = { op: 'AND' | 'OR'; children: Array<FilterCondition | FilterGroup> }

/** Builds API FilterGroup (AND of simple conditions) for listTasks filters query. */
export function buildListFilters(draft: FilterDraft): string | undefined {
  const children: FilterCondition[] = []
  if (draft.status) {
    children.push({ field: 'status', operator: 'is', value: draft.status })
  }
  if (draft.priority) {
    children.push({ field: 'priority', operator: 'is', value: draft.priority })
  }
  if (draft.assigneeId) {
    children.push({ field: 'assignee_id', operator: 'is', value: draft.assigneeId })
  }
  const title = draft.title.trim()
  if (title) {
    children.push({ field: 'title', operator: 'contains', value: title })
  }
  if (children.length === 0) return undefined
  return JSON.stringify({ op: 'AND', children })
}

export function hasActiveFilters(draft: FilterDraft): boolean {
  return Boolean(draft.status || draft.priority || draft.assigneeId || draft.title.trim())
}

/** Serializes saved-view filters Json for listTasks query. */
export function filtersToQuery(filters: unknown): string | undefined {
  if (filters == null) return undefined
  if (typeof filters === 'string') {
    const trimmed = filters.trim()
    return trimmed ? trimmed : undefined
  }
  try {
    return JSON.stringify(filters)
  } catch {
    return undefined
  }
}

/** Best-effort reverse of simple AND filter bars into FilterDraft. */
export function parseFiltersToDraft(filters: unknown): FilterDraft {
  const draft: FilterDraft = { ...EMPTY_FILTER }
  const group = normalizeFilterGroup(filters)
  if (!group || group.op !== 'AND') return draft
  for (const child of group.children) {
    if (!child || typeof child !== 'object' || !('field' in child)) continue
    const condition = child as FilterCondition
    if (condition.field === 'status' && typeof condition.value === 'string') {
      draft.status = condition.value as TaskStatus
    }
    if (condition.field === 'priority' && typeof condition.value === 'string') {
      draft.priority = condition.value as TaskPriority
    }
    if (condition.field === 'assignee_id' && typeof condition.value === 'string') {
      draft.assigneeId = condition.value
    }
    if (condition.field === 'title' && typeof condition.value === 'string') {
      draft.title = condition.value
    }
  }
  return draft
}

function normalizeFilterGroup(filters: unknown): FilterGroup | null {
  if (filters == null) return null
  let value: unknown = filters
  if (typeof filters === 'string') {
    try {
      value = JSON.parse(filters)
    } catch {
      return null
    }
  }
  if (!value || typeof value !== 'object' || !('op' in value) || !('children' in value)) {
    return null
  }
  return value as FilterGroup
}
