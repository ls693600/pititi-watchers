import { describe, expect, it } from 'vitest'
import { activeNight, buildPool, nightState, NIGHT_SIZE, titleRef } from './movieNight'
import type { ListItem, MovieNight, NightTitle, NightVote, Watch, WatchList } from './types'

const t = (kind: 'movie' | 'tv', extId: number, runtime: number | null = 110): NightTitle => ({ kind, extId, title: `T${extId}`, poster: null, year: '2024', genres: [], runtime, network: null })
const list = (id: string, householdId: string): WatchList => ({ id, householdId, name: 'Up Next', emoji: '📌', visibility: 'household', sharedWith: [], askVotes: false, isDefault: true, createdBy: null, createdAt: '' })
const item = (listId: string, x: NightTitle): ListItem => ({ ...x, id: `i${x.extId}`, listId, addedBy: null, votes: [], createdAt: '' })
const watched = (showId: number, kind: 'movie' | 'tv', householdId = 'h1') => ({ id: `w${showId}`, kind, showId, householdId }) as unknown as Watch

describe('movie night pool', () => {
  const base = { lists: [list('l1', 'h1'), list('l2', 'h2')], household: 'h1', forus: [t('movie', 3), t('tv', 4)], week: [t('movie', 5, 90), t('movie', 1)], watches: [] as Watch[] }
  const all = { kind: 'both' as const, short: false, sources: { list: true, forus: true, week: true } }
  it('our lists, then For us, then Trending; no duplicates, nothing we watched, never another household\'s list', () => {
    const pool = buildPool({ ...base, items: [item('l1', t('movie', 1)), item('l2', t('movie', 9))], watches: [watched(3, 'movie'), watched(5, 'movie', 'h2')] }, all, () => 0.5)
    expect(pool.map(titleRef).sort()).toEqual(['movie:1', 'movie:5', 'tv:4'])
    expect(pool.find((p) => p.extId === 1)?.from).toBe('list')
  })
  it('kind and length filters', () => {
    expect(buildPool({ ...base, items: [] }, { ...all, kind: 'tv' }).map(titleRef)).toEqual(['tv:4'])
    expect(buildPool({ ...base, items: [] }, { ...all, short: true }).map(titleRef)).toEqual(['movie:5'])
  })
  it(`at most ${NIGHT_SIZE} posters, shuffled`, () => {
    const many = Array.from({ length: 30 }, (_, i) => t('movie', 100 + i))
    const pool = buildPool({ ...base, forus: many, week: [], items: [] }, all, () => 0)
    expect(pool).toHaveLength(NIGHT_SIZE)
    expect(pool.map((p) => p.extId)).not.toEqual(many.slice(0, NIGHT_SIZE).map((p) => p.extId))
  })
})

describe('movie night state', () => {
  const night: MovieNight = { id: 'n', householdId: 'h1', createdBy: 'l', titles: [t('movie', 1), t('movie', 2), t('tv', 3)], createdAt: '2026-11-14T20:00:00Z' }
  const v = (personId: string, extId: number, yes: boolean, kind = 'movie'): NightVote => ({ nightId: 'n', personId, ref: `${kind}:${extId}`, yes, createdAt: '' })
  it('a match needs everyone\'s yes; you see what\'s left and who you wait for', () => {
    const s = nightState(night, [v('l', 1, true), v('a', 1, true), v('l', 2, true), v('a', 2, false), v('l', 3, false, 'tv')], 'l', ['l', 'a'])
    expect(s.todo).toHaveLength(0)
    expect(s.matches.map(titleRef)).toEqual(['movie:1'])
    expect(s.waitingOn).toEqual(['a'])
    expect(s.finished).toBe(false)
  })
  it('alone in the household there are no matches', () => {
    expect(nightState(night, [v('l', 1, true)], 'l', ['l']).matches).toEqual([])
  })
  it('the active night is the latest one from the last 6 hours, of your household', () => {
    const now = Date.parse('2026-11-14T23:00:00Z')
    expect(activeNight([night], 'h1', now)?.id).toBe('n')
    expect(activeNight([night], 'h2', now)).toBeNull()
    expect(activeNight([night], 'h1', Date.parse('2026-11-15T03:00:00Z'))).toBeNull()
  })
})
