import { describe, expect, it } from 'vitest'
import { fitWithin, tonight } from './photo'

describe('couch photos', () => {
  it('shrinks the longest side to 1280, keeping the shape; small photos stay as they are', () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 1280, height: 960 })
    expect(fitWithin(3024, 4032)).toEqual({ width: 960, height: 1280 })
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 })
  })
  it('tonight: the evening date, and just after midnight still counts as the night before', () => {
    expect(tonight(new Date(2026, 9, 31, 21, 30))).toBe('2026-10-31')
    expect(tonight(new Date(2026, 10, 1, 1, 15))).toBe('2026-10-31')
    expect(tonight(new Date(2026, 10, 1, 5, 0))).toBe('2026-11-01')
    expect(tonight(new Date(2027, 0, 1, 0, 30))).toBe('2026-12-31')
  })
})
