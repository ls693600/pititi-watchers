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

export function watchesInMonth(all: Watch[], month: string): Watch[] {
  return all.filter((w) => w.month === month).sort(byUpdatedDesc)
}

/** How many times this show-season has been logged in total. */
export function timesWatched(all: Watch[], showId: number, season: number): number {
  return all.filter((w) => w.showId === showId && w.season === season).length
}

/** True when this show-season was already logged before, so a new log is a rewatch. */
export function isPriorWatch(all: Watch[], showId: number, season: number, excludeId?: string): boolean {
  return all.some((w) => w.showId === showId && w.season === season && w.id !== excludeId)
}

export function hoursWatched(list: Watch[]): number {
  const minutes = list.reduce((sum, w) => sum + w.episodesWatched * (w.runtime ?? 0), 0)
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

export function summarize(list: Watch[]): Summary {
  return {
    shows: uniqueShows(list),
    episodes: list.reduce((s, w) => s + w.episodesWatched, 0),
    hours: hoursWatched(list),
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
  const list = all.filter((w) => w.month.startsWith(`${year}-`))
  const perMonth = Array.from({ length: 12 }, (_, i) => {
    const month = `${year}-${String(i + 1).padStart(2, '0')}`
    return { month, count: uniqueShows(list.filter((w) => w.month === month)) }
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
    ...summarize(list),
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
