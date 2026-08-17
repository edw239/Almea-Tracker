import { describe, expect, it } from 'vitest'
import {
  buildListFilters,
  EMPTY_FILTER,
  filtersToQuery,
  hasActiveFilters,
  parseFiltersToDraft,
} from './filters'

describe('buildListFilters', () => {
  it('returns undefined for empty draft', () => {
    expect(buildListFilters(EMPTY_FILTER)).toBeUndefined()
    expect(hasActiveFilters(EMPTY_FILTER)).toBe(false)
  })

  it('builds AND group for selected fields', () => {
    const raw = buildListFilters({
      status: 'OPEN',
      priority: 'HIGH',
      assigneeId: 'u1',
      title: 'KPI',
    })
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw!) as {
      op: string
      children: Array<{ field: string; operator: string; value: unknown }>
    }
    expect(parsed.op).toBe('AND')
    expect(parsed.children).toEqual([
      { field: 'status', operator: 'is', value: 'OPEN' },
      { field: 'priority', operator: 'is', value: 'HIGH' },
      { field: 'assignee_id', operator: 'is', value: 'u1' },
      { field: 'title', operator: 'contains', value: 'KPI' },
    ])
    expect(hasActiveFilters({ status: 'OPEN', priority: '', assigneeId: '', title: '' })).toBe(true)
  })
})

describe('parseFiltersToDraft / filtersToQuery', () => {
  it('round-trips simple AND filters', () => {
    const raw = buildListFilters({
      status: 'DONE',
      priority: '',
      assigneeId: '',
      title: 'lab',
    })
    const draft = parseFiltersToDraft(raw)
    expect(draft).toEqual({ status: 'DONE', priority: '', assigneeId: '', title: 'lab' })
    expect(filtersToQuery(JSON.parse(raw!))).toBe(raw)
  })
})
