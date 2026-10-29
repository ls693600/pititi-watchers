import { describe, expect, it } from 'vitest'
import { cleanForUs, lovedTitles, unwatched } from './forUs'
import type { Watch } from './types'

const log = (extra: Partial<Watch>): Watch => ({
  id: 'w', kind: 'tv', householdId: 'h1', showId: 1, showName: 'Show', poster: null, network: null, genres: [], year: '2022',
  season: 1, episodesWatched: 8, totalEpisodes: 8, runtime: 30, month: '2026-01', status: 'done', watchedBy: ['l', 'a'], ratings: {},
  isRewatch: false, notes: '', createdBy: 'l', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', ...extra,
})
const pick = (extra: object) => ({ kind: 'tv', extId: 9, title: 'Pick', titlePt: 'Escolha', year: '2024', poster: 'https://x/p.jpg', genres: [], runtime: null, network: null, score: 8, because: ['tv:1'], ...extra })

describe('lovedTitles', () => {
  it('titles the household rated 8 or more, best first, once per show', () => {
    const list = [
      log({ id: 'a', showId: 1, showName: 'Severance', ratings: { l: 9, a: 10 } }),
      log({ id: 'a2', showId: 1, season: 2, showName: 'Severance', ratings: { l: 9, a: 10 } }),
      log({ id: 'b', showId: 2, showName: 'The Bear', ratings: { l: 8, a: 8 } }),
      log({ id: 'c', showId: 3, showName: 'Meh', ratings: { l: 7, a: 8 } }),
      log({ id: 'm', kind: 'movie', showId: 50, showName: 'Dune', ratings: { l: 9, a: 9 } }),
    ]
    expect(lovedTitles(list)).toEqual([
      { ref: 'tv:1', title: 'Severance' },
      { ref: 'movie:50', title: 'Dune' },
      { ref: 'tv:2', title: 'The Bear' },
    ])
  })

  it('waits until everyone who watched has rated', () => {
    expect(lovedTitles([log({ ratings: { l: 10 } })])).toEqual([])
  })

  it('at most 8 loved titles', () => {
    const list = Array.from({ length: 12 }, (_, i) => log({ id: `w${i}`, showId: i + 1, ratings: { l: 9, a: 9 } }))
    expect(lovedTitles(list)).toHaveLength(8)
  })
})

describe('cleanForUs', () => {
  it('keeps well-formed picks that say why they are there', () => {
    expect(cleanForUs([pick({}), pick({ extId: 10, because: [] }), pick({ extId: 11, because: 'tv:1' }), { nope: true }])).toHaveLength(1)
    expect(cleanForUs('oops')).toEqual([])
  })
})

describe('unwatched', () => {
  it('drops what the household already logged, by kind', () => {
    const picks = cleanForUs([pick({ extId: 1 }), pick({ extId: 2 }), pick({ kind: 'movie', extId: 1 })])
    expect(unwatched(picks, [log({ showId: 1 })]).map((p) => `${p.kind}:${p.extId}`)).toEqual(['tv:2', 'movie:1'])
  })
})
