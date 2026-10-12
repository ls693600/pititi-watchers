// Movies come from TMDB through our own server function, so the TMDB key never ships in the app.
import type { Title } from './types'

// The function is public (no login needed); same project as the app's sync
const FN = 'https://pnazcanolltupqydemri.supabase.co/functions/v1/tmdb'

export interface MovieResult extends Title {
  overview: string | null
  rating: number | null
}

export interface MovieInfo extends MovieResult {
  backdrop: string | null
  tagline: string | null
  /** Where to watch in your country: streaming first, then rent */
  providers: { name: string; how: 'stream' | 'rent' }[]
  link: string
}

/** Thrown when the TMDB key hasn't been added yet, so search can say so instead of "no results". */
export class MoviesNotReady extends Error {}

const lang = () => (localStorage.getItem('pititi.lang') === 'pt' ? 'pt' : 'en')
const region = () => (navigator.language.split('-')[1] ?? 'CA').toUpperCase()

async function call<T>(params: Record<string, string>, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${FN}?${new URLSearchParams({ ...params, lang: lang() })}`, { signal })
  if (res.status === 503 || res.status === 404) throw new MoviesNotReady('Movies are not set up yet')
  if (!res.ok) throw new Error(`Movies ${res.status}`)
  return res.json() as Promise<T>
}

type Raw = { id: number; title: string; year: string | null; poster: string | null; genres: string[]; overview: string | null; rating: number | null }
const toResult = (m: Raw): MovieResult => ({
  kind: 'movie',
  extId: m.id,
  title: m.title,
  poster: m.poster,
  year: m.year,
  genres: m.genres,
  runtime: null,
  network: null,
  overview: m.overview,
  rating: m.rating,
})

export async function searchMovies(q: string, signal?: AbortSignal): Promise<MovieResult[]> {
  return (await call<Raw[]>({ q }, signal)).map(toResult)
}

const memo = new Map<number, Promise<MovieInfo>>()

/** Movie details (runtime, overview, where to watch), cached for the session. */
export function getMovie(id: number): Promise<MovieInfo> {
  const hit = memo.get(id)
  if (hit) return hit
  const p = call<Raw & { runtime: number | null; backdrop: string | null; tagline: string | null; providers: MovieInfo['providers']; link: string }>({
    id: String(id),
    region: region(),
  }).then((m) => ({ ...toResult(m), runtime: m.runtime, backdrop: m.backdrop, tagline: m.tagline, providers: m.providers, link: m.link }))
  p.catch(() => memo.delete(id))
  memo.set(id, p)
  return p
}
