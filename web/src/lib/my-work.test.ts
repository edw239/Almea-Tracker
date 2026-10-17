import { describe, expect, it } from 'vitest'
import type { Task } from '../types'
import { bucketMyWorkTasks, isMyWorkTask } from './my-work'

function task(partial: Partial<Task> & Pick<Task, 'id'>): Task {
  return {
    listId: 'l1',
    parentTaskId: null,
    title: 't',
    description: '',
    status: 'OPEN',
    listStatusId: null,
    priority: 'MEDIUM',
    position: 1,
    ownerUserId: 'u1',
    createdByUserId: null,
    assigneeIds: [],
    watcherIds: [],
    dueDate: null,
    startDate: null,
    completedAt: null,
    checklist: [],
    domainLabel: null,
    domainEntityId: null,
    domainEntityType: null,
    hostEntityId: null,
    reviewRequired: false,
    submittedAt: null,
    ...partial,
  }
}

describe('isMyWorkTask', () => {
  it('matches owner, assignee, or watcher', () => {
    expect(isMyWorkTask(task({ id: '1', ownerUserId: 'me', assigneeIds: [] }), 'me')).toBe(true)
    expect(isMyWorkTask(task({ id: '2', ownerUserId: 'other', assigneeIds: ['me'] }), 'me')).toBe(true)
    expect(isMyWorkTask(task({ id: '3', ownerUserId: 'other', watcherIds: ['me'] }), 'me')).toBe(true)
    expect(isMyWorkTask(task({ id: '4', ownerUserId: 'other', assigneeIds: [] }), 'me')).toBe(false)
  })
})

describe('bucketMyWorkTasks', () => {
  it('splits by due', () => {
    const now = new Date(2026, 7, 18)
    const buckets = bucketMyWorkTasks(
      [
        task({ id: 'o', dueDate: '2026-08-10' }),
        task({ id: 't', dueDate: '2026-08-18' }),
        task({ id: 'l', dueDate: '2026-08-25' }),
        task({ id: 'n' }),
        task({ id: 'done', dueDate: '2026-08-10', status: 'DONE' }),
      ],
      now,
    )
    expect(buckets.overdue.map((t) => t.id)).toEqual(['o'])
    expect(buckets.today.map((t) => t.id)).toEqual(['t'])
    expect(buckets.later.map((t) => t.id)).toEqual(['l'])
    expect(buckets.none.map((t) => t.id)).toEqual(['n'])
  })
})
