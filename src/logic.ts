import type { SeasonInfo } from './tvmaze'
import type { Comment, Household, Kind, ListItem, Person, Reaction, Recommendation, Title, Watch, WatchList } from './types'

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
/** True when this show-season was already finished in another log, so a new log is a rewatch. */
export function isPriorWatch(all: Watch[], showId: number, season: number, excludeId?: string, kind: Kind = 'tv'): boolean {
  return all.some((w) => w.showId === showId && kindOf(w) === kind && w.season === season && w.id !== excludeId && w.status === 'done')
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
    isRewatch: isPriorWatch(all, cur.showId, s.number, cur.id, kindOf(cur)),
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
export function timesWatchedFor(all: Watch[], w: Pick<Watch, 'id' | 'showId' | 'season' | 'kind'>): number {
  // Only finished watches of this season count; an unfinished duplicate isn't a second viewing
  return all.filter((x) => x.id !== w.id && sameTitle(x, w) && x.season === w.season && x.status === 'done').length + 1
}

/** Another log of the same show-season that's still open: a duplicate, not a rewatch. */
export function findDuplicate(all: Watch[], w: Pick<Watch, 'id' | 'showId' | 'season' | 'status' | 'kind'>): Watch | null {
  return (
    all.find((x) => x.id !== w.id && sameTitle(x, w) && x.season === w.season && (x.status === 'watching' || w.status === 'watching')) ?? null
  )
}

/**
 * A log marked as a rewatch next to an earlier finished log of the same season. Usually a real rewatch,
 * but the old duplicate bug produced these too, so the show page offers "Only watched once? Merge".
 */
export function rewatchPair(all: Watch[], w: Pick<Watch, 'id' | 'showId' | 'season' | 'isRewatch' | 'kind'>): Watch | null {
  if (!w.isRewatch) return null
  return all.filter((x) => x.id !== w.id && sameTitle(x, w) && x.season === w.season && x.status === 'done').sort(byUpdatedDesc)[0] ?? null
}

/** The show you're already in the middle of (any season), so re-adding it opens that log instead of a copy. */
export function inProgressFor(all: Watch[], showId: number, kind: Kind = 'tv'): Watch | null {
  return all.filter((w) => w.showId === showId && kindOf(w) === kind && w.status === 'watching').sort(byUpdatedDesc)[0] ?? null
}

/** Combine two logs of the same show-season into one: furthest progress, everyone who watched, all ratings and months. */
export function mergeLogs(keep: Watch, drop: Watch): Watch {
  const a = monthBuckets(keep)
  const b = monthBuckets(drop)
  const combined: Record<string, number> = { ...a }
  for (const [m, n] of Object.entries(b)) combined[m] = Math.max(combined[m] ?? 0, n)
  const episodesWatched = Math.max(keep.episodesWatched, drop.episodesWatched)
  // The copies overlap (the same episodes were logged twice): count each episode once, earliest month first
  let months: Record<string, number> = {}
  if (keep.status === 'done' && drop.status === 'done') {
    // Two finished copies of one viewing: the later one is when you actually finished, so its months win
    const later = keep.month >= drop.month ? keep : drop
    months = { ...monthBuckets(later) }
  } else {
    let left = episodesWatched
    for (const m of Object.keys(combined).sort()) {
      const take = Math.min(combined[m], left)
      if (take > 0) months[m] = take
      left -= take
    }
  }
  return {
    ...keep,
    episodesWatched,
    status: keep.status === 'done' || drop.status === 'done' ? 'done' : 'watching',
    totalEpisodes: keep.totalEpisodes ?? drop.totalEpisodes,
    watchedBy: [...new Set([...keep.watchedBy, ...drop.watchedBy])],
    ratings: { ...drop.ratings, ...keep.ratings },
    notes: [keep.notes, drop.notes].filter(Boolean).join('\n'),
    episodesByMonth: months,
    // Filed under the last month its episodes count in, so Home and the numbers agree
    month: Object.keys(months).sort().pop() ?? (keep.month > drop.month ? keep.month : drop.month),
    // Merging means it was one viewing logged twice; only a log that was already a rewatch before stays one
    isRewatch: keep.isRewatch && drop.isRewatch,
  }
}

/** New logs: only the person logging, unless they pick others. Nobody gets added to shows they didn't watch. */
export function defaultWatchersFor(me: string | null, people: { id: string }[]): string[] {
  return me ? [me] : people.slice(0, 1).map((p) => p.id)
}

/** A season can't be watched before it premiered: the month to use instead, or null if fine. */
export function premiereMonthFix(month: string, premiereDate: string | null | undefined): string | null {
  if (!premiereDate) return null
  const premiere = premiereDate.slice(0, 7)
  return month < premiere ? premiere : null
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
  /** Unwatched episodes that aired in the last few weeks: genuinely new */
  fresh: number
  /** All unwatched episodes that are already out (new or old) */
  toGo: number
  /** Next new episode, if one is scheduled */
  next: { date: string; season: number; number: number; name: string } | null
}

/** "New" means it aired within this many days. */
export const FRESH_DAYS = 30

function daysBefore(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d) - days * 86_400_000)
  return t.toISOString().slice(0, 10)
}

