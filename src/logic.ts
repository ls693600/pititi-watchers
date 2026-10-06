import type { SeasonInfo } from './tvmaze'
import type { Watch } from './types'

/** Whose rating counts for this log: the people who watched it, or anyone who rated if nobody is marked. */
export function raters(w: Pick<Watch, 'watchedBy' | 'ratings'>): string[] {
  return w.watchedBy.length ? w.watchedBy : Object.keys(w.ratings)
}

/** People who watched it but haven't rated yet. */
export function pendingRaters(w: Pick<Watch, 'watchedBy' | 'ratings'>): string[] {
  return raters(w).filter((id) => w.ratings[id] == null)
}

/** Average of everyone who watched it. Empty until all of them have rated. */
export function averageRating(w: Pick<Watch, 'watchedBy' | 'ratings'>): number | null {
  const ids = raters(w)
  if (!ids.length || pendingRaters(w).length) return null
  return ids.reduce((sum, id) => sum + w.ratings[id], 0) / ids.length
}

/** Admin removes anything; everyone else only logs they added. No session = single-phone mode. */
export function canDelete(w: Pick<Watch, 'createdBy'>, who: { personId: string; isAdmin: boolean } | null): boolean {
  if (!who) return true
  return who.isAdmin || (w.createdBy != null && w.createdBy === who.personId)
}

/** Logs a person watched; null means the whole family. */
export function watchedByPerson(list: Watch[], personId: string | null): Watch[] {
  return personId ? list.filter((w) => w.watchedBy.includes(personId)) : list
}

/** Each person's average rating across the given logs. */
export function personAverages(list: Watch[], personIds: string[]): Record<string, number | null> {
  return Object.fromEntries(
    personIds.map((id) => [id, mean(list.flatMap((w) => (w.ratings[id] != null ? [w.ratings[id]] : [])))]),
  )
}

export function currentMonth(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return currentMonth(d)
}

export function monthLabel(month: string, style: 'long' | 'short' = 'long'): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1, 1)
  return style === 'long'
    ? d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : d.toLocaleDateString('en-US', { month: 'short' })
}

export function byUpdatedDesc(a: Watch, b: Watch): number {
  return b.updatedAt.localeCompare(a.updatedAt)
}

/** Episodes per month for a log; older logs without the breakdown count everything in their month. */
export function monthBuckets(w: Pick<Watch, 'month' | 'episodesWatched' | 'episodesByMonth'>): Record<string, number> {
  const b = w.episodesByMonth
  if (b && Object.keys(b).length) return b
  return w.episodesWatched > 0 ? { [w.month]: w.episodesWatched } : {}
}

/** Episodes of this log watched in a given month. */
export function episodesIn(w: Watch, month: string): number {
  return monthBuckets(w)[month] ?? 0
}

/** A log belongs to every month it had episodes in, plus the month it was last logged in. */
export function activeIn(w: Watch, month: string): boolean {
  return w.month === month || episodesIn(w, month) > 0
}

export function watchesInMonth(all: Watch[], month: string): Watch[] {
  return all.filter((w) => activeIn(w, month)).sort(byUpdatedDesc)
}

/** Shows in progress, most recently touched first (not tied to a month). */
export function currentlyWatching(all: Watch[]): Watch[] {
  return all.filter((w) => w.status === 'watching').sort(byUpdatedDesc)
}

/**
 * Keeps the per-month episode breakdown in step with a change.
 * New episodes count in the log's month; removed episodes come off the latest months first;
 * changing only the month of a single-month log moves its episodes with it.
 */
