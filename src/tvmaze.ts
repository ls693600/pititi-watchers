// TVmaze public API — free, no key. https://www.tvmaze.com/api
const BASE = 'https://api.tvmaze.com'

export interface ShowResult {
  showId: number
  showName: string
  poster: string | null
  network: string | null
  genres: string[]
  year: string | null
  runtime: number | null
}

export interface SeasonInfo {
  number: number
  episodes: number | null
  /** False for announced seasons that haven't premiered yet */
  aired: boolean
}

interface RawShow {
  id: number
  name: string
  image?: { medium?: string; original?: string } | null
  network?: { name: string } | null
  webChannel?: { name: string } | null
  genres?: string[]
  premiered?: string | null
  averageRuntime?: number | null
  runtime?: number | null
}

function toShow(s: RawShow): ShowResult {
  return {
    showId: s.id,
    showName: s.name,
    poster: (s.image?.medium ?? s.image?.original ?? null)?.replace('http://', 'https://') ?? null,
    network: s.network?.name ?? s.webChannel?.name ?? null,
    genres: s.genres ?? [],
    year: s.premiered ? s.premiered.slice(0, 4) : null,
    runtime: s.averageRuntime ?? s.runtime ?? null,
  }
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { signal })
  if (!res.ok) throw new Error(`TVmaze ${res.status}`)
  return res.json() as Promise<T>
}

export async function searchShows(query: string, signal?: AbortSignal): Promise<ShowResult[]> {
  const q = query.trim()
  if (!q) return []
  const rows = await get<{ show: RawShow }[]>(`/search/shows?q=${encodeURIComponent(q)}`, signal)
  return rows.map((r) => toShow(r.show))
}

export async function getSeasons(showId: number): Promise<SeasonInfo[]> {
  const rows = await get<{ number: number; episodeOrder: number | null; premiereDate: string | null }[]>(
    `/shows/${showId}/seasons`,
  )
  const today = new Date().toISOString().slice(0, 10)
  return rows
    .filter((s) => s.number > 0)
    .map((s) => ({
      number: s.number,
      episodes: s.episodeOrder,
      aired: Boolean(s.premiereDate && s.premiereDate <= today),
    }))
}

/** A wall of well-known posters for the sign-in screen. Empty if TVmaze is unreachable. */
export async function popularPosters(count = 16): Promise<string[]> {
  const rows = await get<(RawShow & { weight?: number })[]>('/shows?page=1')
  return rows
    .filter((s) => s.image?.medium)
    .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
    .slice(0, count)
    .map((s) => s.image!.medium!.replace('http://', 'https://'))
}

/** Poster at full resolution (search returns the small one). */
export function bigPoster(src: string | null): string | null {
  return src ? src.replace('/medium_portrait/', '/original_untouched/') : null
}
