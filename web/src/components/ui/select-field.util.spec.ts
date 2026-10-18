import { describe, expect, it } from 'vitest'
import {
  fromSelectChange,
  fromSelectValue,
  SELECT_EMPTY_VALUE,
  toSelectValue,
} from './select-field.util'

describe('select-field value mapping', () => {
  it('maps empty string to a non-empty Radix value and back', () => {
    expect(toSelectValue('')).toBe(SELECT_EMPTY_VALUE)
    expect(fromSelectValue(SELECT_EMPTY_VALUE)).toBe('')
  })

  it('leaves real option values unchanged', () => {
    expect(toSelectValue('week')).toBe('week')
    expect(fromSelectValue('week')).toBe('week')
  })
})

describe('fromSelectChange', () => {
  it('passes user picks through, including the explicit empty option', () => {
    expect(fromSelectChange('RESPONSIBLE')).toBe('RESPONSIBLE')
    expect(fromSelectChange(SELECT_EMPTY_VALUE)).toBe('')
  })

  it('drops the empty echo of the hidden form select', () => {
    expect(fromSelectChange('')).toBeNull()
  })
})
