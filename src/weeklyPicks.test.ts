import { describe, expect, it } from 'vitest'
import { cleanPicks, weekOf } from './weeklyPicks'

describe('picks of the week', () => {
  it('a week starts on Monday', () => {
    expect(weekOf(new Date('2026-10-26T09:00:00'))).toBe('2026-10-26')
    expect(weekOf(new Date('2026-11-01T23:00:00'))).toBe('2026-10-26')
    expect(weekOf(new Date('2026-11-02T00:30:00'))).toBe('2026-11-02')
    expect(weekOf(new Date('2027-01-01T12:00:00'))).toBe('2026-12-28')
  })
  it('drops malformed or repeated picks and fills safe defaults', () => {
    const ok = { kind: 'movie', extId: 1, title: 'A', poster: 'p.jpg', score: 7.5 }
    const picks = cleanPicks([ok, { ...ok }, { ...ok, extId: 2, poster: null }, { kind: 'game', extId: 3 }, null, { ...ok, kind: 'tv', extId: 1, titlePt: 'B' }])
    expect(picks.map((p) => `${p.kind}${p.extId}`)).toEqual(['movie1', 'tv1'])
    expect(picks[0]).toMatchObject({ titlePt: 'A', genres: [], year: null, runtime: null, network: null })
    expect(picks[1].titlePt).toBe('B')
    expect(cleanPicks({ error: 'x' })).toEqual([])
  })
})
