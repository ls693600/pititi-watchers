import { describe, expect, it } from 'vitest'
import {
  addEpisode,
  averageRating,
  canDelete,
  pendingRaters,
  personAverages,
  watchedByPerson,
  isPriorWatch,
  shiftMonth,
  summarize,
  timesWatched,
  watchesInMonth,
  yearStats,
} from './logic'
import type { Watch } from './types'

function watch(over: Partial<Watch> = {}): Watch {
  return {
    id: Math.random().toString(36).slice(2),
    showId: 1,
    showName: 'Severance',
    poster: null,
    network: null,
    genres: [],
    year: '2022',
    season: 1,
    episodesWatched: 9,
    totalEpisodes: 9,
    runtime: 50,
    month: '2026-10',
    status: 'done',
    watchedBy: ['L', 'A'],
    ratings: {},
    isRewatch: false,
    notes: '',
    createdBy: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...over,
  }
}

describe('averageRating', () => {
  it('averages everyone who watched', () => {
    expect(averageRating(watch({ ratings: { L: 5, A: 4 } }))).toBe(4.5)
    expect(averageRating(watch({ watchedBy: ['L', 'A', 'M'], ratings: { L: 5, A: 4, M: 3 } }))).toBe(4)
    expect(averageRating(watch({ watchedBy: ['M'], ratings: { M: 5 } }))).toBe(5)
  })
  it('stays empty until every watcher has rated', () => {
    const w = watch({ watchedBy: ['L', 'A', 'M'], ratings: { L: 5, A: 4 } })
    expect(averageRating(w)).toBeNull()
    expect(pendingRaters(w)).toEqual(['M'])
    expect(averageRating(watch())).toBeNull()
  })
  it('ignores ratings from people who did not watch', () => {
    expect(averageRating(watch({ watchedBy: ['L'], ratings: { L: 4, A: 1 } }))).toBe(4)
  })
  it('falls back to whoever rated when nobody is marked as watching', () => {
    expect(averageRating(watch({ watchedBy: [], ratings: { L: 2, A: 4 } }))).toBe(3)
    expect(averageRating(watch({ watchedBy: [], ratings: {} }))).toBeNull()
  })
})

describe('canDelete', () => {
  it('lets the admin delete anything and others only what they added', () => {
    const w = watch({ createdBy: 'A' })
    expect(canDelete(w, { personId: 'L', isAdmin: true })).toBe(true)
    expect(canDelete(w, { personId: 'A', isAdmin: false })).toBe(true)
    expect(canDelete(w, { personId: 'M', isAdmin: false })).toBe(false)
    expect(canDelete(watch({ createdBy: null }), { personId: 'A', isAdmin: false })).toBe(false)
  })
  it('allows everything in single-phone mode', () => {
    expect(canDelete(watch(), null)).toBe(true)
  })
})

describe('family filter', () => {
  it('keeps only logs a person watched, or everything for the whole family', () => {
    const all = [watch({ watchedBy: ['L', 'A'] }), watch({ watchedBy: ['M'] })]
    expect(watchedByPerson(all, 'M')).toHaveLength(1)
    expect(watchedByPerson(all, 'L')).toHaveLength(1)
    expect(watchedByPerson(all, null)).toHaveLength(2)
    expect(watchedByPerson(all, 'X')).toHaveLength(0)
  })
  it("computes each person's average rating", () => {
    const all = [watch({ ratings: { L: 5, A: 2 } }), watch({ ratings: { L: 3 } })]
    expect(personAverages(all, ['L', 'A', 'M'])).toEqual({ L: 4, A: 2, M: null })
  })
})

describe('months', () => {
  it('shifts across year boundaries', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-10', 0)).toBe('2026-10')
  })
  it('only returns logs from the selected month', () => {
    const all = [watch({ month: '2026-10' }), watch({ month: '2026-09' }), watch({ month: '2025-10' })]
    expect(watchesInMonth(all, '2026-10')).toHaveLength(1)
  })
})

