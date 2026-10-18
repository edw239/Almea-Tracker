import { describe, expect, it } from 'vitest'
import { readMigratedStorageItem } from './web-storage'

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(initial))
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => {
      map.delete(key)
    },
    setItem: (key: string, value: string) => {
      map.set(key, value)
    },
  }
}

describe('readMigratedStorageItem', () => {
  it('returns the current key when present', () => {
    const storage = memoryStorage({ 'almea-theme': 'dark', 'almea-theme-old': 'light' })
    expect(readMigratedStorageItem(storage, 'almea-theme', 'almea-theme-old')).toBe('dark')
    expect(storage.getItem('almea-theme-old')).toBe('light')
  })

  it('copies and removes the legacy key when the current key is empty', () => {
    const storage = memoryStorage({ 'almea-theme-old': 'dark' })
    expect(readMigratedStorageItem(storage, 'almea-theme', 'almea-theme-old')).toBe('dark')
    expect(storage.getItem('almea-theme')).toBe('dark')
    expect(storage.getItem('almea-theme-old')).toBeNull()
  })

  it('returns null when neither key exists', () => {
    const storage = memoryStorage()
    expect(readMigratedStorageItem(storage, 'almea-theme', 'almea-theme-old')).toBeNull()
  })
})
