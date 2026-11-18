import { describe, expect, it } from 'vitest'
import { localDay, tonight, watchMonth } from './dates'
import { currentMonth, monthStreak, shiftMonth } from '../logic'
import type { Watch } from '../types'

describe('dates as the family lives them', () => {
  it("evening is still today (UTC would already say tomorrow in the Americas)", () => {
    expect(localDay(new Date(2026, 10, 18, 21, 30))).toBe('2026-11-18')
    expect(localDay(new Date(2026, 10, 18, 23, 59))).toBe('2026-11-18')
    expect(localDay(new Date(2026, 11, 31, 12), 1)).toBe('2027-01-01')
    expect(localDay(new Date(2026, 10, 18, 12), 30)).toBe('2026-12-18')
  })

  it("New Year's Eve after midnight still counts in December", () => {
    expect(tonight(new Date(2027, 0, 1, 0, 30))).toBe('2026-12-31')
    expect(watchMonth(new Date(2027, 0, 1, 0, 30))).toBe('2026-12')
    expect(currentMonth(new Date(2027, 0, 1, 0, 30))).toBe('2026-12')
    expect(currentMonth(new Date(2027, 0, 1, 9, 0))).toBe('2027-01')
  })

  it('month arithmetic is not affected by the 5 AM rule', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2027-01', -1)).toBe('2026-12')
    expect(shiftMonth('2026-03', -14)).toBe('2025-01')
  })

  it('a show watched across December and January keeps the streak going', () => {
    const w = { month: '2027-01', episodesWatched: 6, episodesByMonth: { '2026-11': 2, '2026-12': 2, '2027-01': 2 } } as unknown as Watch
    expect(monthStreak([w])).toBe(3)
  })
})

describe('guard', () => {
  it('no screen computes "today" in UTC', () => {
    const sources = import.meta.glob(['../**/*.{ts,tsx}', '!../**/*.test.*'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>
    expect(Object.keys(sources).length).toBeGreaterThan(50)
    // new Date().toISOString().slice(0, 10) is already tomorrow every evening in the Americas: use localDay()
    const bad = Object.entries(sources).filter(([, src]) => /new Date\([^)]*\)\.toISOString\(\)\.slice\(0, (7|10)\)/.test(src)).map(([f]) => f)
    expect(bad).toEqual([])
  })
})
