import { describe, expect, it } from 'vitest'
import { normalizeSearchText, searchIndex, type SearchDocument } from './search-index'

const DOCS: SearchDocument[] = [
  { id: '1', kind: 'task', title: 'Отклонение партии WNDR', to: '/tasks/1' },
  { id: '2', kind: 'task', title: 'Ёлка в офисе', to: '/tasks/2' },
  { id: '3', kind: 'list', title: 'Входящие', to: '/lists/3' },
  { id: '4', kind: 'space', title: 'Личное', to: '/spaces/4' },
  { id: '5', kind: 'user', title: 'Иван Петров', subtitle: 'ivan@almea.ru', to: '/users/5' },
  { id: '6', kind: 'brand', title: 'WNDR Beauty', to: '/brands/6' },
  { id: '7', kind: 'task', title: 'Другая задача WNDR', to: '/tasks/7' },
  { id: '8', kind: 'task', title: 'Ещё WNDR один', to: '/tasks/8' },
  { id: '9', kind: 'task', title: 'WNDR четыре', to: '/tasks/9' },
  { id: '10', kind: 'task', title: 'WNDR пять', to: '/tasks/10' },
  { id: '11', kind: 'task', title: 'WNDR шесть', to: '/tasks/11' },
]

describe('normalizeSearchText', () => {
  it('lowercases and maps ё→е', () => {
    expect(normalizeSearchText('Ёлка')).toBe('елка')
  })
})

describe('searchIndex', () => {
  it('returns empty for short queries', () => {
    expect(searchIndex(DOCS, 'w')).toEqual([])
  })

  it('prefers word-start / prefix matches', () => {
    const hits = searchIndex(DOCS, 'откл')
    expect(hits[0]?.id).toBe('1')
  })

  it('matches ё/е', () => {
    const hits = searchIndex(DOCS, 'елка')
    expect(hits.some((h) => h.id === '2')).toBe(true)
  })

  it('caps per kind and total', () => {
    const hits = searchIndex(DOCS, 'wndr')
    const tasks = hits.filter((h) => h.kind === 'task')
    expect(tasks.length).toBeLessThanOrEqual(5)
    expect(hits.length).toBeLessThanOrEqual(12)
  })

  it('matches subtitle', () => {
    const hits = searchIndex(DOCS, 'ivan@')
    expect(hits.some((h) => h.id === '5')).toBe(true)
  })
})
