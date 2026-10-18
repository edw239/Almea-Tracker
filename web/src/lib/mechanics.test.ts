import { describe, expect, it } from 'vitest'
import {
  applyOptimisticMove,
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

describe('applyOptimisticMove', () => {
  const tasks = [
    { id: 'a', listId: 'L1', position: 0 },
    { id: 'b', listId: 'L1', position: 1 },
    { id: 'c', listId: 'L1', position: 2 },
    { id: 'x', listId: 'L2', position: 0 },
  ]

  it('moves to top when afterTaskId is null', () => {
    const next = applyOptimisticMove(tasks, 'c', null)
    const order = next.filter((t) => t.listId === 'L1').sort((a, b) => a.position - b.position)
    expect(order.map((t) => t.id)).toEqual(['c', 'a', 'b'])
  })

  it('moves after a sibling', () => {
    const next = applyOptimisticMove(tasks, 'c', 'a')
    const order = next.filter((t) => t.listId === 'L1').sort((a, b) => a.position - b.position)
    expect(order.map((t) => t.id)).toEqual(['a', 'c', 'b'])
  })

  it('moves across lists', () => {
    const next = applyOptimisticMove(tasks, 'x', null, 'L1')
    expect(next.find((t) => t.id === 'x')?.listId).toBe('L1')
    expect(next.find((t) => t.id === 'x')?.position).toBe(0)
  })

  it('returns same reference when task is missing', () => {
    expect(applyOptimisticMove(tasks, 'missing', null)).toBe(tasks)
  })
})
