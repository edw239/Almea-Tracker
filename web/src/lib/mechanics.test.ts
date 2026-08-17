import { describe, expect, it } from 'vitest'
import {
  columnDropId,
  groupTasks,
  listDropId,
  mapViewType,
  parseColumnDropId,
  parseListDropId,
} from './mechanics'

describe('drop ids', () => {
  it('round-trips column drop ids', () => {
    expect(parseColumnDropId(columnDropId('st-1'))).toBe('st-1')
  })

  it('round-trips list drop ids', () => {
    expect(parseListDropId(listDropId('list-1'))).toBe('list-1')
  })

  it('rejects foreign ids', () => {
    expect(parseColumnDropId('list-drop-x')).toBeNull()
    expect(parseListDropId('column-x')).toBeNull()
  })
})

describe('mapViewType', () => {
  it('falls back to LIST', () => {
    expect(mapViewType('nope')).toBe('LIST')
    expect(mapViewType('BOARD')).toBe('BOARD')
  })
})

describe('groupTasks', () => {
  const sample = [
    {
      id: '1',
      status: 'OPEN',
      priority: 'HIGH',
      assigneeIds: ['u1'],
      dueDate: '2026-08-17',
      listStatusId: 's1',
    },
    {
      id: '2',
      status: 'DONE',
      priority: 'LOW',
      assigneeIds: [],
      dueDate: null,
      listStatusId: 's2',
    },
  ]

  it('returns single bucket for NONE', () => {
    expect(groupTasks(sample, 'NONE')).toHaveLength(1)
  })

  it('groups by priority', () => {
    const groups = groupTasks(sample, 'PRIORITY')
    expect(groups.map((g) => g.key).sort()).toEqual(['HIGH', 'LOW'])
  })

  it('groups unassigned separately', () => {
    const groups = groupTasks(sample, 'ASSIGNEE')
    expect(groups.some((g) => g.key === 'unassigned')).toBe(true)
  })
})