export function reconcileMonths(prev: Watch | null, next: Watch): Watch {
  if (!prev) {
    return { ...next, episodesByMonth: next.episodesWatched > 0 ? { [next.month]: next.episodesWatched } : {} }
  }
  const before = { ...monthBuckets(prev) }
  const keys = Object.keys(before)
  // Month edited with no new episodes = relocating the log (e.g. it was really watched last year)
  const relocated = prev.month !== next.month && next.episodesWatched === prev.episodesWatched
  if (relocated && keys.every((k) => k === prev.month)) {
    return { ...next, episodesByMonth: next.episodesWatched > 0 ? { [next.month]: next.episodesWatched } : {} }
  }
  let delta = next.episodesWatched - prev.episodesWatched
  if (delta > 0) before[next.month] = (before[next.month] ?? 0) + delta
  for (const k of keys.sort().reverse()) {
    if (delta >= 0) break
    const take = Math.min(before[k], -delta)
    before[k] -= take
    delta += take
  }
  const episodesByMonth = Object.fromEntries(Object.entries(before).filter(([, n]) => n > 0))
  return { ...next, episodesByMonth }
}

/** How many times this show-season has been logged in total. */
export function timesWatched(all: Watch[], showId: number, season: number): number {
  return all.filter((w) => w.showId === showId && w.season === season).length
}

/** True when this show-season was already logged before, so a new log is a rewatch. */
export function isPriorWatch(all: Watch[], showId: number, season: number, excludeId?: string): boolean {
  return all.some((w) => w.showId === showId && w.season === season && w.id !== excludeId)
}

/** Episodes of a log in a period: one month, a set of months, or all time. */
function episodesFor(w: Watch, months?: string | ((m: string) => boolean)): number {
  if (months == null) return w.episodesWatched
  if (typeof months === 'string') return episodesIn(w, months)
  return Object.entries(monthBuckets(w)).reduce((s, [m, n]) => (months(m) ? s + n : s), 0)
}

export function hoursWatched(list: Watch[], months?: string | ((m: string) => boolean)): number {
  const minutes = list.reduce((sum, w) => sum + episodesFor(w, months) * (w.runtime ?? 0), 0)
  return Math.round(minutes / 60)
}

export interface Summary {
  shows: number
  episodes: number
  hours: number
  rewatches: number
}

/** Distinct shows: two seasons (or a rewatch) of the same show count once. */
export function uniqueShows(list: Watch[]): number {
  return new Set(list.map((w) => w.showId)).size
}

/** Totals for a list of logs; pass a month (or month test) to count only episodes watched then. */
export function summarize(list: Watch[], months?: string | ((m: string) => boolean)): Summary {
  return {
    shows: uniqueShows(list),
    episodes: list.reduce((s, w) => s + episodesFor(w, months), 0),
    hours: hoursWatched(list, months),
    rewatches: list.filter((w) => w.isRewatch).length,
  }
}

/** Mark one more episode watched. Moves the log to the current month and finishes it at the last episode. */
export function addEpisode(w: Watch, now = new Date()): Watch {
  const next = w.episodesWatched + 1
  const capped = w.totalEpisodes != null ? Math.min(next, w.totalEpisodes) : next
  const done = w.totalEpisodes != null && capped >= w.totalEpisodes
  return {
    ...w,
    episodesWatched: capped,
    status: done ? 'done' : w.status,
    month: currentMonth(now),
    updatedAt: now.toISOString(),
  }
}

export interface YearStats extends Summary {
  perMonth: { month: string; count: number }[]
  /** Average shows per month, over the months of the year that have passed */
  avgPerMonth: number
  busiest: { month: string; count: number } | null
  topRated: { watch: Watch; avg: number }[]
  disagreements: { watch: Watch; diff: number }[]
}

function mean(nums: number[]): number | null {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null
}

