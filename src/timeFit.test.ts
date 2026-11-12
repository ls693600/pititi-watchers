import { describe, expect, it } from 'vitest'
import { durationLabel, whatFits } from './timeFit'
import type { ListItem, Watch, WatchList } from './types'

const log = (over: Partial<Watch>): Watch =>
  ({ id: 'w', kind: 'tv', householdId: 'h1', showId: 1, showName: 'Show', season: 1, episodesWatched: 3, totalEpisodes: 8, runtime: 50, status: 'watching', updatedAt: '2026-11-10', ...over }) as Watch
const list: WatchList = { id: 'l1', householdId: 'h1', name: 'Up Next', emoji: '📌', visibility: 'household', sharedWith: [], askVotes: false, isDefault: true, createdBy: null, createdAt: '' }
const movie = (extId: number, runtime: number | null, listId = 'l1'): ListItem => ({ id: `i${extId}`, listId, kind: 'movie', extId, title: `M${extId}`, poster: null, year: null, genres: [], runtime, network: null, addedBy: null, votes: [], createdAt: '' })

describe('what fits in the time you have', () => {
  const base = { lists: [list], household: 'h1', watches: [] as Watch[] }
  it('next episodes that fit, never more than the season has left', () => {
    const fits = whatFits(120, { ...base, watching: [log({}), log({ id: 'w2', showId: 2, episodesWatched: 7, updatedAt: '2026-11-11' })], items: [] })
    expect(fits.map((f) => (f.type === 'episodes' ? [f.watch.showId, f.count, f.from, f.to] : null))).toEqual([
      [2, 1, 8, 8],
      [1, 2, 4, 5],
    ])
  })
  it('an episode longer than the time you have is left out; unknown length counts as 45 min', () => {
    expect(whatFits(30, { ...base, watching: [log({})], items: [] })).toEqual([])
    const f = whatFits(60, { ...base, watching: [log({ runtime: null })], items: [] })[0]
    expect(f.type === 'episodes' && f.minutes).toBe(45)
  })
  it('movies from your lists that fit, longest first; not watched, not another household\'s list', () => {
    const items = [movie(1, 95), movie(2, 130), movie(3, 110), movie(4, null), movie(5, 90, 'other')]
    const fits = whatFits(120, { ...base, watching: [], items, watches: [{ kind: 'movie', showId: 3, householdId: 'h1' } as Watch] })
    expect(fits.map((f) => f.type === 'movie' && f.item.extId)).toEqual([1])
  })
  it('labels', () => {
    expect(durationLabel(45)).toBe('45 min')
    expect(durationLabel(100)).toBe('1h 40m')
    expect(durationLabel(120)).toBe('2h')
  })
})
