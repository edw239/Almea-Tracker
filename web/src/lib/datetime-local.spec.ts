import { describe, expect, it } from 'vitest'
import { buildDateValue, formatDateDisplay, parseDateValue } from './datetime-local'

describe('datetime-local date helpers', () => {
  it('parses and builds yyyy-MM-dd', () => {
    const d = parseDateValue('2026-08-17')
    expect(d).not.toBeNull()
    expect(buildDateValue(d!)).toBe('2026-08-17')
  })

  it('returns null for empty / invalid', () => {
    expect(parseDateValue('')).toBeNull()
    expect(parseDateValue('nope')).toBeNull()
  })

  it('formats for display in ru', () => {
    const label = formatDateDisplay('2026-08-17')
    expect(label.toLowerCase()).toContain('2026')
  })
})