export function yearStats(all: Watch[], year: number, now = new Date()): YearStats {
  const inYear = (m: string) => m.startsWith(`${year}-`)
  const list = all.filter((w) => inYear(w.month) || Object.keys(monthBuckets(w)).some(inYear))
  const perMonth = Array.from({ length: 12 }, (_, i) => {
    const month = `${year}-${String(i + 1).padStart(2, '0')}`
    return { month, count: uniqueShows(list.filter((w) => activeIn(w, month))) }
  })
  const rated = list
    .map((watch) => ({ watch, avg: averageRating(watch) }))
    .filter((r): r is { watch: Watch; avg: number } => r.avg != null)
  const topRated = [...rated].sort((a, b) => b.avg - a.avg).slice(0, 5)
  const disagreements = rated
    .map(({ watch }) => {
      const stars = raters(watch).map((id) => watch.ratings[id])
      return { watch, diff: Math.max(...stars) - Math.min(...stars) }
    })
    .filter((d) => d.diff >= 2)
    .sort((a, b) => b.diff - a.diff)
    .slice(0, 3)
  const monthsElapsed = year < now.getFullYear() ? 12 : year > now.getFullYear() ? 0 : now.getMonth() + 1
  const counted = perMonth.slice(0, monthsElapsed)
  const busiest = counted.reduce<{ month: string; count: number } | null>(
    (best, m) => (m.count > 0 && (!best || m.count > best.count) ? m : best),
    null,
  )
  return {
    ...summarize(list, inYear),
    perMonth,
    avgPerMonth: monthsElapsed ? counted.reduce((s, m) => s + m.count, 0) / monthsElapsed : 0,
    busiest,
    topRated,
    disagreements,
  }
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    try {
      return crypto.randomUUID()
    } catch {
      // randomUUID throws outside secure contexts (plain http on the LAN)
    }
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

/** Blind rating: you always see your own stars; everyone else's appear once all watchers have rated. */
export function canSeeRating(w: Pick<Watch, 'watchedBy' | 'ratings'>, personId: string, viewer: string | null): boolean {
  return viewer == null || personId === viewer || averageRating(w) != null
}

/** You rate for yourself, and for family members who don't have their own account (kids, grandparents). */
export function canEditRating(person: { id: string; userId: string | null }, viewer: string | null): boolean {
  return viewer == null || person.id === viewer || person.userId == null
}

/** Gap between the highest and lowest rating among the watchers. */
export function ratingSpread(w: Pick<Watch, 'watchedBy' | 'ratings'>): number {
  const stars = raters(w).flatMap((id) => (w.ratings[id] != null ? [w.ratings[id]] : []))
  return stars.length ? Math.max(...stars) - Math.min(...stars) : 0
}

export function verdict(spread: number): string {
  if (spread === 0) return 'Perfect match'
  if (spread === 1) return 'Almost a perfect match'
  if (spread === 2) return 'Mixed feelings'
  return 'Big debate'
}

/** Logs that just became fully rated and are worth a reveal for this viewer (2+ watchers, viewer among them, not seen yet). */
export function pendingReveals(list: Watch[], viewer: string | null, seen: Set<string>): Watch[] {
  if (!viewer) return []
  return list
    .filter((w) => w.watchedBy.length > 1 && w.watchedBy.includes(viewer) && averageRating(w) != null && !seen.has(w.id))
    .sort(byUpdatedDesc)
}

/** Switch a log to another season: picks up its episode count and whether it's a rewatch. */
export function withSeason(cur: Watch, s: SeasonInfo, all: Watch[]): Watch {
  const next: Watch = {
    ...cur,
    season: s.number,
    totalEpisodes: s.episodes,
    episodesWatched: cur.status === 'done' && s.episodes ? s.episodes : Math.min(cur.episodesWatched, s.episodes ?? Infinity),
    isRewatch: isPriorWatch(all, cur.showId, s.number, cur.id),
  }
  return capToAired(next, s.airedEpisodes ?? null)
}

/**
 * A season that's still airing can't be finished: "finished" means caught up with what's out.
 * Keeps hours and episode counts honest (announced-but-unaired episodes never count).
 */
export function capToAired(w: Watch, aired: number | null): Watch {
  if (aired == null || w.totalEpisodes == null || aired >= w.totalEpisodes) return w
  if (w.status === 'done' || w.episodesWatched > aired) {
    return { ...w, episodesWatched: Math.min(w.status === 'done' ? aired : w.episodesWatched, aired), status: 'watching' }
  }
  return w
}

/** Times this show-season has been logged, counting the log being edited once even if its season just changed. */
export function timesWatchedFor(all: Watch[], w: Pick<Watch, 'id' | 'showId' | 'season'>): number {
  return all.filter((x) => x.id !== w.id && x.showId === w.showId && x.season === w.season).length + 1
}

/** The season a new log should start on: the latest one that has aired. */
export function defaultSeason(seasons: SeasonInfo[]): SeasonInfo | undefined {
  return seasons.filter((x) => x.aired).at(-1) ?? seasons[0]
}

/** Most wanted first; ties go to the most recently added. */
export function rankUpNext<T extends { wantedBy: string[]; createdAt: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.wantedBy.length - a.wantedBy.length || b.createdAt.localeCompare(a.createdAt))
}

