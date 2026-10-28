// Picks of the week on Home: TMDB's trending movies and series, kept the same from Monday to Sunday on this phone.
import type { FestivePick } from './festivePicks'
import { getTrendingWeek } from './movies'

export interface WeeklyPick extends FestivePick {
  /** TMDB audience score, 1–10 */
  score: number
}

const KEY = 'pititi.weekly.v1'
/** Fewer than this and the rail isn't worth showing */
export const MIN_PICKS = 10

/** The Monday a week starts on (local date), e.g. "2026-10-26". */
export function weekOf(date: Date): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Keeps only well-formed picks from the server (anything odd is dropped, never shown half-broken). */
export function cleanPicks(raw: unknown): WeeklyPick[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  return raw.filter((x): x is WeeklyPick => {
    if (!x || (x.kind !== 'movie' && x.kind !== 'tv') || !(Number(x.extId) > 0) || typeof x.title !== 'string' || typeof x.poster !== 'string' || typeof x.score !== 'number') return false
    const key = `${x.kind}:${x.extId}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).map((x) => ({ ...x, titlePt: typeof x.titlePt === 'string' && x.titlePt ? x.titlePt : x.title, genres: Array.isArray(x.genres) ? x.genres : [], year: x.year ?? null, runtime: x.runtime ?? null, network: x.network ?? null }))
}

function readCache(): { week: string; items: WeeklyPick[] } | null {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || 'null')
    return c && typeof c.week === 'string' ? { week: c.week, items: cleanPicks(c.items) } : null
  } catch {
    return null
  }
}

/** This week's picks: fetched once per week, then served from this phone. Last week's list if the server can't answer. */
export async function loadWeeklyPicks(now = new Date()): Promise<WeeklyPick[]> {
  const week = weekOf(now)
  const cached = readCache()
  if (cached?.week === week && cached.items.length >= MIN_PICKS) return cached.items
  try {
    const items = cleanPicks(await getTrendingWeek())
    if (items.length >= MIN_PICKS) {
      try {
        localStorage.setItem(KEY, JSON.stringify({ week, items }))
      } catch {
        // Storage full: fetched again next time
      }
      return items
    }
  } catch {
    // Offline or the server is down: fall through
  }
  return cached?.items.length ? cached.items : []
}
