import { kindOf } from './logic'
import type { ListItem, Watch, WatchList } from './types'

/** The time choices, in minutes ("All night" = no limit, capped at a sensible binge) */
export const TIME_CHOICES = [30, 60, 120, 240] as const
/** Episode length when the show doesn't say */
const DEFAULT_EPISODE = 45
/** At most this many episodes in one suggestion */
const MAX_EPISODES = 6

export type TimeFit =
  | { type: 'episodes'; watch: Watch; count: number; from: number; to: number; minutes: number }
  | { type: 'movie'; item: ListItem; minutes: number }

/**
 * What fits in the time you have: the next episodes of shows you're in the middle of (most recent first), then
 * movies from your household's lists that fit (longest that still fits first, so the evening is used well).
 * Never something you already watched, never more episodes than the season has.
 */
export function whatFits(minutes: number, input: { watching: Watch[]; lists: WatchList[]; items: ListItem[]; household: string | null; watches: Watch[] }): TimeFit[] {
  const shows: TimeFit[] = input.watching
    .filter((w) => kindOf(w) === 'tv' && w.status === 'watching')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .flatMap((w): TimeFit[] => {
      const each = w.runtime && w.runtime > 0 ? w.runtime : DEFAULT_EPISODE
      const left = w.totalEpisodes != null ? w.totalEpisodes - w.episodesWatched : MAX_EPISODES
      const count = Math.min(Math.floor(minutes / each), left, MAX_EPISODES)
      if (count < 1) return []
      return [{ type: 'episodes', watch: w, count, from: w.episodesWatched + 1, to: w.episodesWatched + count, minutes: count * each }]
    })
  const ours = new Set(input.lists.filter((l) => l.householdId === input.household).map((l) => l.id))
  const watched = new Set(input.watches.filter((w) => (w.householdId ?? null) === input.household).map((w) => `${kindOf(w)}:${w.showId}`))
  const seen = new Set<number>()
  const movies: TimeFit[] = input.items
    .filter((i) => ours.has(i.listId) && i.kind === 'movie' && i.runtime != null && i.runtime <= minutes && !watched.has(`movie:${i.extId}`))
    .filter((i) => (seen.has(i.extId) ? false : (seen.add(i.extId), true)))
    .sort((a, b) => (b.runtime ?? 0) - (a.runtime ?? 0) || b.votes.length - a.votes.length)
    .map((item) => ({ type: 'movie', item, minutes: item.runtime! }))
  return [...shows, ...movies]
}

/** "1h 40m" / "45 min" */
export function durationLabel(minutes: number): string {
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ''}` : `${minutes} min`
}
