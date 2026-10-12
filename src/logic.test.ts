import { describe, expect, it } from 'vitest'
import {
  addEpisode,
  logForSeason,
  nextSeasonDraft,
  sameTitle,
  householdWatches,
  householdMembers,
  canSeeList,
  canEditList,
  rankedItems,
  familyFeed,
  movieWatch,
  threads,
  totalUnread,
  unreadIn,
  mentionsIn,
  mentionParts,
  togetherWatchers,
  scoreLabel,
  yearReview,
  rewatchPair,
  canReact,
  toggleReaction,
  reactionGroups,
  chatLocked,
  cleanComment,
  unseenComments,
  timeAgo,
  finishSeason,
  joinWatchers,
  setOwnRating,
  averageRating,
  canDelete,
  canEditRating,
  canSeeRating,
  airLabel,
  tapEpisode,
  pendingReveals,
  personalTop,
  defaultWatchersFor,
  findDuplicate,
  inProgressFor,
  mergeLogs,
  premiereMonthFix,
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
  const today = '2026-10-05'
  const w = (season: number, watched: number, total: number | null) => ({ season, episodesWatched: watched, totalEpisodes: total })
  const ep = (season: number, number: number, airdate = '2026-10-09') => ({ season, number, airdate, name: 'Ep' })
  const eps = (dates: (string | null)[]) => dates.map((airdate, i) => ({ number: i + 1, airdate }))
  it('does not call years-old episodes new (The Tunnel bug)', () => {
    // The Tunnel S1 (2013), watched 8 of 10, show ended: 2 to go, nothing new, nothing next
    const tunnel = eps(['2013-10-16', '2013-10-23', '2013-10-30', '2013-11-06', '2013-11-13', '2013-11-20', '2013-11-27', '2013-12-04', '2013-12-11', '2013-12-18'])
    expect(episodeOutlook(w(1, 8, 10), null, tunnel, today)).toEqual({ fresh: 0, toGo: 2, next: null })
  })
  it('calls recently aired unwatched episodes new', () => {
    // MobLand S2: E1-3 aired Sep 21/28 and Oct 5, E4 Fri; watched 1
    const mob = eps(['2026-09-21', '2026-09-28', '2026-10-05', '2026-10-09', '2026-10-16'])
    const o = episodeOutlook(w(2, 1, 10), ep(2, 4), mob, today)
    expect([o.fresh, o.toGo, o.next?.number]).toEqual([2, 2, 4])
    expect(episodeOutlook(w(2, 3, 10), ep(2, 4), mob, today)).toMatchObject({ fresh: 0, toGo: 0 })
  })
  it('splits a season with both old and recent unwatched episodes', () => {
    const mixed = eps(['2026-06-01', '2026-06-08', '2026-09-28', '2026-10-04', null])
    expect(episodeOutlook(w(1, 1, 5), null, mixed, today)).toMatchObject({ fresh: 2, toGo: 3 })
  })
  it('without episode dates, estimates what is left but never says new', () => {
    expect(episodeOutlook(w(2, 1, 10), ep(2, 4), null, today)).toMatchObject({ fresh: 0, toGo: 2 })
    expect(episodeOutlook(w(3, 7, 10), null, null, today)).toMatchObject({ fresh: 0, toGo: 3, next: null })
    expect(episodeOutlook(w(3, 7, null), null, null, today).toGo).toBe(0)
  })
  it('orders new first, then caught-up shows by air date, then older episodes to go', () => {
    const fresh = { fresh: 2, toGo: 2, next: null }
    const fri = { fresh: 0, toGo: 0, next: { date: '2026-10-09', season: 1, number: 1, name: '' } }
    const sun = { fresh: 0, toGo: 0, next: { date: '2026-10-11', season: 1, number: 1, name: '' } }
    const old = { fresh: 0, toGo: 2, next: null }
    const done = { fresh: 0, toGo: 0, next: null }
    expect([done, old, sun, fresh, fri].sort(outlookOrder)).toEqual([fresh, fri, sun, old, done])
  })
})

