import { describe, expect, it } from 'vitest'
import { MAX_MEMORIES, memoriesFor, monthsBefore } from './onThisDay'
import type { CouchPhoto, EpisodeReaction, Person, Watch } from './types'

const people: Person[] = [
  { id: 'L', name: 'Leandro', userId: 'u1', isAdmin: true, householdId: 'h1' },
  { id: 'A', name: 'Ana', userId: 'u2', isAdmin: false, householdId: 'h1' },
  { id: 'F', name: 'Fernando', userId: 'u3', isAdmin: false, householdId: 'h2' },
  { id: 'G', name: 'Guest', userId: 'u4', isAdmin: false, isViewer: true, householdId: null },
]

/** An ISO timestamp at a local time of day (what the phone saw), like the app stores them. */
const at = (day: string, hour = 21) => {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d, hour).toISOString()
}

let n = 0
const watch = (extra: Partial<Watch> = {}): Watch => ({
  id: `w${++n}`,
  kind: 'tv',
  householdId: 'h1',
  showId: n,
  showName: `Show ${n}`,
  poster: null,
  network: null,
  genres: [],
  year: null,
  season: 1,
  episodesWatched: 1,
  totalEpisodes: 8,
  runtime: 50,
  month: '2025-11',
  status: 'watching',
  watchedBy: ['L', 'A'],
  ratings: {},
  isRewatch: false,
  notes: '',
  createdBy: 'L',
  createdAt: at('2025-01-01'),
  updatedAt: at('2025-01-01'),
  ...extra,
})
const photo = (watchId: string, night: string, extra: Partial<CouchPhoto> = {}): CouchPhoto => ({
  id: `p-${watchId}-${night}`,
  watchId,
  personId: 'A',
  path: 'x',
  url: 'data:x',
  night,
  createdAt: at(night, 22),
  ...extra,
})
const react = (w: Watch, personId: string, day: string, extra: Partial<EpisodeReaction> = {}): EpisodeReaction => ({
  kind: 'tv',
  showId: w.showId,
  season: w.season,
  episode: 5,
  personId,
  emoji: '🤯',
  createdAt: at(day),
  ...extra,
})

const TODAY = '2026-11-18'
const run = (input: Partial<Parameters<typeof memoriesFor>[0]>) =>
  memoriesFor({ watches: [], photos: [], episodeReactions: [], people, household: 'h1', today: TODAY, ...input })

describe('monthsBefore', () => {
  it('goes back whole months and years', () => {
    expect(monthsBefore('2026-11-18', 12)).toBe('2025-11-18')
    expect(monthsBefore('2026-11-18', 6)).toBe('2026-05-18')
    expect(monthsBefore('2026-11-18', 1)).toBe('2026-10-18')
    expect(monthsBefore('2026-01-15', 1)).toBe('2025-12-15')
    expect(monthsBefore('2026-03-10', 6)).toBe('2025-09-10')
  })
  it('a day the earlier month lacks lands on its last day', () => {
    expect(monthsBefore('2026-03-31', 1)).toBe('2026-02-28')
    expect(monthsBefore('2028-03-31', 1)).toBe('2028-02-29')
    expect(monthsBefore('2028-02-29', 12)).toBe('2027-02-28')
    expect(monthsBefore('2026-08-31', 6)).toBe('2026-02-28')
    expect(monthsBefore('2026-05-31', 1)).toBe('2026-04-30')
    expect(monthsBefore('2026-12-31', 6)).toBe('2026-06-30')
  })
})