describe('rewatch tracking', () => {
  it('counts every log of the same show-season', () => {
    const all = [watch(), watch({ isRewatch: true, month: '2026-11' }), watch({ season: 2 })]
    expect(timesWatched(all, 1, 1)).toBe(2)
    expect(timesWatched(all, 1, 2)).toBe(1)
    expect(timesWatched(all, 99, 1)).toBe(0)
  })
  it('detects a prior watch but ignores the log being edited', () => {
    const first = watch()
    expect(isPriorWatch([first], 1, 1)).toBe(true)
    expect(isPriorWatch([first], 1, 1, first.id)).toBe(false)
    expect(isPriorWatch([first], 1, 2)).toBe(false)
  })
})

describe('addEpisode', () => {
  const now = new Date(2026, 10, 3)
  it('moves the log to the current month', () => {
    const w = addEpisode(watch({ episodesWatched: 2, status: 'watching', month: '2026-10' }), now)
    expect(w.episodesWatched).toBe(3)
    expect(w.month).toBe('2026-11')
    expect(w.status).toBe('watching')
  })
  it('finishes the season on the last episode and never overshoots', () => {
    const w = addEpisode(watch({ episodesWatched: 8, status: 'watching' }), now)
    expect(w.status).toBe('done')
    expect(addEpisode(w, now).episodesWatched).toBe(9)
  })
  it('keeps counting when the episode total is unknown', () => {
    const w = addEpisode(watch({ episodesWatched: 4, totalEpisodes: null, status: 'watching' }), now)
    expect(w.episodesWatched).toBe(5)
    expect(w.status).toBe('watching')
  })
})

describe('stats', () => {
  it('summarizes shows, episodes, hours and rewatches', () => {
    const s = summarize([watch(), watch({ showId: 2, isRewatch: true, episodesWatched: 3, runtime: 20 })])
    expect(s).toEqual({ shows: 2, episodes: 12, hours: 9, rewatches: 1 })
  })
  it('counts a show once even with two seasons or a rewatch in the same period', () => {
    const s = summarize([watch({ season: 1 }), watch({ season: 2 }), watch({ season: 2, isRewatch: true })])
    expect(s.shows).toBe(1)
    expect(s.episodes).toBe(27)
  })
  it('treats a missing runtime as zero hours', () => {
    expect(summarize([watch({ runtime: null })]).hours).toBe(0)
  })
  it('builds the year recap', () => {
    const now = new Date(2026, 9, 5)
    const all = [
      watch({ showId: 1, showName: 'A', ratings: { L: 5, A: 4 }, month: '2026-03' }),
      watch({ showId: 2, showName: 'B', ratings: { L: 5, A: 2 }, month: '2026-03' }),
      watch({ showId: 2, showName: 'B', season: 2, month: '2026-03' }),
      watch({ showId: 3, showName: 'C', ratings: { L: 3 }, month: '2026-10' }),
      watch({ showId: 4, showName: 'Old', ratings: { L: 5, A: 5 }, month: '2025-03' }),
    ]
    const y = yearStats(all, 2026, now)
    expect(y.shows).toBe(3)
    expect(y.perMonth[2].count).toBe(2)
    expect(y.perMonth[9].count).toBe(1)
    expect(y.avgPerMonth).toBeCloseTo(3 / 10)
    expect(y.busiest?.month).toBe('2026-03')
    expect(y.topRated.map((t) => t.watch.showName)).toEqual(['A', 'B'])
    expect(y.disagreements.map((d) => [d.watch.showName, d.diff])).toEqual([['B', 3]])
  })
  it('measures disagreement as the gap between the highest and lowest rating', () => {
    const w = watch({ watchedBy: ['L', 'A', 'M'], ratings: { L: 5, A: 4, M: 2 } })
    expect(yearStats([w], 2026, new Date(2026, 9, 5)).disagreements.map((d) => d.diff)).toEqual([3])
  })
  it('averages a past year over all 12 months', () => {
    const y = yearStats([watch({ month: '2025-06' }), watch({ showId: 2, month: '2025-07' })], 2025, new Date(2026, 9, 5))
    expect(y.shows).toBe(2)
    expect(y.avgPerMonth).toBeCloseTo(2 / 12)
  })
  it('handles an empty year', () => {
    const y = yearStats([], 2026, new Date(2026, 9, 5))
    expect(y.shows).toBe(0)
    expect(y.avgPerMonth).toBe(0)
    expect(y.busiest).toBeNull()
    expect(y.topRated).toEqual([])
  })
})