describe('family feedback fixes (Oct 11)', () => {
  it('does not count an unfinished duplicate as a second viewing', () => {
    const a = watch({ id: 'a', status: 'watching' })
    const b = watch({ id: 'b', status: 'watching' })
    expect(timesWatchedFor([a, b], a)).toBe(1)
    expect(isPriorWatch([a, b], 1, 1, 'b')).toBe(false)
    const done = watch({ id: 'c', status: 'done' })
    expect(timesWatchedFor([done, b], b)).toBe(2)
    expect(isPriorWatch([done], 1, 1, 'b')).toBe(true)
  })
  it('finds duplicates and the show already in progress', () => {
    const a = watch({ id: 'a', status: 'watching' })
    const finished = watch({ id: 'f', status: 'done', season: 2 })
    expect(findDuplicate([a, watch({ id: 'b', status: 'done' })], a)?.id).toBe('b')
    expect(findDuplicate([a], a)).toBeNull()
    expect(findDuplicate([finished, watch({ id: 'g', status: 'done', season: 2 })], finished)).toBeNull()
    expect(inProgressFor([a, finished], 1)?.id).toBe('a')
    expect(inProgressFor([finished], 1)).toBeNull()
  })
  it('merges duplicates without losing progress, people, ratings or months', () => {
    const keep = watch({ id: 'k', episodesWatched: 3, status: 'watching', watchedBy: ['L'], ratings: {}, episodesByMonth: { '2026-09': 3 }, month: '2026-09' })
    const drop = watch({ id: 'd', episodesWatched: 5, status: 'watching', watchedBy: ['A'], ratings: { A: 4 }, episodesByMonth: { '2026-10': 5 }, month: '2026-10' })
    const m = mergeLogs(keep, drop)
    expect(m).toMatchObject({ id: 'k', episodesWatched: 5, watchedBy: ['L', 'A'], ratings: { A: 4 }, month: '2026-10', status: 'watching' })
    // 5 episodes in total: the 3 from September plus 2 more in October, never 8
    expect(m.episodesByMonth).toEqual({ '2026-09': 3, '2026-10': 2 })
  })
  it('only marks the person logging as a watcher by default', () => {
    expect(defaultWatchersFor('L', [{ id: 'L' }, { id: 'A' }])).toEqual(['L'])
    expect(defaultWatchersFor(null, [{ id: 'L' }, { id: 'A' }])).toEqual(['L'])
  })
  it('will not file a season before it premiered', () => {
    expect(premiereMonthFix('2026-09', '2026-10-03')).toBe('2026-10')
    expect(premiereMonthFix('2026-10', '2026-10-03')).toBeNull()
    expect(premiereMonthFix('2026-11', '2026-10-03')).toBeNull()
    expect(premiereMonthFix('2026-09', null)).toBeNull()
  })
})

describe('personal stats', () => {
  it("ranks a person's own stars, not the family average", () => {
    const list = [
      watch({ id: 'st', showName: 'Stranger Things', watchedBy: ['L'], ratings: { L: 5 } }),
      watch({ id: 'b', showName: 'Bluey', watchedBy: ['A'], ratings: { A: 5 } }),
      watch({ id: 'o', showName: 'The Office', ratings: { L: 3, A: 5 } }),
    ]
    expect(personalTop(list, 'L').map((t) => [t.watch.showName, t.avg])).toEqual([['Stranger Things', 5], ['The Office', 3]])
    expect(personalTop(list, 'A').map((t) => t.watch.showName)).toEqual(['Bluey', 'The Office'])
    expect(personalTop(list, 'M')).toEqual([])
  })
})

