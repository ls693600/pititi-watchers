import { describe, expect, it } from 'vitest'
import {
  addEpisode,
  coupleAverage,
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
    ratings: { p1: null, p2: null },
    isRewatch: false,
    notes: '',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...over,
  }
}

describe('coupleAverage', () => {
  it('averages both ratings', () => {
    expect(coupleAverage(watch({ ratings: { p1: 5, p2: 4 } }))).toBe(4.5)
    expect(coupleAverage(watch({ ratings: { p1: 1, p2: 1 } }))).toBe(1)
  })
  it('stays empty until both have rated', () => {
    expect(coupleAverage(watch({ ratings: { p1: 5, p2: null } }))).toBeNull()
    expect(coupleAverage(watch({ ratings: { p1: null, p2: 3 } }))).toBeNull()
    expect(coupleAverage(watch())).toBeNull()
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
      watch({ showId: 1, showName: 'A', ratings: { p1: 5, p2: 4 }, month: '2026-03' }),
      watch({ showId: 2, showName: 'B', ratings: { p1: 5, p2: 2 }, month: '2026-03' }),
      watch({ showId: 2, showName: 'B', season: 2, month: '2026-03' }),
      watch({ showId: 3, showName: 'C', ratings: { p1: 3, p2: null }, month: '2026-10' }),
      watch({ showId: 4, showName: 'Old', ratings: { p1: 5, p2: 5 }, month: '2025-03' }),
    ]
    const y = yearStats(all, 2026, now)
    expect(y.shows).toBe(3)
    expect(y.perMonth[2].count).toBe(2)
    expect(y.perMonth[9].count).toBe(1)
    expect(y.avgPerMonth).toBeCloseTo(3 / 10)
    expect(y.busiest?.month).toBe('2026-03')
    expect(y.topRated.map((t) => t.watch.showName)).toEqual(['A', 'B'])
    expect(y.disagreements.map((d) => [d.watch.showName, d.diff])).toEqual([['B', 3]])
    expect(y.personAverages.p1).toBeCloseTo(13 / 3)
    expect(y.personAverages.p2).toBe(3)
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
    expect(y.personAverages).toEqual({ p1: null, p2: null })
  })
})
