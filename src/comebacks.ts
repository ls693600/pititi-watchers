// "It's back": news about shows the household finished — a new season out, a premiere date, a renewal, or the end.
import { kindOf } from './logic'
import type { SeasonInfo } from './tvmaze'
import type { Watch } from './types'

/** What TVmaze says about a show right now */
export interface ShowNews {
  status: string | null
  /** YYYY-MM-DD the last episode aired, when the show has ended */
  ended: string | null
  seasons: SeasonInfo[]
}

export type ComebackType = 'out' | 'dated' | 'renewed' | 'ended'

export interface Comeback {
  type: ComebackType
  /** The household's latest log of the show (opens it; a new season starts from it) */
  head: Watch
  /** The season the news is about (for 'ended': the last one) */
  season: number
  /** Premiere date ('out', 'dated') */
  date: string | null
  /** The season to start in one tap ('out': the first one you haven't seen) */
  info: SeasonInfo | null
  /** Seen once dismissed: changes when the news moves on (renewed → dated → out) */
  key: string
}

/** A new season counts as news for this long after it premieres */
export const OUT_DAYS = 90
/** "It's over" is news for this long after the last episode */
export const ENDED_DAYS = 120
/** How many finished shows are checked (most recent first) */
export const MAX_SHOWS = 40

const days = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000)

/** Series the household finished: their latest season is done and nothing of it is in progress. Most recent first. */
export function finishedShows(watches: Watch[]): Watch[] {
  const byShow = new Map<string, Watch[]>()
  for (const w of watches) {
    if (kindOf(w) !== 'tv') continue
    const k = `${w.householdId ?? ''}:${w.showId}`
    byShow.set(k, [...(byShow.get(k) ?? []), w])
  }
  const heads: Watch[] = []
  for (const logs of byShow.values()) {
    if (logs.some((w) => w.status === 'watching')) continue
    heads.push(logs.reduce((a, b) => (b.season > a.season || (b.season === a.season && b.updatedAt > a.updatedAt) ? b : a)))
  }
  return heads.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, MAX_SHOWS)
}

/** The one piece of news worth telling about a finished show, or null. */
export function comebackFor(head: Watch, news: ShowNews, today: string): Comeback | null {
  const newer = news.seasons.filter((s) => s.number > head.season).sort((a, b) => a.number - b.number)
  const make = (type: ComebackType, season: number, date: string | null, info: SeasonInfo | null): Comeback => ({
    type, head, season, date, info, key: `${head.showId}:${type}:${season}`,
  })
  // The newest season out, if it premiered recently (an old one you never got to isn't news). You start from the first you haven't seen.
  const aired = newer.filter((s) => s.premiereDate && s.premiereDate <= today)
  const latest = aired[aired.length - 1]
  if (latest) return days(latest.premiereDate!, today) <= OUT_DAYS ? make('out', latest.number, latest.premiereDate!, aired[0]) : null
  const next = newer[0]
  if (next?.premiereDate) return make('dated', next.number, next.premiereDate, next)
  if (next) return make('renewed', next.number, null, next)
  if (news.status === 'Ended' && news.ended && days(news.ended, today) >= 0 && days(news.ended, today) <= ENDED_DAYS) return make('ended', head.season, news.ended, null)
  return null
}

/** Order on Home: out now, then the soonest dates, then renewals, then endings. */
export function comebackOrder(a: Comeback, b: Comeback): number {
  const rank: Record<ComebackType, number> = { out: 0, dated: 1, renewed: 2, ended: 3 }
  if (rank[a.type] !== rank[b.type]) return rank[a.type] - rank[b.type]
  if (a.type === 'out') return (b.date ?? '').localeCompare(a.date ?? '')
  if (a.type === 'dated') return (a.date ?? '').localeCompare(b.date ?? '')
  return b.head.updatedAt.localeCompare(a.head.updatedAt)
}

const NEWS_KEY = 'pititi.shownews.v1'
const DAY = 86_400_000

/** Show status and seasons from TVmaze, kept a day on this phone (two weeks for shows long over). */
export async function getShowNews(showId: number, now = Date.now()): Promise<ShowNews> {
  let all: Record<string, { at: number; news: ShowNews }> = {}
  try {
    all = JSON.parse(localStorage.getItem(NEWS_KEY) || '{}')
  } catch {
    all = {}
  }
  const hit = all[showId]
  const longOver = hit?.news.status === 'Ended' && hit.news.ended && now - Date.parse(hit.news.ended) > 365 * DAY
  if (hit && now - hit.at < (longOver ? 14 * DAY : DAY)) return hit.news
  const res = await fetch(`https://api.tvmaze.com/shows/${showId}?embed=seasons`)
  if (!res.ok) throw new Error(`TVmaze ${res.status}`)
  const s = await res.json()
  const today = new Date(now).toISOString().slice(0, 10)
  const seasons: SeasonInfo[] = ((s._embedded?.seasons ?? []) as { id: number; number: number; episodeOrder: number | null; premiereDate: string | null; endDate: string | null }[])
    .filter((x) => x.number > 0)
    .map((x) => ({
      id: x.id,
      number: x.number,
      episodes: x.episodeOrder,
      aired: Boolean(x.premiereDate && x.premiereDate <= today),
      inProgress: Boolean(x.premiereDate && x.premiereDate <= today && (!x.endDate || x.endDate > today)),
      premiereDate: x.premiereDate,
    }))
  const news: ShowNews = { status: s.status ?? null, ended: s.ended ?? null, seasons }
  try {
    const fresh = JSON.parse(localStorage.getItem(NEWS_KEY) || '{}')
    fresh[showId] = { at: now, news }
    localStorage.setItem(NEWS_KEY, JSON.stringify(fresh))
  } catch {
    // Cache is a nice-to-have
  }
  return news
}

const SEEN_KEY = 'pititi.comebacks.seen.v1'

export function seenComebacks(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'))
  } catch {
    return new Set()
  }
}

export function markComebackSeen(key: string) {
  try {
    const seen = seenComebacks()
    seen.add(key)
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-300)))
  } catch {
    // Shows again next time: harmless
  }
}