/**
 * Tonight's pick: a weighted draw where every heart is a ticket (plus one so nothing is impossible).
 * Pass `exclude` to "pick again" without landing on the same show.
 */
export function pickTonight<T extends { id: string; wantedBy: string[] }>(items: T[], rand = Math.random(), exclude?: string): T | null {
  const pool = items.filter((i) => i.id !== exclude)
  if (!pool.length) return items[0] ?? null
  const total = pool.reduce((s, i) => s + i.wantedBy.length + 1, 0)
  let ticket = rand * total
  for (const i of pool) {
    ticket -= i.wantedBy.length + 1
    if (ticket < 0) return i
  }
  return pool[pool.length - 1]
}

/** Toggle one person's heart (local mirror of the database function). */
export function toggleWant<T extends { wantedBy: string[] }>(item: T, personId: string): T {
  const has = item.wantedBy.includes(personId)
  return { ...item, wantedBy: has ? item.wantedBy.filter((x) => x !== personId) : [...item.wantedBy, personId] }
}

/**
 * Tap an episode in the grid: everything up to it is watched.
 * Tapping your latest watched episode again un-watches it (fixes a mis-tap).
 */
export function tapEpisode(w: Watch, n: number, aired: number | null = null): Watch {
  // Episodes that haven't aired can't be watched yet
  if (aired != null && n > aired) return w
  const watched = n === w.episodesWatched ? n - 1 : n
  const done = w.totalEpisodes != null && watched >= w.totalEpisodes
  return { ...w, episodesWatched: Math.max(0, watched), status: done ? 'done' : 'watching' }
}