describe('memoriesFor', () => {
  it('nothing on any anchor day → null (no card)', () => {
    expect(run({ watches: [watch({ createdAt: at('2025-11-17') })] })).toBeNull()
  })

  it('no household → null', () => {
    const w = watch({ createdAt: at('2025-11-18') })
    expect(run({ watches: [w], household: null })).toBeNull()
  })

  it('a year ago first', () => {
    const year = watch({ createdAt: at('2025-11-18') })
    const month = watch({ createdAt: at('2026-10-18') })
    expect(run({ watches: [year, month] })).toEqual({ anchor: '1y', date: '2025-11-18', items: [{ kind: 'started', watch: year }] })
  })

  it('falls back to 6 months, then 1 month', () => {
    const half = watch({ createdAt: at('2026-05-18') })
    const month = watch({ createdAt: at('2026-10-18') })
    expect(run({ watches: [half, month] })?.anchor).toBe('6m')
    const r = run({ watches: [month] })
    expect(r?.anchor).toBe('1m')
    expect(r?.date).toBe('2026-10-18')
  })

  it('uses the phone calendar day, not UTC (a log at 11 PM counts that day)', () => {
    const late = watch({ createdAt: at('2025-11-18', 23) })
    const early = watch({ createdAt: at('2025-11-19', 0) })
    expect(run({ watches: [late, early] })?.items.map((m) => m.watch.id)).toEqual([late.id])
  })

  it('photos first, then finished, then started, then reactions', () => {
    const started = watch({ createdAt: at('2025-11-18') })
    const finished = watch({ status: 'done', updatedAt: at('2025-11-18'), season: 3 })
    const reacted = watch({ createdAt: at('2025-10-01') })
    const pictured = watch()
    const r = run({
      watches: [started, finished, reacted, pictured],
      photos: [photo(pictured.id, '2025-11-18')],
      episodeReactions: [react(reacted, 'A', '2025-11-18')],
    })
    expect(r?.items.map((m) => m.kind)).toEqual(['photo', 'finished', 'started', 'reaction'])
    expect(r?.items[0].photo?.watchId).toBe(pictured.id)
    expect(r?.items[3].reaction?.emoji).toBe('🤯')
  })

  it('one memory per log: the best kind wins', () => {
    // A movie logged and finished the same night, with a photo: just the photo
    const movie = watch({ kind: 'movie', status: 'done', createdAt: at('2025-11-18'), updatedAt: at('2025-11-18') })
    const r = run({ watches: [movie], photos: [photo(movie.id, '2025-11-18'), photo(movie.id, '2025-11-18', { id: 'second' })] })
    expect(r?.items).toHaveLength(1)
    expect(r?.items[0].kind).toBe('photo')
    const plain = run({ watches: [movie] })
    expect(plain?.items.map((m) => m.kind)).toEqual(['finished'])
  })

  it('a still-watching log updated that day is not "finished"', () => {
    expect(run({ watches: [watch({ status: 'watching', updatedAt: at('2025-11-18') })] })).toBeNull()
  })

  it('at most 5', () => {
    const many = Array.from({ length: 8 }, () => watch({ createdAt: at('2025-11-18') }))
    expect(run({ watches: many })?.items).toHaveLength(MAX_MEMORIES)
  })

  describe('only your household', () => {
    it("another household's photo, log and reactions never show", () => {
      const theirs = watch({ householdId: 'h2', status: 'done', createdAt: at('2025-11-18'), updatedAt: at('2025-11-18'), watchedBy: ['F'] })
      expect(run({ watches: [theirs], photos: [photo(theirs.id, '2025-11-18', { personId: 'F' })], episodeReactions: [react(theirs, 'F', '2025-11-18')] })).toBeNull()
    })

    it("someone else's reaction on a show we also log doesn't count", () => {
      const ours = watch()
      expect(run({ watches: [ours], episodeReactions: [react(ours, 'F', '2025-11-18'), react(ours, 'G', '2025-11-18')] })).toBeNull()
      expect(run({ watches: [ours], episodeReactions: [react(ours, 'L', '2025-11-18')] })?.items[0].kind).toBe('reaction')
    })

    it('a photo on a log that is not ours (or gone) is skipped', () => {
      expect(run({ watches: [watch()], photos: [photo('deleted-log', '2025-11-18')] })).toBeNull()
    })

    it("a reaction on a show we don't log can't open anything: skipped", () => {
      const theirs = watch({ householdId: 'h2' })
      expect(run({ watches: [theirs], episodeReactions: [react(theirs, 'A', '2025-11-18')] })).toBeNull()
    })
  })

  it('a reaction opens the log of the reacted season, else the latest one', () => {
    const s1 = watch({ showId: 900, season: 1 })
    const s2 = watch({ showId: 900, season: 2 })
    expect(run({ watches: [s1, s2], episodeReactions: [react(s1, 'A', '2025-11-18', { season: 1 })] })?.items[0].watch.id).toBe(s1.id)
    expect(run({ watches: [s1, s2], episodeReactions: [react(s1, 'A', '2025-11-18', { season: 4 })] })?.items[0].watch.id).toBe(s2.id)
  })

  it('a reaction to a movie does not match a show with the same id', () => {
    const tv = watch({ showId: 777 })
    expect(run({ watches: [tv], episodeReactions: [react(tv, 'A', '2025-11-18', { kind: 'movie' })] })).toBeNull()
  })

  it('month-length edges: Mar 31 looks back to Feb 28 a month ago', () => {
    const feb = watch({ createdAt: at('2026-02-28') })
    const r = memoriesFor({ watches: [feb], photos: [], episodeReactions: [], people, household: 'h1', today: '2026-03-31' })
    expect(r).toMatchObject({ anchor: '1m', date: '2026-02-28' })
  })

  it('Feb 29 looks back to Feb 28 a year ago', () => {
    const last = watch({ createdAt: at('2027-02-28') })
    const r = memoriesFor({ watches: [last], photos: [], episodeReactions: [], people, household: 'h1', today: '2028-02-29' })
    expect(r).toMatchObject({ anchor: '1y', date: '2027-02-28' })
  })
})