describe('reactions and family chat', () => {
  const base = { watchedBy: ['a', 'b'], ratings: { a: 4, b: 2 } as Record<string, number> }
  it('reacting waits for the reveal and never targets yourself', () => {
    expect(canReact(base, 'b', 'a')).toBe(true)
    expect(canReact(base, 'a', 'a')).toBe(false)
    expect(canReact({ ...base, ratings: { a: 4 } }, 'a', 'b')).toBe(false)
    expect(canReact(base, 'b', null)).toBe(false)
  })
  it('one reaction per person per rating: same emoji removes, another replaces', () => {
    const r = { watchId: 'w', personId: 'a', targetId: 'b', emoji: '🔥' }
    let all = toggleReaction([], r)
    expect(all).toHaveLength(1)
    all = toggleReaction(all, { ...r, emoji: '😂' })
    expect(all).toEqual([{ ...r, emoji: '😂' }])
    expect(toggleReaction(all, { ...r, emoji: '😂' })).toEqual([])
  })
  it('groups reactions by emoji in a fixed order', () => {
    const all = [
      { watchId: 'w', personId: 'a', targetId: 'c', emoji: '😱' },
      { watchId: 'w', personId: 'b', targetId: 'c', emoji: '😂' },
      { watchId: 'w', personId: 'd', targetId: 'c', emoji: '😂' },
      { watchId: 'x', personId: 'a', targetId: 'c', emoji: '😂' },
    ]
    expect(reactionGroups(all, 'w', 'c')).toEqual([
      { emoji: '😂', people: ['b', 'd'] },
      { emoji: '😱', people: ['a'] },
    ])
  })
  it('chat is open while watching, and locked for unrated watchers once finished', () => {
    expect(chatLocked({ watchedBy: ['a'], ratings: {}, status: 'watching' }, 'a')).toBe(false)
    expect(chatLocked({ watchedBy: ['a'], ratings: {}, status: 'done' }, 'a')).toBe(true)
    expect(chatLocked({ watchedBy: ['a'], ratings: { a: 3 }, status: 'done' }, 'a')).toBe(false)
    expect(chatLocked({ watchedBy: ['b'], ratings: {}, status: 'done' }, 'a')).toBe(false)
  })
  it('cleans chat lines', () => {
    expect(cleanComment('   ')).toBeNull()
    expect(cleanComment('  that   finale\n!! ')).toBe('that finale !!')
    expect(cleanComment('x'.repeat(400))).toHaveLength(280)
  })
  it('only new comments from others are announced', () => {
    const c = (id: string, personId: string) => ({ id, watchId: 'w', personId, text: 'hi', createdAt: '2026-10-11T10:00:00Z' })
    const all = [c('1', 'a'), c('2', 'b'), c('3', 'b')]
    expect(unseenComments(all, null, 'a')).toEqual([])
    expect(unseenComments(all, new Set(['2']), 'a').map((x) => x.id)).toEqual(['3'])
  })
  it('time ago', () => {
    const now = new Date('2026-10-11T12:00:00Z')
    expect(timeAgo('2026-10-11T11:59:30Z', now)).toBe('now')
    expect(timeAgo('2026-10-11T11:15:00Z', now)).toBe('45m')
    expect(timeAgo('2026-10-11T07:00:00Z', now)).toBe('5h')
    expect(timeAgo('2026-10-09T12:00:00Z', now)).toBe('2d')
  })
})

describe('quick actions', () => {
  const w = { ...watch({ episodesWatched: 3, totalEpisodes: 8, status: 'watching' as const }) }
  const now = new Date('2026-10-11T12:00:00Z')
  it('finishing a complete season marks every episode and finishes it', () => {
    const f = finishSeason(w, 8, now)
    expect(f.episodesWatched).toBe(8)
    expect(f.status).toBe('done')
    expect(f.month).toBe('2026-10')
  })
  it('a season still airing is caught up, not finished', () => {
    const f = finishSeason(w, 5, now)
    expect(f.episodesWatched).toBe(5)
    expect(f.status).toBe('watching')
  })
  it('never goes backwards', () => {
    expect(finishSeason({ ...w, episodesWatched: 6 }, 5, now).episodesWatched).toBe(6)
  })
  it('joining and rating from the menu', () => {
    const j = joinWatchers({ ...w, watchedBy: ['a'] }, 'b')
    expect(j.watchedBy).toEqual(['a', 'b'])
    expect(joinWatchers(j, 'b').watchedBy).toEqual(['a', 'b'])
    expect(setOwnRating(j, 'b', 4).ratings.b).toBe(4)
    expect(setOwnRating({ ...j, ratings: { b: 4 } }, 'b', null).ratings).toEqual({})
  })
})

