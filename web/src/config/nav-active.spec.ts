import { describe, expect, it } from 'vitest'
import { navPathIsActive } from './nav-active'

describe('navPathIsActive', () => {
  const siblings = ['/', '/overview', '/overdue', '/inbox', '/favorites', '/brands', '/people']

  it('matches exact path', () => {
    expect(navPathIsActive('/inbox', '/inbox', siblings)).toBe(true)
  })

  it('matches nested under item', () => {
    expect(navPathIsActive('/brands/x', '/brands', siblings)).toBe(true)
  })

  it('does not match unrelated path', () => {
    expect(navPathIsActive('/overdue', '/inbox', siblings)).toBe(false)
  })

  it('lets a longer sibling win', () => {
    const tos = ['/lists', '/lists/saved']
    expect(navPathIsActive('/lists/saved', '/lists', tos)).toBe(false)
    expect(navPathIsActive('/lists/saved', '/lists/saved', tos)).toBe(true)
  })
})