/**
 * What's waiting for a show you're watching, judged by real air dates:
 * episodes out that you haven't seen (and which of them are recent enough to call new),
 * and when the next new one airs. Without episode dates nothing is ever called "new".
 */
export function episodeOutlook(
  w: Pick<Watch, 'season' | 'episodesWatched' | 'totalEpisodes'>,
  nextEpisode: { season: number; number: number; airdate: string; name: string } | null,
  seasonEpisodes: { number: number; airdate: string | null }[] | null,
  today: string,
): Outlook {
  const next = nextEpisode ? { date: nextEpisode.airdate, season: nextEpisode.season, number: nextEpisode.number, name: nextEpisode.name } : null
  if (seasonEpisodes) {
    const unwatched = seasonEpisodes.filter((e) => e.number > w.episodesWatched && e.airdate != null && e.airdate <= today)
    const since = daysBefore(today, FRESH_DAYS)
    return { fresh: unwatched.filter((e) => e.airdate! >= since).length, toGo: unwatched.length, next }
  }
  // No episode list: estimate what's out, but don't claim any of it is new
  const aired = nextEpisode && nextEpisode.season === w.season ? nextEpisode.number - 1 : w.totalEpisodes
  return { fresh: 0, toGo: aired != null ? Math.max(0, aired - w.episodesWatched) : 0, next }
}

/** Banner order: new episodes first, then caught-up shows by next air date, then older episodes to go, then the rest. */
export function outlookOrder(a: Outlook | undefined, b: Outlook | undefined): number {
  const rank = (o?: Outlook) => (o?.fresh ? 0 : o?.next && !o.toGo ? 1 : o?.toGo ? 2 : o?.next ? 1 : 3)
  const r = rank(a) - rank(b)
  if (r) return r
  if (a?.next && b?.next) return a.next.date.localeCompare(b.next.date)
  return 0
}

/** A person's own top shows by their stars (ties: most recent first). */
export function personalTop(list: Watch[], personId: string, n = 5): { watch: Watch; avg: number }[] {
  return list
    .filter((w) => w.ratings[personId] != null)
    .sort((a, b) => b.ratings[personId] - a.ratings[personId] || b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, n)
    .map((watch) => ({ watch, avg: watch.ratings[personId] }))
}

// ---- Reactions and family chat ----

export const REACTIONS = ['😂', '🔥', '😱', '👏', '🙄', '❤️'] as const
export const COMMENT_MAX = 280

/** React to someone else's stars, once everyone's ratings are out (never during the blind phase). */
export function canReact(w: Pick<Watch, 'watchedBy' | 'ratings'>, targetId: string, viewer: string | null): boolean {
  return viewer != null && targetId !== viewer && w.ratings[targetId] != null && averageRating(w) != null
}

/** Reactions on one person's rating, grouped by emoji in the fixed order. */
export function reactionGroups(all: Reaction[], watchId: string, targetId: string): { emoji: string; people: string[] }[] {
  const mine = all.filter((r) => r.watchId === watchId && r.targetId === targetId)
  return REACTIONS.map((emoji) => ({ emoji: emoji as string, people: mine.filter((r) => r.emoji === emoji).map((r) => r.personId) })).filter(
    (g) => g.people.length,
  )
}

/** Tapping your current emoji removes it; another emoji replaces it. Returns the new list. */
export function toggleReaction(all: Reaction[], r: Reaction): Reaction[] {
  const same = (x: Reaction) => x.watchId === r.watchId && x.personId === r.personId && x.targetId === r.targetId
  const current = all.find(same)
  const rest = all.filter((x) => !same(x))
  return current?.emoji === r.emoji ? rest : [...rest, r]
}