describe('rewatch that was really one viewing', () => {
  it('pairs a rewatch log with the earlier finished log', () => {
    const first = watch({ id: 'a', showId: 9, season: 1, status: 'done', isRewatch: false })
    const again = watch({ id: 'b', showId: 9, season: 1, status: 'done', isRewatch: true })
    expect(rewatchPair([first, again], again)?.id).toBe('a')
    expect(rewatchPair([first, again], first)).toBeNull()
    expect(rewatchPair([again], again)).toBeNull()
  })
  it('merging the pair gives one viewing, not a rewatch', () => {
    const first = watch({ id: 'a', showId: 9, season: 1, status: 'done', isRewatch: false, episodesWatched: 6, totalEpisodes: 6 })
    const again = watch({ id: 'b', showId: 9, season: 1, status: 'done', isRewatch: true, episodesWatched: 6, totalEpisodes: 6 })
    const m = mergeLogs(again, first)
    expect(m.isRewatch).toBe(false)
    expect(m.status).toBe('done')
    expect(m.episodesWatched).toBe(6)
    // Same 6 episodes logged in two months: counted once, filed where they count
    expect(Object.values(m.episodesByMonth ?? {}).reduce((a, b) => a + b, 0)).toBe(6)
    expect(m.month).toBe(Object.keys(m.episodesByMonth ?? {}).sort().pop())
  })
})

describe('watching together', () => {
  const people = [{ id: 'l' }, { id: 'a' }, { id: 'k' }]
  it('just me or everyone', () => {
    expect(togetherWatchers('l', people, false)).toEqual(['l'])
    expect(togetherWatchers('l', people, true)).toEqual(['l', 'a', 'k'])
  })
  it('labels the score by who watched', () => {
    const nameOf = (id: string) => ({ l: 'Leandro', a: 'Ana' })[id] ?? '?'
    expect(scoreLabel({ watchedBy: ['l'] }, nameOf)).toBe("Leandro's rating")
    expect(scoreLabel({ watchedBy: ['l', 'a'] }, nameOf)).toBe('Our average')
  })
})

describe('year in review', () => {
  const now = new Date('2026-10-11T12:00:00')
  const list = [
    watch({ id: '1', showId: 1, month: '2026-03', status: 'done', watchedBy: ['l', 'a'], ratings: { l: 5, a: 5 }, episodesWatched: 10, runtime: 60, genres: ['Drama', 'Comedy'], episodesByMonth: { '2026-03': 10 } }),
    watch({ id: '2', showId: 2, month: '2026-05', status: 'done', watchedBy: ['l'], ratings: { l: 4 }, episodesWatched: 30, runtime: 60, genres: ['Drama'], episodesByMonth: { '2026-05': 30 } }),
    watch({ id: '3', showId: 3, month: '2026-05', status: 'done', watchedBy: ['l', 'a'], ratings: { l: 1, a: 5 }, episodesWatched: 8, runtime: 30, genres: ['Crime'], episodesByMonth: { '2026-05': 8 } }),
    watch({ id: '4', showId: 4, month: '2025-12', status: 'done', watchedBy: ['a'], ratings: { a: 3 }, episodesWatched: 5, runtime: 60, genres: ['Drama'], episodesByMonth: { '2025-12': 5 } }),
  ]
  const r = yearReview(list, ['l', 'a', 'k'], 2026, now)
  it('totals only the year', () => {
    expect(r.shows).toBe(3)
    expect(r.episodes).toBe(48)
    expect(r.hours).toBe(44)
    expect(r.days).toBe(1)
  })
  it('top show, busiest month, genres, disagreement', () => {
    expect(r.top?.watch.id).toBe('1')
    expect(r.busiest?.month).toBe('2026-05')
    expect(r.genres[0]).toEqual({ name: 'Drama', count: 2 })
    expect(r.disagreement?.watch.id).toBe('3')
  })
  it('people ranked by hours, nobody with zero', () => {
    expect(r.people.map((p) => p.id)).toEqual(['l', 'a'])
    expect(r.people[0].hours).toBe(44)
  })
  it('together vs solo', () => {
    expect(r.together).toBe(2)
    expect(r.solo).toBe(1)
  })
})

