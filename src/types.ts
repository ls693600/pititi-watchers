export type PersonId = 'p1' | 'p2'

export type WatchStatus = 'watching' | 'done'

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
  ratings: Record<PersonId, number | null>
  isRewatch: boolean
  notes: string
  createdAt: string
  updatedAt: string
}

export interface Person {
  id: PersonId
  name: string
}
