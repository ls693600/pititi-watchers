import { kindOf } from './logic'
import type { Kind, ListItem, MovieNight, NightTitle, NightVote, Title, Watch, WatchList } from './types'

/** A movie night lasts this long; after that it's history */
export const NIGHT_HOURS = 6
/** Posters per night */
export const NIGHT_SIZE = 15
/** "Short" = under this many minutes (movies) */
export const SHORT_MINUTES = 100

export const titleRef = (t: Pick<Title, 'kind' | 'extId'>) => `${t.kind}:${t.extId}`

export interface PoolOptions {
  kind: Kind | 'both'
  short: boolean
  sources: { list: boolean; forus: boolean; week: boolean }
}

/**
 * The posters for a new night: your household's lists first (things you already wanted), then For us, then Trending.
 * Nothing your household already watched, no duplicates, the right kind and length; then shuffled so nobody can
 * predict the order. `random` is injectable for tests.
 */
export function buildPool(
  input: { lists: WatchList[]; items: ListItem[]; household: string | null; forus: NightTitle[]; week: NightTitle[]; watches: Watch[] },
  opts: PoolOptions,
  random: () => number = Math.random,
): NightTitle[] {
  const watched = new Set(input.watches.filter((w) => (w.householdId ?? null) === input.household).map((w) => `${kindOf(w)}:${w.showId}`))
  const ours = new Set(input.lists.filter((l) => l.householdId === input.household).map((l) => l.id))
  const fromLists: NightTitle[] = input.items.filter((i) => ours.has(i.listId)).map((i) => ({ kind: i.kind, extId: i.extId, title: i.title, poster: i.poster, year: i.year, genres: i.genres, runtime: i.runtime, network: i.network, from: 'list' }))
  const all = [
    ...(opts.sources.list ? fromLists : []),
    ...(opts.sources.forus ? input.forus.map((t) => ({ ...t, from: 'forus' as const })) : []),
    ...(opts.sources.week ? input.week.map((t) => ({ ...t, from: 'week' as const })) : []),
  ]
  const seen = new Set<string>()
  const fits = all.filter((t) => {
    const ref = titleRef(t)
    if (seen.has(ref) || watched.has(ref)) return false
    seen.add(ref)
    if (opts.kind !== 'both' && t.kind !== opts.kind) return false
    if (opts.short && (t.kind !== 'movie' || t.runtime == null || t.runtime >= SHORT_MINUTES)) return false
    return true
  })
  // Lists keep priority: take up to NIGHT_SIZE, lists first, then shuffle the chosen ones
  const chosen = fits.slice(0, NIGHT_SIZE)
  for (let i = chosen.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[chosen[i], chosen[j]] = [chosen[j], chosen[i]]
  }
  return chosen
}

export interface NightState {
  /** Titles you haven't voted on yet, in order */
  todo: NightTitle[]
  /** Titles everyone said yes to, in the night's order */
  matches: NightTitle[]
  /** Who still has posters left (by person id) */
  waitingOn: string[]
  /** Everyone voted on everything */
  finished: boolean
}

/** Where a night stands for you. `members`: the household's people who swipe (everyone but viewers). */
export function nightState(night: MovieNight, votes: NightVote[], me: string, members: string[]): NightState {
  const mine = votes.filter((v) => v.nightId === night.id)
  const voted = (person: string, ref: string) => mine.some((v) => v.personId === person && v.ref === ref)
  const todo = night.titles.filter((t) => !voted(me, titleRef(t)))
  // A match needs a yes from every member (you only ever see others' votes on titles you voted on, so this is fair)
  const matches = night.titles.filter((t) => members.length > 1 && members.every((p) => mine.some((v) => v.personId === p && v.ref === titleRef(t) && v.yes)))
  const waitingOn = members.filter((p) => p !== me && night.titles.some((t) => !mine.some((v) => v.personId === p && v.ref === titleRef(t))))
  return { todo, matches, waitingOn, finished: todo.length === 0 && waitingOn.length === 0 }
}

/** The household's current night, if one was started in the last few hours. */
export function activeNight(nights: MovieNight[], household: string | null, now = Date.now()): MovieNight | null {
  return (
    nights
      .filter((n) => n.householdId === household && now - Date.parse(n.createdAt) < NIGHT_HOURS * 3_600_000)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
  )
}