describe('mentions', () => {
  const people = [{ id: 'l', name: 'Leandro' }, { id: 'a', name: 'Ana' }, { id: 'ab', name: 'Ana Beatriz' }]
  it('finds who is mentioned, any case, with punctuation', () => {
    expect(mentionsIn('@Ana did you see it?', people)).toEqual(['a'])
    expect(mentionsIn('hey @ana, finale!', people)).toEqual(['a'])
    expect(mentionsIn('email me at x@Ana.com', people)).toEqual([])
    expect(mentionsIn('@Anabelle', people)).toEqual([])
    expect(mentionsIn('@Leandro and @Ana Beatriz', people)).toEqual(['l', 'a', 'ab'])
  })
  it('splits text for highlighting, longest name first', () => {
    expect(mentionParts('hi @ana beatriz!', people)).toEqual([{ text: 'hi ' }, { text: '@Ana Beatriz', personId: 'ab' }, { text: '!' }])
    expect(mentionParts('no tags', people)).toEqual([{ text: 'no tags' }])
  })
})

describe('merging two finished copies', () => {
  it('keeps the later month (when you actually finished)', () => {
    const early = watch({ id: 'a', showId: 7, season: 1, status: 'done', month: '2026-09', episodesWatched: 6, totalEpisodes: 6, episodesByMonth: { '2026-09': 6 } })
    const late = watch({ id: 'b', showId: 7, season: 1, status: 'done', month: '2026-10', episodesWatched: 6, totalEpisodes: 6, isRewatch: true, episodesByMonth: { '2026-10': 6 } })
    for (const m of [mergeLogs(late, early), mergeLogs(early, late)]) {
      expect(m.month).toBe('2026-10')
      expect(m.episodesByMonth).toEqual({ '2026-10': 6 })
      expect(m.isRewatch).toBe(false)
    }
  })
})

describe('messages inbox', () => {
  const c = (id: string, watchId: string | null, personId: string, at: string) => ({ id, watchId, personId, text: id, createdAt: at })
  const all = [
    c('1', null, 'a', '2026-10-11T10:00:00Z'),
    c('2', 'bear', 'a', '2026-10-11T09:00:00Z'),
    c('3', 'sev', 'a', '2026-10-11T11:00:00Z'),
    c('4', 'sev', 'l', '2026-10-11T12:00:00Z'),
  ]
  it('family first, then shows by latest message', () => {
    expect(threads(all, {}, 'l').map((t) => t.key)).toEqual(['family', 'sev', 'bear'])
  })
  it('family thread exists even with no messages', () => {
    const t = threads([], {}, 'l')
    expect(t).toHaveLength(1)
    expect(t[0]).toMatchObject({ key: 'family', count: 0, unread: 0, last: null })
  })
  it('unread counts only others, after last read', () => {
    expect(unreadIn(all, 'sev', {}, 'l')).toBe(1)
    expect(unreadIn(all, 'sev', { sev: '2026-10-11T11:30:00Z' }, 'l')).toBe(0)
    expect(totalUnread(all, { family: '2026-10-11T10:00:00Z' }, 'l')).toBe(2)
  })
})

describe('movies and tv', () => {
  it('a movie and a show with the same id are different titles', () => {
    expect(sameTitle({ showId: 5, kind: 'tv' }, { showId: 5 })).toBe(true)
    expect(sameTitle({ showId: 5, kind: 'movie' }, { showId: 5 })).toBe(false)
    expect(inProgressFor([watch({ showId: 5, status: 'watching', kind: 'movie' })], 5, 'tv')).toBeNull()
  })
  it('a movie watch is one full sitting', () => {
    const m = movieWatch(watch({ status: 'done', runtime: 150, season: 3, totalEpisodes: 9 }))
    expect(m).toMatchObject({ kind: 'movie', season: 1, totalEpisodes: 1, episodesWatched: 1 })
  })
})

