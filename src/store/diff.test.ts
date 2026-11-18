import { describe, expect, it } from 'vitest'
import { changedColumns, isLogGone, LogGone, ratingChanges } from './diff'

describe('saving only what changed', () => {
  it('sends the columns this change touched, nothing else', () => {
    const before = { episodes_watched: 4, notes: 'old', watched_by: ['a', 'b'], episodes_by_month: { '2026-11': 4 } }
    const next = { episodes_watched: 5, notes: 'old', watched_by: ['a', 'b'], episodes_by_month: { '2026-11': 5 } }
    expect(changedColumns(before, next)).toEqual({ episodes_watched: 5, episodes_by_month: { '2026-11': 5 } })
    expect(changedColumns(before, { ...before })).toEqual({})
  })

  it("a phone with an old copy never deletes or overwrites someone else's rating", () => {
    // Leandro's phone loaded the log before Ana rated it; he marks an episode
    expect(ratingChanges({ leandro: 8 }, { leandro: 8 })).toEqual({ put: [], clear: [] })
    // He rates: only his own rating is written
    expect(ratingChanges({ leandro: 8 }, { leandro: 9 })).toEqual({ put: [['leandro', 9]], clear: [] })
  })

  it('clears only the ratings this change removed', () => {
    expect(ratingChanges({ leandro: 8, ana: 7 }, { ana: 7 })).toEqual({ put: [], clear: ['leandro'] })
    // A new log (no earlier copy): writes its ratings, never clears anything
    expect(ratingChanges(null, { ana: 7 })).toEqual({ put: [['ana', 7]], clear: [] })
  })

  it('recognizes "the log was removed meanwhile"', () => {
    expect(isLogGone(new LogGone())).toBe(true)
    expect(isLogGone({ message: 'log_gone' })).toBe(true)
    expect(isLogGone(new Error('other'))).toBe(false)
  })
})
