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
  /** TVmaze season id, used to load its episodes */
  id?: number
  number: number
  episodes: number | null
  /** False for announced seasons that haven't premiered yet */
  aired: boolean
  /** Premiered but more episodes still to come */
  inProgress?: boolean
  /** Episodes released so far, when the season is in progress (filled in by getAiredCount) */
  airedEpisodes?: number | null
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
  const rows = await get<{ id: number; number: number; episodeOrder: number | null; premiereDate: string | null; endDate: string | null }[]>(
    `/shows/${showId}/seasons`,
  )
  const today = new Date().toISOString().slice(0, 10)
  return rows
    .filter((s) => s.number > 0)
    .map((s) => ({
      id: s.id,
      number: s.number,
      episodes: s.episodeOrder,
      aired: Boolean(s.premiereDate && s.premiereDate <= today),
      inProgress: Boolean(s.premiereDate && s.premiereDate <= today && (!s.endDate || s.endDate > today)),
    }))
}

/** How many episodes of a season have aired by today. */
export async function getAiredCount(seasonId: number): Promise<number> {
  const today = new Date().toISOString().slice(0, 10)
  const eps = await getEpisodes(seasonId)
  return eps.filter((e) => e.airdate != null && e.airdate <= today).length
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

export interface ShowInfo {
  summary: string | null
  rating: number | null
  status: string | null
  runtime: number | null
  nextEpisode: { season: number; number: number; name: string; airdate: string } | null
}

export interface EpisodeInfo {
  number: number
  name: string
  airdate: string | null
}

/** Plain text from TVmaze's HTML summary. */
export function plainText(html: string | null | undefined): string | null {
  if (!html) return null
  const text = html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim()
  return text || null
}

const INFO_KEY = 'pititi.showinfo.v1'
const INFO_TTL = 6 * 60 * 60 * 1000
const infoMemo = new Map<number, Promise<ShowInfo>>()

/** Show info with a 6-hour cache (memory + phone storage), so Home doesn't refetch on every open. */
export function getShowInfoCached(showId: number): Promise<ShowInfo> {
  const memo = infoMemo.get(showId)
  if (memo) return memo
  let stored: Record<string, { at: number; info: ShowInfo }> = {}
  try {
    stored = JSON.parse(localStorage.getItem(INFO_KEY) || '{}')
  } catch {
    stored = {}
  }
  const hit = stored[showId]
  if (hit && Date.now() - hit.at < INFO_TTL) {
    const p = Promise.resolve(hit.info)
    infoMemo.set(showId, p)
    return p
  }
  const p = getShowInfo(showId).then((info) => {
    try {
      const all = JSON.parse(localStorage.getItem(INFO_KEY) || '{}')
      all[showId] = { at: Date.now(), info }
      localStorage.setItem(INFO_KEY, JSON.stringify(all))
    } catch {
      // Cache is a nice-to-have
    }
    return info
  })
  p.catch(() => infoMemo.delete(showId))
  infoMemo.set(showId, p)
  return p
}

export async function getShowInfo(showId: number): Promise<ShowInfo> {
  const s = await get<{
    summary: string | null
    rating?: { average: number | null }
    status?: string
    averageRuntime?: number | null
    runtime?: number | null
    _embedded?: { nextepisode?: { season: number; number: number; name: string; airdate: string } }
  }>(`/shows/${showId}?embed=nextepisode`)
  const n = s._embedded?.nextepisode
  return {
    summary: plainText(s.summary),
    rating: s.rating?.average ?? null,
    status: s.status ?? null,
    runtime: s.averageRuntime ?? s.runtime ?? null,
    nextEpisode: n ? { season: n.season, number: n.number, name: n.name, airdate: n.airdate } : null,
  }
}

/** Regular episodes of a season (specials have no number and are left out). */
export async function getEpisodes(seasonId: number): Promise<EpisodeInfo[]> {
  const rows = await get<{ number: number | null; name: string; airdate: string | null }[]>(`/seasons/${seasonId}/episodes`)
  return rows.filter((e) => e.number != null).map((e) => ({ number: e.number!, name: e.name, airdate: e.airdate || null }))
}

const CACHE_KEY = 'pititi.tvcache.v1'
const CACHE_TTL = 6 * 60 * 60 * 1000
const memo = new Map<string, Promise<unknown>>()

/** Runs a TVmaze lookup at most every 6 hours per key (memory + phone storage). */
function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = memo.get(key)
  if (hit) return hit as Promise<T>
  try {
    const stored = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')[key]
    if (stored && Date.now() - stored.at < CACHE_TTL) {
      const p = Promise.resolve(stored.value as T)
      memo.set(key, p)
      return p
    }
  } catch {
    // Unreadable cache: just fetch
  }
  const p = load().then((value) => {
    try {
      const all = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
      all[key] = { at: Date.now(), value }
      localStorage.setItem(CACHE_KEY, JSON.stringify(all))
    } catch {
      // Cache is a nice-to-have
    }
    return value
  })
  p.catch(() => memo.delete(key))
  memo.set(key, p)
  return p
}

/** Air dates of a show-season's episodes, for telling new episodes from old ones. */
export function getSeasonEpisodesCached(showId: number, season: number): Promise<EpisodeInfo[] | null> {
  return cached(`eps:${showId}:${season}`, async () => {
    const seasons = await getSeasons(showId)
    const s = seasons.find((x) => x.number === season)
    return s?.id ? getEpisodes(s.id) : null
  })
}
