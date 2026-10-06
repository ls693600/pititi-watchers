import { describe, expect, it } from 'vitest'
import {
  addEpisode,
  averageRating,
  canDelete,
  canEditRating,
  canSeeRating,
  airLabel,
  tapEpisode,
  pendingReveals,
  episodeOutlook,
  outlookOrder,
  activeIn,
  currentlyWatching,
  reconcileMonths,
  capToAired,
  timesWatchedFor,
  withSeason,
  familyBadges,
  monthStreak,
  newlyEarned,
  tasteMatches,
  pickTonight,
  rankUpNext,
  toggleWant,
  ratingSpread,
  verdict,
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
import { resolveTheme } from './theme'
import { plainText } from './tvmaze'
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

describe('blind rating', () => {
  const half = watch({ watchedBy: ['L', 'A'], ratings: { L: 4 } })
  const full = watch({ watchedBy: ['L', 'A'], ratings: { L: 4, A: 5 } })
  it('shows only your own stars until everyone has rated', () => {
    expect(canSeeRating(half, 'L', 'L')).toBe(true)
    expect(canSeeRating(half, 'A', 'L')).toBe(false)
    expect(canSeeRating(half, 'L', 'A')).toBe(false)
    expect(canSeeRating(full, 'A', 'L')).toBe(true)
    expect(canSeeRating(half, 'L', 'M')).toBe(false)
  })
  it('shows everything in single-phone mode', () => {
    expect(canSeeRating(half, 'A', null)).toBe(true)
  })
  it('lets you rate for yourself and for people without an account', () => {
    expect(canEditRating({ id: 'L', userId: 'u1' }, 'L')).toBe(true)
    expect(canEditRating({ id: 'A', userId: 'u2' }, 'L')).toBe(false)
    expect(canEditRating({ id: 'M', userId: null }, 'L')).toBe(true)
    expect(canEditRating({ id: 'A', userId: 'u2' }, null)).toBe(true)
  })
})

describe('reveal', () => {
  it('measures spread and names the verdict', () => {
    expect(ratingSpread(watch({ ratings: { L: 4, A: 4 } }))).toBe(0)
    expect(ratingSpread(watch({ watchedBy: ['L', 'A', 'M'], ratings: { L: 5, A: 2, M: 4 } }))).toBe(3)
    expect(ratingSpread(watch({ ratings: {} }))).toBe(0)
    expect([0, 1, 2, 3, 4].map(verdict)).toEqual(['Perfect match', 'Almost a perfect match', 'Mixed feelings', 'Big debate', 'Big debate'])
  })
  it('queues only complete group logs the viewer watched and has not seen', () => {
    const a = watch({ id: 'a', ratings: { L: 4, A: 5 } })
    const b = watch({ id: 'b', ratings: { L: 4 } })
    const solo = watch({ id: 'c', watchedBy: ['L'], ratings: { L: 3 } })
    const notMine = watch({ id: 'd', watchedBy: ['A', 'M'], ratings: { A: 3, M: 3 } })
    const seen = watch({ id: 'e', ratings: { L: 2, A: 2 } })
    expect(pendingReveals([a, b, solo, notMine, seen], 'L', new Set(['e'])).map((w) => w.id)).toEqual(['a'])
    expect(pendingReveals([a], null, new Set())).toEqual([])
  })
})

describe('evening theme', () => {
  it('goes dark from 7 PM to 7 AM in auto', () => {
    expect(resolveTheme('auto', new Date(2026, 9, 5, 18, 59))).toBe('light')
    expect(resolveTheme('auto', new Date(2026, 9, 5, 19, 0))).toBe('dark')
    expect(resolveTheme('auto', new Date(2026, 9, 6, 6, 59))).toBe('dark')
    expect(resolveTheme('auto', new Date(2026, 9, 6, 7, 0))).toBe('light')
  })
  it('respects a fixed choice', () => {
    expect(resolveTheme('light', new Date(2026, 9, 5, 23, 0))).toBe('light')
    expect(resolveTheme('dark', new Date(2026, 9, 5, 12, 0))).toBe('dark')
  })
})

describe('up next', () => {
  const item = (id: string, wantedBy: string[], createdAt = '2026-10-01') => ({ id, wantedBy, createdAt })
  it('ranks by hearts, newest first on ties', () => {
    const list = [item('a', ['L']), item('b', ['L', 'A', 'M']), item('c', ['A'], '2026-10-03')]
    expect(rankUpNext(list).map((i) => i.id)).toEqual(['b', 'c', 'a'])
  })
  it('draws tonight\'s pick weighted by hearts', () => {
    const list = [item('a', []), item('b', ['L', 'A', 'M'])] // tickets: a=1, b=4
    expect(pickTonight(list, 0)?.id).toBe('a')
    expect(pickTonight(list, 0.19)?.id).toBe('a')
    expect(pickTonight(list, 0.21)?.id).toBe('b')
    expect(pickTonight(list, 0.999)?.id).toBe('b')
  })
  it('picks again without repeating, and handles tiny lists', () => {
    const list = [item('a', ['L']), item('b', ['L'])]
    expect(pickTonight(list, 0.1, 'a')?.id).toBe('b')
    expect(pickTonight([item('a', [])], 0.5, 'a')?.id).toBe('a')
    expect(pickTonight([], 0.5)).toBeNull()
  })
  it('toggles a heart on and off', () => {
    const on = toggleWant(item('a', ['L']), 'A')
    expect(on.wantedBy).toEqual(['L', 'A'])
    expect(toggleWant(on, 'L').wantedBy).toEqual(['A'])
  })
})

describe('show page', () => {
  it('marks everything up to the tapped episode', () => {
    const w = tapEpisode(watch({ episodesWatched: 2, totalEpisodes: 10, status: 'watching' }), 6)
    expect([w.episodesWatched, w.status]).toEqual([6, 'watching'])
  })
  it('finishes the season on the last episode, and un-watches on a repeat tap', () => {
    const done = tapEpisode(watch({ episodesWatched: 9, totalEpisodes: 10, status: 'watching' }), 10)
    expect([done.episodesWatched, done.status]).toEqual([10, 'done'])
    const back = tapEpisode(done, 10)
    expect([back.episodesWatched, back.status]).toEqual([9, 'watching'])
    expect(tapEpisode(watch({ episodesWatched: 1, totalEpisodes: 10 }), 1).episodesWatched).toBe(0)
  })
  it('labels air dates', () => {
    const now = new Date(2026, 9, 5)
    expect(airLabel('2026-10-05', now)).toBe('Today')
    expect(airLabel('2026-10-06', now)).toBe('Tomorrow')
    expect(airLabel('2026-10-09', now)).toBe('Fri, Oct 9')
  })
  it('turns TVmaze HTML into plain text', () => {
    expect(plainText('<p><b>Mark</b> leads a team &amp; more</p>')).toBe('Mark leads a team & more')
    expect(plainText(null)).toBeNull()
    expect(plainText('<p></p>')).toBeNull()
  })
})

describe('taste match', () => {
  it('scores how close two people rate, on shows both rated', () => {
    const list = [
      watch({ ratings: { L: 5, A: 5 } }),
      watch({ ratings: { L: 4, A: 5 } }),
      watch({ ratings: { L: 5, A: 1 }, showName: 'The Office' }),
      watch({ ratings: { L: 3 } }),
    ]
    const [m] = tasteMatches(list, ['L', 'A'])
    // closeness: 1, 0.75, 0 -> 58%
    expect(m.score).toBe(58)
    expect(m.shared).toBe(3)
    expect(m.agreed).toBe(2)
    expect(m.clash?.watch.showName).toBe('The Office')
    expect(m.clash?.diff).toBe(4)
  })
  it('leaves out pairs who never rated together and orders by shared shows', () => {
    const list = [
      watch({ watchedBy: ['L', 'A'], ratings: { L: 4, A: 4 } }),
      watch({ watchedBy: ['L', 'A'], ratings: { L: 3, A: 3 } }),
      watch({ watchedBy: ['A', 'M'], ratings: { A: 2, M: 2 } }),
    ]
    const pairs = tasteMatches(list, ['L', 'A', 'M']).map((m) => `${m.a}${m.b}:${m.score}:${m.clash ? 'x' : '-'}`)
    expect(pairs).toEqual(['LA:100:-', 'AM:100:-'])
  })
})

describe('badges', () => {
  it('counts the longest run of consecutive months', () => {
    const m = (month: string) => watch({ month })
    expect(monthStreak([m('2026-08'), m('2026-09'), m('2026-10'), m('2026-05')])).toBe(3)
    expect(monthStreak([m('2025-12'), m('2026-01')])).toBe(2)
    expect(monthStreak([])).toBe(0)
  })
  it('earns badges from logged data and tracks progress', () => {
    const list = [
      watch({ showId: 1, month: '2026-08', ratings: { L: 5, A: 5 }, genres: ['Drama'] }),
      watch({ showId: 2, month: '2026-09', ratings: { L: 5, A: 1 }, genres: ['Comedy'] }),
      watch({ showId: 3, month: '2026-10', watchedBy: ['L', 'A', 'M'], ratings: {}, isRewatch: true, genres: ['Drama'] }),
    ]
    const b = Object.fromEntries(familyBadges(list).map((x) => [x.id, x]))
    expect(b.streak.earned).toBe(true)
    expect(b['family-night'].earned).toBe(true)
    expect(b.debate.earned).toBe(true)
    expect(b.soulmates).toMatchObject({ progress: 1, target: 5, earned: false })
    expect(b.explorer).toMatchObject({ progress: 2, earned: false })
    expect(b.rewatch.progress).toBe(1)
    expect(b.centurion.progress).toBe(3)
  })
  it('handles an empty log', () => {
    expect(familyBadges([]).every((b) => !b.earned && b.progress === 0)).toBe(true)
  })
  it('finds badges earned since last time', () => {
    const list = familyBadges([watch({ watchedBy: ['L', 'A', 'M'] })])
    expect(newlyEarned(list, new Set()).map((b) => b.id)).toEqual(['family-night'])
    expect(newlyEarned(list, new Set(['family-night']))).toEqual([])
  })
})

describe('seasons still airing (MobLand bug)', () => {
  const mob = (over: Partial<Watch> = {}) => watch({ showName: 'MobLand', season: 2, totalEpisodes: 10, episodesWatched: 10, status: 'done', runtime: 46, ...over })
  it('caps a "finished" in-progress season at the aired episodes and keeps it watching', () => {
    const w = capToAired(mob(), 3)
    expect([w.episodesWatched, w.status]).toEqual([3, 'watching'])
    expect(summarize([w]).hours).toBe(2)
  })
  it('leaves fully aired seasons and honest counts alone', () => {
    expect(capToAired(mob(), 10).episodesWatched).toBe(10)
    expect(capToAired(mob(), null).episodesWatched).toBe(10)
    expect(capToAired(mob({ episodesWatched: 2, status: 'watching' }), 3).episodesWatched).toBe(2)
  })
  it('applies the cap when picking a season that is still airing', () => {
    const w = withSeason(mob({ season: 1 }), { number: 2, episodes: 10, aired: true, inProgress: true, airedEpisodes: 3 }, [])
    expect([w.season, w.episodesWatched, w.status]).toEqual([2, 3, 'watching'])
  })
  it('will not mark unaired episodes as watched', () => {
    const w = mob({ episodesWatched: 3, status: 'watching' })
    expect(tapEpisode(w, 7, 3)).toBe(w)
    expect(tapEpisode(w, 2, 3).episodesWatched).toBe(2)
  })
  it('counts the log being edited once when its season changes', () => {
    const all = [mob({ id: 'x', season: 2 }), mob({ id: 'y', season: 1, month: '2025-05' })]
    expect(timesWatchedFor(all, { id: 'x', showId: 1, season: 1 })).toBe(2)
    expect(timesWatchedFor(all, { id: 'x', showId: 1, season: 2 })).toBe(1)
    expect(timesWatchedFor(all, { id: 'new', showId: 1, season: 3 })).toBe(1)
  })
})

describe('episodes counted in the month they were watched', () => {
  const show = (over: Partial<Watch> = {}) =>
    watch({ episodesWatched: 0, totalEpisodes: 10, status: 'watching', month: '2026-09', runtime: 60, episodesByMonth: {}, ...over })
  it('splits a show watched across two months', () => {
    const sept = reconcileMonths(null, show({ episodesWatched: 5 }))
    const oct = reconcileMonths(sept, { ...sept, episodesWatched: 10, status: 'done', month: '2026-10' })
    expect(oct.episodesByMonth).toEqual({ '2026-09': 5, '2026-10': 5 })
    expect(summarize([oct], '2026-09')).toMatchObject({ shows: 1, episodes: 5, hours: 5 })
    expect(summarize([oct], '2026-10')).toMatchObject({ shows: 1, episodes: 5, hours: 5 })
    expect(activeIn(oct, '2026-09') && activeIn(oct, '2026-10')).toBe(true)
    expect(activeIn(oct, '2026-08')).toBe(false)
  })
  it('counts +1 episode in the current month', () => {
    const sept = reconcileMonths(null, show({ episodesWatched: 3 }))
    const next = addEpisode(sept, new Date(2026, 9, 2))
    expect(reconcileMonths(sept, next).episodesByMonth).toEqual({ '2026-09': 3, '2026-10': 1 })
  })
  it('takes removed episodes off the latest month first', () => {
    const w = show({ episodesWatched: 8, episodesByMonth: { '2026-09': 5, '2026-10': 3 }, month: '2026-10' })
    expect(reconcileMonths(w, { ...w, episodesWatched: 4 }).episodesByMonth).toEqual({ '2026-09': 4 })
  })
  it('moves a single-month log when its month changes (logging an old season)', () => {
    const w = reconcileMonths(null, show({ episodesWatched: 10, status: 'done', month: '2026-10' }))
    expect(reconcileMonths(w, { ...w, month: '2025-05' }).episodesByMonth).toEqual({ '2025-05': 10 })
  })
  it('treats older logs without a breakdown as all in their month', () => {
    const old = show({ episodesWatched: 6, month: '2026-08', episodesByMonth: undefined })
    expect(summarize([old], '2026-08').episodes).toBe(6)
    expect(reconcileMonths(old, { ...old, episodesWatched: 7, month: '2026-10' }).episodesByMonth).toEqual({ '2026-08': 6, '2026-10': 1 })
  })
  it('year stats count each month separately', () => {
    const w = show({ episodesWatched: 10, status: 'done', month: '2026-10', episodesByMonth: { '2025-12': 4, '2026-01': 6 } })
    const y = yearStats([w], 2026, new Date(2026, 9, 5))
    expect(y.episodes).toBe(6)
    expect(y.perMonth[0].count).toBe(1)
    expect(yearStats([w], 2025, new Date(2026, 9, 5)).episodes).toBe(4)
  })
  it('lists shows in progress regardless of month', () => {
    const list = [show({ id: 'a', month: '2026-07' }), show({ id: 'b', status: 'done' }), show({ id: 'c', updatedAt: '2026-10-09' })]
    expect(currentlyWatching(list).map((w) => w.id)).toEqual(['c', 'a'])
  })
})

describe('release outlook for the home banner', () => {
  const w = (season: number, watched: number, total: number | null) => ({ season, episodesWatched: watched, totalEpisodes: total })
  const ep = (season: number, number: number, airdate = '2026-10-09') => ({ season, number, airdate, name: 'Ep' })
  it('counts aired episodes you have not watched in the current season', () => {
    // MobLand: watched 1, episode 4 is next → 3 aired → 2 ready
    expect(episodeOutlook(w(2, 1, 10), ep(2, 4))).toMatchObject({ ready: 2, next: { date: '2026-10-09', number: 4 } })
    expect(episodeOutlook(w(2, 3, 10), ep(2, 4)).ready).toBe(0)
  })
  it('treats the whole season as out when the next episode is a later season or nothing is scheduled', () => {
    expect(episodeOutlook(w(1, 6, 10), ep(2, 1, '2027-01-01')).ready).toBe(4)
    expect(episodeOutlook(w(3, 7, 10), null)).toEqual({ ready: 3, next: null })
    expect(episodeOutlook(w(3, 7, null), null).ready).toBe(0)
  })
  it('orders ready-to-watch first, then the soonest air date', () => {
    const ready = { ready: 2, next: null }
    const fri = { ready: 0, next: { date: '2026-10-09', season: 1, number: 1, name: '' } }
    const sun = { ready: 0, next: { date: '2026-10-11', season: 1, number: 1, name: '' } }
    const none = { ready: 0, next: null }
    expect([none, sun, ready, fri].sort(outlookOrder)).toEqual([ready, fri, sun, none])
    expect(outlookOrder(undefined, fri)).toBeGreaterThan(0)
  })
})
