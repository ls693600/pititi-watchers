export type WatchStatus = 'watching' | 'done'

/** A family member. Has a login once they've created an account (userId set). */
export interface Person {
  id: string
  name: string
  userId: string | null
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
  createdAt: string
  updatedAt: string
}