describe('households and lists', () => {
  const people = [
    { id: 'l', name: 'Leandro', userId: 'u', isAdmin: true, householdId: 'h1' },
    { id: 'a', name: 'Ana', userId: 'u2', isAdmin: false, householdId: 'h1' },
    { id: 'f', name: 'Fernando', userId: 'u3', isAdmin: false, householdId: 'h2' },
    { id: 'v', name: 'Guest', userId: 'u4', isAdmin: false, isViewer: true, householdId: null },
  ]
  it('each household sees its own log and members', () => {
    const all = [watch({ id: '1', householdId: 'h1' }), watch({ id: '2', householdId: 'h2' }), watch({ id: '3' })]
    expect(householdWatches(all, 'h1').map((w) => w.id)).toEqual(['1', '3'])
    expect(householdMembers(people, 'h2').map((p) => p.id)).toEqual(['f'])
    expect(householdMembers(people, null).map((p) => p.id)).toEqual(['l', 'a', 'f'])
  })
  const list = (over: object) => ({ id: 'x', householdId: 'h1', name: 'Movies', emoji: '🍿', visibility: 'household' as const, sharedWith: [], askVotes: false, isDefault: false, createdBy: 'l', createdAt: '', ...over })
  it('list privacy: only us, specific people, whole family', () => {
    expect(canSeeList(list({}), people[2])).toBe(false)
    expect(canSeeList(list({ visibility: 'people', sharedWith: ['f'] }), people[2])).toBe(true)
    expect(canSeeList(list({ visibility: 'people', sharedWith: ['f'] }), people[3])).toBe(false)
    expect(canSeeList(list({ visibility: 'circle' }), people[3])).toBe(true)
    expect(canSeeList(list({}), people[1])).toBe(true)
  })
  it('only the household edits its lists; viewers never', () => {
    expect(canEditList(list({}), people[1])).toBe(true)
    expect(canEditList(list({ visibility: 'circle' }), people[2])).toBe(false)
    expect(canEditList(list({}), { ...people[0], isViewer: true })).toBe(false)
  })
  it('ranks by votes, then newest', () => {
    const item = (id: string, votes: string[], createdAt: string) => ({ id, listId: 'x', kind: 'tv' as const, extId: 1, title: id, poster: null, year: null, genres: [], runtime: null, network: null, addedBy: null, votes, createdAt })
    expect(rankedItems([item('a', ['l'], '1'), item('b', ['l', 'a'], '0'), item('c', ['f'], '2')], 'x').map((i) => i.id)).toEqual(['b', 'c', 'a'])
  })
  it('family feed: things for you first, then other households, never your own', () => {
    const now = new Date('2026-10-11T12:00:00Z')
    const mine = watch({ id: 'm', householdId: 'h1', status: 'done', updatedAt: '2026-10-10T00:00:00Z' })
    const theirs = watch({ id: 't', householdId: 'h2', status: 'done', updatedAt: '2026-10-09T00:00:00Z' })
    const old = watch({ id: 'o', householdId: 'h2', status: 'done', updatedAt: '2026-08-01T00:00:00Z' })
    const rec = { id: 'r', from: 'f', to: 'l', note: '', status: 'new' as const, createdAt: '2026-10-01T00:00:00Z', kind: 'movie' as const, extId: 1, title: 'X', poster: null, year: null, genres: [], runtime: null, network: null }
    const feed = familyFeed([mine, theirs, old], [list({ visibility: 'circle', askVotes: true, householdId: 'h2' })], [rec], people[0], now)
    expect(feed.map((e) => e.kind)).toEqual(['rec', 'votes', 'finished'])
    expect(feed[2].kind === 'finished' && feed[2].watch.id).toBe('t')
  })
})

describe('seasons are separate logs', () => {
  const s1 = watch({ id: 's1', showId: 50, season: 1, status: 'done', episodesWatched: 8, totalEpisodes: 8, householdId: 'h1', updatedAt: '2026-10-01' })
  const s2 = watch({ id: 's2', showId: 50, season: 2, status: 'watching', episodesWatched: 2, householdId: 'h1', updatedAt: '2026-10-10' })
  const other = watch({ id: 'o1', showId: 50, season: 1, status: 'done', householdId: 'h2' })
  it('finds the log of another season (same show, same household)', () => {
    expect(logForSeason([s1, s2, other], s2, 1)?.id).toBe('s1')
    expect(logForSeason([s1, s2, other], s1, 2)?.id).toBe('s2')
    expect(logForSeason([s1, s2], s2, 3)).toBeNull()
  })
  it('a new season starts fresh and never touches the finished one', () => {
    const d = nextSeasonDraft(s1, 'new', 'l', new Date('2026-10-12T12:00:00'))
    expect(d).toMatchObject({ id: 'new', season: 1, status: 'watching', episodesWatched: 0, ratings: {}, month: '2026-10' })
    expect(s1.status).toBe('done')
    expect(s1.episodesWatched).toBe(8)
  })
})
