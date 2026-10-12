import { describe, expect, it } from 'vitest'
import { ignorable } from './errors'

describe('problem reports', () => {
  it('skips noise nobody can act on', () => {
    expect(ignorable('ResizeObserver loop completed with undelivered notifications.')).toBe(true)
    expect(ignorable('TypeError: Failed to fetch')).toBe(true)
    expect(ignorable('Load failed')).toBe(true)
    expect(ignorable('Script error.')).toBe(true)
  })
  it('keeps real problems', () => {
    expect(ignorable("Cannot read properties of undefined (reading 'showName')")).toBe(false)
    expect(ignorable('Maximum update depth exceeded')).toBe(false)
  })
})
