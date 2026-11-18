// "On this day": a small look back at what your own household watched a year ago (or 6 months, or a month).
// Pure: everything comes in, nothing is read from the phone or the network.
import { localDay } from './lib/dates'
import { householdWatches } from './logic'
import type { CouchPhoto, EpisodeReaction, Person, Watch } from './types'

export type Anchor = '1y' | '6m' | '1m'
export type MemoryKind = 'photo' | 'finished' | 'started' | 'reaction'

export interface Memory {
  kind: MemoryKind
  /** The household's log it opens */
  watch: Watch
  photo?: CouchPhoto
  reaction?: EpisodeReaction
}

export interface Memories {
  anchor: Anchor
  /** YYYY-MM-DD */
  date: string
  items: Memory[]
}

/** How many memories the card shows at most. */
export const MAX_MEMORIES = 5
const ANCHORS: [Anchor, number][] = [
  ['1y', 12],
  ['6m', 6],
  ['1m', 1],
]
const RANK: Record<MemoryKind, number> = { photo: 0, finished: 1, started: 2, reaction: 3 }

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * The same day some months earlier (YYYY-MM-DD). A day the earlier month doesn't have lands on its last day:
 * Mar 31 one month back is Feb 28 (Feb 29 in a leap year); Feb 29 a year back is Feb 28.
 */
export function monthsBefore(day: string, months: number): string {
  const [y, m, d] = day.split('-').map(Number)
  const index = y * 12 + (m - 1) - months
  const year = Math.floor(index / 12)
  const month = index - year * 12
  const last = new Date(year, month + 1, 0).getDate()
  return `${year}-${pad(month + 1)}-${pad(Math.min(d, last))}`
}

/** The phone's calendar date of a stored timestamp (ISO, UTC). */
function dayOf(iso: string): string | null {
  const ms = Date.parse(iso)
  return Number.isNaN(ms) ? null : localDay(ms)
}

function memoriesOn(date: string, logs: Watch[], photos: CouchPhoto[], reactions: EpisodeReaction[], ours: Set<string>): Memory[] {
  const byId = new Map(logs.map((w) => [w.id, w]))
  const found: Memory[] = []
  for (const p of [...photos].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const watch = p.night === date ? byId.get(p.watchId) : undefined
    if (watch) found.push({ kind: 'photo', watch, photo: p })
  }
  for (const w of logs) {
    if (w.status === 'done' && dayOf(w.updatedAt) === date) found.push({ kind: 'finished', watch: w })
    if (dayOf(w.createdAt) === date) found.push({ kind: 'started', watch: w })
  }
  for (const r of [...reactions].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    if (!ours.has(r.personId) || dayOf(r.createdAt) !== date) continue
    // The household's log of that show: the reacted season, or else its latest one
    const shows = logs.filter((w) => w.showId === r.showId && (w.kind ?? 'tv') === r.kind)
    const watch = shows.find((w) => w.season === r.season) ?? [...shows].sort((a, b) => b.season - a.season)[0]
    if (watch) found.push({ kind: 'reaction', watch, reaction: r })
  }
  // One memory per log, the best kind first (a photo beats "finished", which beats "started"...)
  const seen = new Set<string>()
  return found
    .map((m, i) => ({ m, i }))
    .sort((a, b) => RANK[a.m.kind] - RANK[b.m.kind] || a.i - b.i)
    .map(({ m }) => m)
    .filter((m) => (seen.has(m.watch.id) ? false : (seen.add(m.watch.id), true)))
    .slice(0, MAX_MEMORIES)
}

/**
 * Your household's memories from exactly a year ago today; when that day is empty, 6 months ago; then a month ago.
 * Null when there's nothing (or no household): then there's no card at all.
 */
export function memoriesFor({
  watches,
  photos,
  episodeReactions,
  people,
  household,
  today,
}: {
  watches: Watch[]
  photos: CouchPhoto[]
  episodeReactions: EpisodeReaction[]
  people: Person[]
  household: string | null | undefined
  /** YYYY-MM-DD, the phone's date */
  today: string
}): Memories | null {
  if (!household) return null
  const logs = householdWatches(watches, household)
  const ours = new Set(people.filter((p) => p.householdId === household).map((p) => p.id))
  for (const [anchor, months] of ANCHORS) {
    const date = monthsBefore(today, months)
    const items = memoriesOn(date, logs, photos, episodeReactions, ours)
    if (items.length) return { anchor, date, items }
  }
  return null
}