/** "Thu, Oct 9" for an ISO date, or "Today"/"Tomorrow". */
export function airLabel(date: string, now = new Date()): string {
  const [y, m, d] = date.split('-').map(Number)
  const day = new Date(y, m - 1, d)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diff = Math.round((day.getTime() - today.getTime()) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  return day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export interface TasteMatch {
  a: string
  b: string
  /** 0–100: how close their stars are, on shows both rated */
  score: number
  shared: number
  /** Shows within one star of each other */
  agreed: number
  /** Biggest gap between them, if 2+ stars */
  clash: { watch: Watch; diff: number } | null
}

/** Shows both people rated, needed before a match score means anything. */
export const MATCH_MIN_SHARED = 3

/** Taste match for every pair who rated at least one show together. Strongest data first. */
export function tasteMatches(list: Watch[], personIds: string[]): TasteMatch[] {
  const out: TasteMatch[] = []
  for (let i = 0; i < personIds.length; i++) {
    for (let j = i + 1; j < personIds.length; j++) {
      const a = personIds[i]
      const b = personIds[j]
      const both = list.filter((w) => w.ratings[a] != null && w.ratings[b] != null)
      if (!both.length) continue
      const diffs = both.map((w) => ({ watch: w, diff: Math.abs(w.ratings[a] - w.ratings[b]) }))
      const closeness = diffs.reduce((s, d) => s + (1 - d.diff / 4), 0) / diffs.length
      const worst = diffs.reduce((m, d) => (d.diff > m.diff ? d : m), diffs[0])
      out.push({
        a,
        b,
        score: Math.round(closeness * 100),
        shared: both.length,
        agreed: diffs.filter((d) => d.diff <= 1).length,
        clash: worst.diff >= 2 ? worst : null,
      })
    }
  }
  return out.sort((x, y) => y.shared - x.shared || y.score - x.score)
}

export interface Badge {
  id: string
  title: string
  detail: string
  progress: number
  target: number
  earned: boolean
}

/** Longest run of consecutive months with at least one log. */
export function monthStreak(list: Watch[]): number {
  const months = [...new Set(list.map((w) => w.month))].sort()
  let best = 0
  let run = 0
  let prev: string | null = null
  for (const m of months) {
    run = prev && shiftMonth(prev, 1) === m ? run + 1 : 1
    best = Math.max(best, run)
    prev = m
  }
  return best
}

/** Family badges, all computed from what's already logged. */
export function familyBadges(list: Watch[]): Badge[] {
  const perfect = list.filter((w) => w.watchedBy.length > 1 && averageRating(w) != null && ratingSpread(w) === 0).length
  const busiestMonthEpisodes = Math.max(0, ...[...new Set(list.map((w) => w.month))].map((m) => summarize(watchesInMonth(list, m)).episodes))
  const genres = new Set(list.flatMap((w) => w.genres))
  const lateNight = list.filter((w) => {
    const h = new Date(w.createdAt).getHours()
    return h >= 1 && h < 5
  }).length
  const make = (id: string, title: string, detail: string, progress: number, target: number): Badge => ({
    id,
    title,
    detail,
    progress: Math.min(progress, target),
    target,
    earned: progress >= target,
  })
  return [
    make('streak', 'On a roll', 'Log shows 3 months in a row', monthStreak(list), 3),
    make('binge', 'Binge mode', '50 episodes in one month', busiestMonthEpisodes, 50),
    make('soulmates', 'Soulmates', '5 perfect matches', perfect, 5),
    make('family-night', 'Family night', 'A show watched by 3 or more', Math.max(0, ...list.map((w) => w.watchedBy.length)), 3),
    make('debate', 'Agree to disagree', 'A show 3+ stars apart', Math.max(0, ...list.filter((w) => averageRating(w) != null).map(ratingSpread)), 3),
    make('rewatch', 'Rewatch royalty', '5 rewatches', list.filter((w) => w.isRewatch).length, 5),
    make('explorer', 'Explorer', 'Shows from 6 genres', genres.size, 6),
    make('night-owl', 'Night owl', 'Log a show after 1 AM', lateNight, 1),
    make('centurion', 'Centurion', '100 different shows', uniqueShows(list), 100),
  ]
}

/** Badges earned now that weren't before, for the "badge unlocked" moment. */
export function newlyEarned(badges: Badge[], seen: Set<string>): Badge[] {
  return badges.filter((b) => b.earned && !seen.has(b.id))
}

export interface Outlook {
  /** Aired episodes of this season you haven't watched yet */
  ready: number
  /** Next new episode, if one is scheduled */
  next: { date: string; season: number; number: number; name: string } | null
}

/**
 * What's waiting for a show you're watching: episodes already out that you haven't seen,
 * and when the next new one airs. Uses TVmaze's next-episode info for the show.
 */
export function episodeOutlook(
  w: Pick<Watch, 'season' | 'episodesWatched' | 'totalEpisodes'>,
  nextEpisode: { season: number; number: number; airdate: string; name: string } | null,
): Outlook {
  let aired: number | null
  if (nextEpisode && nextEpisode.season === w.season) aired = nextEpisode.number - 1
  else aired = w.totalEpisodes // this season has fully aired (or next is a later season)
  const ready = aired != null ? Math.max(0, aired - w.episodesWatched) : 0
  return {
    ready,
    next: nextEpisode ? { date: nextEpisode.airdate, season: nextEpisode.season, number: nextEpisode.number, name: nextEpisode.name } : null,
  }
}

/** Order for the banner: shows with episodes ready first, then by the soonest new episode, then the rest. */
export function outlookOrder(a: Outlook | undefined, b: Outlook | undefined): number {
  const rank = (o?: Outlook) => (o?.ready ? 0 : o?.next ? 1 : 2)
  const r = rank(a) - rank(b)
  if (r) return r
  if (a?.next && b?.next) return a.next.date.localeCompare(b.next.date)
  return 0
}
