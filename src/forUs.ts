// "For us" on Home: movies and series like the ones your household loved (rated 8 or more), from TMDB's recommendations.
import { averageRating, kindOf, ratedShows } from './logic'
import { getForUs } from './movies'
import type { Watch } from './types'
import { cleanPicks, type WeeklyPick } from './weeklyPicks'

export interface ForUsPick extends WeeklyPick {
  /** The loved titles it came from ("tv:123" / "movie:456"), strongest first */
  because: string[]
}

/** A title you loved, as the server knows it */
export interface Loved {
  ref: string
  title: string
}

const KEY = 'pititi.forus.v1'
/** Refreshed every few days, or right away when the loved titles change */
const TTL = 3 * 86_400_000
/** Only what the household loved counts */
export const LOVED_SCORE = 8
const MAX_LOVED = 8
/** Fewer than this and the tab isn't worth showing */
export const MIN_FOR_US = 6

const refOf = (w: Watch) => `${kindOf(w)}:${w.showId}`

/** The household's best-rated titles (8+), best and most recent first. */
export function lovedTitles(watches: Watch[]): Loved[] {
  const seen = new Set<string>()
  return ratedShows(watches)
    .map((w) => ({ w, avg: averageRating(w) }))
    .filter((x): x is { w: Watch; avg: number } => x.avg != null && x.avg >= LOVED_SCORE)
    .sort((a, b) => b.avg - a.avg || b.w.updatedAt.localeCompare(a.w.updatedAt))
    .filter(({ w }) => !seen.has(refOf(w)) && seen.add(refOf(w)))
    .slice(0, MAX_LOVED)
    .map(({ w }) => ({ ref: refOf(w), title: w.showName }))
}

/** Well-formed picks from the server, each with at least one loved title behind it. */
export function cleanForUs(raw: unknown): ForUsPick[] {
  if (!Array.isArray(raw)) return []
  const because = new Map(raw.map((x) => [`${x?.kind}:${x?.extId}`, Array.isArray(x?.because) ? x.because.filter((r: unknown) => typeof r === 'string') : []]))
  return cleanPicks(raw)
    .map((p) => ({ ...p, because: because.get(`${p.kind}:${p.extId}`) ?? [] }))
    .filter((p) => p.because.length > 0)
}

/** Drops anything the household already logged. */
export function unwatched(picks: ForUsPick[], watches: Watch[]): ForUsPick[] {
  const logged = new Set(watches.map(refOf))
  return picks.filter((p) => !logged.has(`${p.kind}:${p.extId}`))
}

function readCache(): { key: string; at: number; items: ForUsPick[] } | null {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || 'null')
    return c && typeof c.key === 'string' && typeof c.at === 'number' ? { key: c.key, at: c.at, items: cleanForUs(c.items) } : null
  } catch {
    return null
  }
}

/** Picks for these loved titles: from this phone for a few days, then fresh. The last list if the server can't answer. */
export async function loadForUs(loved: Loved[], now = Date.now()): Promise<ForUsPick[]> {
  if (!loved.length) return []
  const key = loved.map((l) => l.ref).join(',')
  const cached = readCache()
  if (cached?.key === key && now - cached.at < TTL && cached.items.length) return cached.items
  try {
    const items = cleanForUs(await getForUs(loved.map((l) => l.ref)))
    if (items.length) {
      try {
        localStorage.setItem(KEY, JSON.stringify({ key, at: now, items }))
      } catch {
        // Storage full: fetched again next time
      }
      return items
    }
  } catch {
    // Offline or the server is down: fall through
  }
  return cached?.items ?? []
}
