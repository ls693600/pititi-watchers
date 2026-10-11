export type WatchStatus = 'watching' | 'done'

/** A family member. Has a login once they've created an account (userId set). */
export interface Person {
  id: string
  name: string
  userId: string | null
  isAdmin: boolean
  /** Sees everything and can chat, but can't add, rate or change shows (joined with the viewer invite) */
  isViewer?: boolean
}

/** One show-season logged in a given month. A show lands in the month you last watched it. */
export interface Watch {
  id: string
  showId: number
  showName: string
  poster: string | null
  network: string | null
  genres: string[]
  year: string | null
  season: number
  episodesWatched: number
  totalEpisodes: number | null
  runtime: number | null
  /** YYYY-MM */
  month: string
  status: WatchStatus
  /** Person ids who watched it */
  watchedBy: string[]
  /** Stars (1–5) by person id */
  ratings: Record<string, number>
  isRewatch: boolean
  notes: string
  /**
   * Episodes watched in each month (YYYY-MM → count), so a show watched across several months
   * counts in each of them. Older logs may not have it: then everything counts in `month`.
   */
  episodesByMonth?: Record<string, number>
  /** Person who added it; null for older logs. Only they or the admin can delete it. */
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

/** A show the family wants to watch, with hearts. */
export interface UpNextItem {
  id: string
  showId: number
  showName: string
  poster: string | null
  network: string | null
  genres: string[]
  year: string | null
  runtime: number | null
  addedBy: string | null
  /** Person ids who want to watch it */
  wantedBy: string[]
  createdAt: string
}

/** One person's emoji on someone else's rating. One per person per rating; tapping another replaces it. */
export interface Reaction {
  watchId: string
  /** Who reacted */
  personId: string
  /** Whose rating it's on */
  targetId: string
  emoji: string
}

/** A line in a show's family chat. */
export interface Comment {
  id: string
  /** The show it's about; null for the Family chat (anything, not tied to a show) */
  watchId: string | null
  personId: string
  text: string
  createdAt: string
}