/**
 * Open while you're watching (that's when you want to talk). Once the season is finished, watchers
 * who haven't rated read it after rating, so nobody's stars get nudged.
 */
export function chatLocked(w: Pick<Watch, 'watchedBy' | 'ratings' | 'status'>, viewer: string | null): boolean {
  return viewer != null && w.status === 'done' && w.watchedBy.includes(viewer) && w.ratings[viewer] == null
}

export function commentsFor(all: Comment[], watchId: string | null): Comment[] {
  return all.filter((c) => c.watchId === watchId).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

/** Trims and validates a chat line; null when there's nothing to send. */
export function cleanComment(text: string): string | null {
  const t = text.replace(/\s+/g, ' ').trim()
  return t ? t.slice(0, COMMENT_MAX) : null
}

/** "now", "5m", "3h", "2d", then a date. */
export function timeAgo(iso: string, now = new Date()): string {
  const s = Math.max(0, (now.getTime() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'now'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Comments from others that this phone hasn't seen yet (first run: none, just remember). */
export function unseenComments(all: Comment[], seen: Set<string> | null, viewer: string | null): Comment[] {
  if (!seen) return []
  return all.filter((c) => !seen.has(c.id) && c.personId !== viewer)
}

// ---- Quick actions ----

/** Everything that has aired is watched. Done when the season is complete; still airing stays "watching" (caught up). */
export function finishSeason(w: Watch, aired: number | null, now = new Date()): Watch {
  const out = aired ?? w.totalEpisodes ?? w.episodesWatched
  const target = Math.max(w.episodesWatched, out)
  const complete = w.totalEpisodes == null || target >= w.totalEpisodes
  return { ...w, episodesWatched: target, status: complete ? 'done' : 'watching', month: currentMonth(now), updatedAt: now.toISOString() }
}

/** Add someone to "Who watched?" (their rating starts empty). */
export function joinWatchers(w: Watch, personId: string): Watch {
  return w.watchedBy.includes(personId) ? w : { ...w, watchedBy: [...w.watchedBy, personId], updatedAt: new Date().toISOString() }
}

/** Your own stars, set or cleared, straight from the quick menu. */
export function setOwnRating(w: Watch, personId: string, stars: number | null): Watch {
  const ratings = { ...w.ratings }
  if (stars == null) delete ratings[personId]
  else ratings[personId] = stars
  return { ...w, ratings, updatedAt: new Date().toISOString() }
}

// ---- Watching together ----

/** "Just me" or everyone in the family. With more than two people, Together starts with everyone and chips fine-tune it. */
export function togetherWatchers(me: string | null, people: { id: string }[], together: boolean): string[] {
  if (!together) return me ? [me] : people.slice(0, 1).map((p) => p.id)
  return people.map((p) => p.id)
}

/** How the score reads: one watcher's own stars, or an average of several. */
export function scoreLabel(w: Pick<Watch, 'watchedBy'>, nameOf: (id: string) => string): string {
  return w.watchedBy.length === 1 ? `${nameOf(w.watchedBy[0])}'s rating` : 'Our average'
}

// ---- Year in Review ----

export interface PersonYear {
  id: string
  shows: number
  hours: number
}

export interface YearReview {
  year: number
  shows: number
  episodes: number
  hours: number
  /** Whole days of TV, for "that's N days" */
  days: number
  top: { watch: Watch; avg: number } | null
  busiest: { month: string; count: number } | null
  /** Hours per person, most first (only people who watched something) */
  people: PersonYear[]
  genres: { name: string; count: number }[]
  disagreement: { watch: Watch; diff: number } | null
  /** Logged as watched together by 2+ people */
  together: number
  solo: number
}

export function yearReview(all: Watch[], personIds: string[], year: number, now = new Date()): YearReview {
  const s = yearStats(all, year, now)
  const inYear = (m: string) => m.startsWith(`${year}-`)
  const list = all.filter((w) => inYear(w.month) || Object.keys(monthBuckets(w)).some(inYear))
  const people = personIds
    .map((id) => {
      const mine = list.filter((w) => w.watchedBy.includes(id))
      return { id, shows: uniqueShows(mine), hours: hoursWatched(mine, inYear) }
    })
    .filter((p) => p.shows > 0)
    .sort((a, b) => b.hours - a.hours || b.shows - a.shows)
  const genreCount = new Map<string, Set<number>>()
  for (const w of list) for (const g of w.genres) genreCount.set(g, (genreCount.get(g) ?? new Set()).add(w.showId))
  const genres = [...genreCount.entries()]
    .map(([name, ids]) => ({ name, count: ids.size }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 3)
  return {
    year,
    shows: s.shows,
    episodes: s.episodes,
    hours: s.hours,
    days: Math.floor(s.hours / 24),
    top: s.topRated[0] ?? null,
    busiest: s.busiest,
    people,
    genres,
    disagreement: s.disagreements[0] ?? null,
    together: list.filter((w) => w.watchedBy.length > 1).length,
    solo: list.filter((w) => w.watchedBy.length === 1).length,
  }
}

// ---- Mentions ----

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** People @mentioned in a chat line (by name, any case; "@Ana," and "@ana!" both count). */
export function mentionsIn(text: string, people: { id: string; name: string }[]): string[] {
  return people.filter((p) => new RegExp(`(^|\\s)@${escapeRe(p.name)}(?![\\p{L}\\p{N}])`, 'iu').test(text)).map((p) => p.id)
}

/** Splits a chat line into plain text and @mention parts, for highlighting. */
export function mentionParts(text: string, people: { id: string; name: string }[]): { text: string; personId?: string }[] {
  if (!people.length) return [{ text }]
  const names = [...people].sort((a, b) => b.name.length - a.name.length).map((p) => escapeRe(p.name))
  const re = new RegExp(`@(${names.join('|')})(?![\\p{L}\\p{N}])`, 'giu')
  const out: { text: string; personId?: string }[] = []
  let last = 0
  for (const m of text.matchAll(re)) {
    const at = m.index ?? 0
    if (at > 0 && !/\s/.test(text[at - 1])) continue
    if (at > last) out.push({ text: text.slice(last, at) })
    const person = people.find((p) => p.name.toLowerCase() === m[1].toLowerCase())
    out.push({ text: `@${person?.name ?? m[1]}`, personId: person?.id })
    last = at + m[0].length
  }
  if (last < text.length) out.push({ text: text.slice(last) })
  return out
}

// ---- Messages (all chats in one place) ----

/** Key for a chat thread: a show's log id, or "family" for the Family chat. */
export const FAMILY_THREAD = 'family'
export const threadKey = (watchId: string | null): string => watchId ?? FAMILY_THREAD

export interface Thread {
  key: string
  watchId: string | null
  last: Comment | null
  count: number
  unread: number
}

/** Messages from others since you last opened that chat. */
export function unreadIn(all: Comment[], watchId: string | null, lastRead: Record<string, string>, me: string | null): number {
  const since = lastRead[threadKey(watchId)] ?? ''
  return all.filter((c) => c.watchId === watchId && c.personId !== me && c.createdAt > since).length
}

/** Family chat first (always), then show chats with messages, newest first. */
export function threads(all: Comment[], lastRead: Record<string, string>, me: string | null): Thread[] {
  const keys = new Map<string, string | null>([[FAMILY_THREAD, null]])
  for (const c of all) if (c.watchId) keys.set(c.watchId, c.watchId)
  const list = [...keys.values()].map((watchId) => {
    const msgs = commentsFor(all, watchId)
    return { key: threadKey(watchId), watchId, last: msgs[msgs.length - 1] ?? null, count: msgs.length, unread: unreadIn(all, watchId, lastRead, me) }
  })
  const [family, ...shows] = list
  shows.sort((a, b) => (b.last?.createdAt ?? '').localeCompare(a.last?.createdAt ?? ''))
  return [family, ...shows]
}

export function totalUnread(all: Comment[], lastRead: Record<string, string>, me: string | null): number {
  return threads(all, lastRead, me).reduce((s, t) => s + t.unread, 0)
}

// ---- Movies and TV ----

export const kindOf = (w: Pick<Watch, 'kind'>): Kind => w.kind ?? 'tv'

/** Same show or movie (TVmaze and TMDB ids can collide, so the kind matters). */
export function sameTitle(a: Pick<Watch, 'showId' | 'kind'>, b: Pick<Watch, 'showId' | 'kind'>): boolean {
  return a.showId === b.showId && kindOf(a) === kindOf(b)
}

/** A log as a Title (for lists and recommendations). */
export function titleOf(w: Watch): Title {
  return { kind: kindOf(w), extId: w.showId, title: w.showName, poster: w.poster, year: w.year, genres: w.genres, runtime: w.runtime, network: w.network }
}

/** A movie watch is one sitting: 1 "episode" of its full length. */
export function movieWatch(w: Watch): Watch {
  return { ...w, kind: 'movie', season: 1, totalEpisodes: 1, episodesWatched: w.status === 'done' ? 1 : 0 }
}

// ---- Households and the family circle ----

/** One household's log. No households yet (single phone, old data): everything is "ours". */
export function householdWatches(all: Watch[], householdId: string | null | undefined): Watch[] {
  if (!householdId) return all
  return all.filter((w) => !w.householdId || w.householdId === householdId)
}

/** People who can be marked "Who watched?" on a household's log. */
export function householdMembers(people: Person[], householdId: string | null | undefined): Person[] {
  const members = people.filter((p) => !p.isViewer)
  if (!householdId) return members
  const mine = members.filter((p) => p.householdId === householdId)
  return mine.length ? mine : members
}

/** "Leandro & Ana" from its people, when a household has no name yet. */
export function householdLabel(h: Household | undefined, people: Person[]): string {
  if (h?.name) return h.name
  const names = people.filter((p) => p.householdId === h?.id).map((p) => p.name)
  return names.length ? names.join(' & ') : 'Household'
}

// ---- Lists ----

/** Same rule as the database: your household's lists, lists shared with you, and family-wide lists. */
export function canSeeList(l: WatchList, me: Person | undefined): boolean {
  if (!me) return true
  return l.householdId === me.householdId || l.visibility === 'circle' || (l.visibility === 'people' && l.sharedWith.includes(me.id))
}

export function canEditList(l: WatchList, me: Person | undefined): boolean {
  if (!me) return true
  return !me.isViewer && l.householdId === me.householdId
}

/** Most votes first, then newest. */
export function rankedItems(items: ListItem[], listId: string): ListItem[] {
  return items
    .filter((i) => i.listId === listId)
    .sort((a, b) => b.votes.length - a.votes.length || b.createdAt.localeCompare(a.createdAt))
}

/** One vote per person per item: voting again takes it back. */
export function toggleVote(item: ListItem, personId: string): ListItem {
  return { ...item, votes: item.votes.includes(personId) ? item.votes.filter((v) => v !== personId) : [...item.votes, personId] }
}

export function visibilityLabel(l: Pick<WatchList, 'visibility' | 'sharedWith'>, people: Person[]): string {
  if (l.visibility === 'household') return 'Only us'
  if (l.visibility === 'circle') return 'Whole family'
  const names = people.filter((p) => l.sharedWith.includes(p.id)).map((p) => p.name)
  return names.length ? `Us + ${names.join(', ')}` : 'Only us'
}

// ---- Family activity ----

export type FeedEvent =
  | { kind: 'finished'; at: string; watch: Watch; avg: number | null }
  | { kind: 'rec'; at: string; rec: Recommendation }
  | { kind: 'votes'; at: string; list: WatchList }

/**
 * What's happening in the circle: recommendations to you, "help us pick" lists, and what other
 * households finished in the last 30 days (their averages only once everyone there has rated).
 */
export function familyFeed(
  watches: Watch[],
  lists: WatchList[],
  recs: Recommendation[],
  me: Person | undefined,
  now = new Date(),
): FeedEvent[] {
  const since = new Date(now.getTime() - 30 * 86_400_000).toISOString()
  const events: FeedEvent[] = []
  for (const r of recs) if (me && r.to === me.id && r.status === 'new') events.push({ kind: 'rec', at: r.createdAt, rec: r })
  // Other households asking for votes (yours you already see in Lists)
  for (const l of lists) if (l.askVotes && canSeeList(l, me) && l.householdId !== me?.householdId) events.push({ kind: 'votes', at: l.createdAt, list: l })
  for (const w of watches) {
    if (w.status !== 'done' || w.updatedAt < since) continue
    if (me?.householdId && (!w.householdId || w.householdId === me.householdId)) continue
    events.push({ kind: 'finished', at: w.updatedAt, watch: w, avg: averageRating(w) })
  }
  // Things for you first, then newest
  const weight = (e: FeedEvent) => (e.kind === 'rec' ? 2 : e.kind === 'votes' ? 1 : 0)
  return events.sort((a, b) => weight(b) - weight(a) || b.at.localeCompare(a.at))
}
