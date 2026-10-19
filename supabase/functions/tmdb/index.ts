// Pititi Watchers movie data (Supabase Edge Function "tmdb").
// Proxies TMDB so the API key stays a server secret. GET ?q=search text  |  GET ?id=123&region=CA
// GET ?trailer=movie&id=TMDB_ID  |  GET ?trailer=tv&id=TVMAZE_ID&season=2  → { key, name } (YouTube) or { key: null }
const TOKEN = Deno.env.get('TMDB_TOKEN') ?? '' // v4 "API Read Access Token"
const KEY = Deno.env.get('TMDB_KEY') ?? '' // or the v3 "API Key"
const IMG = 'https://image.tmdb.org/t/p/'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

const GENRES: Record<number, string> = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime', 99: 'Documentary', 18: 'Drama', 10751: 'Family',
  14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Science-Fiction',
  10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western',
}

async function tmdb(path: string, params: Record<string, string> = {}) {
  const url = new URL(`https://api.themoviedb.org/3${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  if (!TOKEN && KEY) url.searchParams.set('api_key', KEY)
  const res = await fetch(url, { headers: TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {} })
  if (!res.ok) throw new Error(`tmdb ${res.status}`)
  return res.json()
}

type Video = { key: string; name: string; site: string; type: string; official?: boolean; iso_639_1?: string | null; published_at?: string }

/** Best YouTube trailer: your language first, then official, then newest; teasers only if there's no trailer. */
export function pickTrailer(videos: Video[], lang: 'pt' | 'en'): Video | null {
  const yt = videos.filter((v) => v.site === 'YouTube' && v.key)
  const score = (v: Video) =>
    (v.type === 'Trailer' ? 100 : v.type === 'Teaser' ? 50 : 0) + (v.iso_639_1 === lang ? 20 : v.iso_639_1 === 'en' ? 10 : 0) + (v.official ? 5 : 0)
  const ranked = yt
    .filter((v) => v.type === 'Trailer' || v.type === 'Teaser')
    .sort((a, b) => score(b) - score(a) || String(b.published_at ?? '').localeCompare(String(a.published_at ?? '')))
  return ranked[0] ?? null
}

async function videosOf(path: string, lang: 'pt' | 'en'): Promise<Video[]> {
  const r = await tmdb(`${path}/videos`, { include_video_language: `${lang},en,null` }).catch(() => null)
  return (r?.results as Video[]) ?? []
}

/** TVmaze ids (the app's shows) → TMDB tv id, through IMDb, then TheTVDB, then name + year. */
async function tvIdFromTvmaze(tvmazeId: number): Promise<number | null> {
  const res = await fetch(`https://api.tvmaze.com/shows/${tvmazeId}`)
  if (!res.ok) return null
  const s = await res.json()
  const ext = s.externals ?? {}
  for (const [id, source] of [[ext.imdb, 'imdb_id'], [ext.thetvdb, 'tvdb_id']] as const) {
    if (!id) continue
    const f = await tmdb(`/find/${id}`, { external_source: source }).catch(() => null)
    if (f?.tv_results?.[0]?.id) return f.tv_results[0].id
  }
  const year = typeof s.premiered === 'string' ? s.premiered.slice(0, 4) : ''
  const r = await tmdb('/search/tv', { query: String(s.name ?? '').slice(0, 100), ...(year ? { first_air_date_year: year } : {}) }).catch(() => null)
  return r?.results?.[0]?.id ?? null
}

async function trailer(kind: string, id: number, season: number, lang: 'pt' | 'en'): Promise<Video | null> {
  if (kind === 'movie') return pickTrailer(await videosOf(`/movie/${id}`, lang), lang)
  const tv = await tvIdFromTvmaze(id)
  if (!tv) return null
  // Your season's trailer when there is one, otherwise the show's
  const bySeason = season > 0 ? pickTrailer(await videosOf(`/tv/${tv}/season/${season}`, lang), lang) : null
  return bySeason ?? pickTrailer(await videosOf(`/tv/${tv}`, lang), lang)
}

const json = (body: unknown, status = 200, cache = 'public, max-age=3600') =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': cache } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (!TOKEN && !KEY) return json({ error: 'not_configured' }, 503, 'no-store')
  const u = new URL(req.url)
  const lang = u.searchParams.get('lang') === 'pt' ? 'pt-BR' : 'en-US'
  try {
    const kind = u.searchParams.get('trailer')
    if (kind === 'movie' || kind === 'tv') {
      const id = Number(u.searchParams.get('id'))
      if (!(id > 0)) return json({ error: 'bad_request' }, 400, 'no-store')
      const v = await trailer(kind, id, Number(u.searchParams.get('season')) || 0, lang === 'pt-BR' ? 'pt' : 'en')
      // "None" is re-checked sooner: TMDB adds trailers for new seasons
      return json(v ? { key: v.key, name: v.name } : { key: null }, 200, v ? 'public, max-age=86400' : 'public, max-age=3600')
    }
    const q = u.searchParams.get('q')?.trim()
    if (q) {
      const r = await tmdb('/search/movie', { query: q.slice(0, 100), include_adult: 'false', language: lang })
      return json(
        (r.results ?? []).slice(0, 15).map((m: Record<string, unknown>) => ({
          id: m.id,
          title: m.title,
          year: typeof m.release_date === 'string' && m.release_date ? m.release_date.slice(0, 4) : null,
          poster: m.poster_path ? `${IMG}w342${m.poster_path}` : null,
          genres: ((m.genre_ids as number[]) ?? []).map((g) => GENRES[g]).filter(Boolean),
          overview: m.overview || null,
          rating: typeof m.vote_average === 'number' && m.vote_count ? Math.round((m.vote_average as number) * 10) / 10 : null,
        })),
      )
    }
    const id = Number(u.searchParams.get('id'))
    if (id > 0) {
      const region = (u.searchParams.get('region') ?? 'CA').toUpperCase().slice(0, 2)
      const [m, p] = await Promise.all([tmdb(`/movie/${id}`, { language: lang }), tmdb(`/movie/${id}/watch/providers`).catch(() => null)])
      const where = p?.results?.[region] ?? p?.results?.US ?? null
      return json({
        id: m.id,
        title: m.title,
        year: m.release_date ? String(m.release_date).slice(0, 4) : null,
        poster: m.poster_path ? `${IMG}w342${m.poster_path}` : null,
        backdrop: m.backdrop_path ? `${IMG}w780${m.backdrop_path}` : null,
        genres: (m.genres ?? []).map((g: { name: string }) => g.name),
        runtime: m.runtime || null,
        overview: m.overview || null,
        rating: m.vote_count ? Math.round(m.vote_average * 10) / 10 : null,
        tagline: m.tagline || null,
        // Streaming (included in a subscription) first, then rent/buy
        providers: [
          ...(where?.flatrate ?? []).map((x: { provider_name: string }) => ({ name: x.provider_name, how: 'stream' })),
          ...(where?.rent ?? []).slice(0, 2).map((x: { provider_name: string }) => ({ name: x.provider_name, how: 'rent' })),
        ].slice(0, 4),
        link: where?.link ?? `https://www.themoviedb.org/movie/${m.id}`,
      })
    }
    return json({ error: 'bad_request' }, 400, 'no-store')
  } catch (e) {
    console.error(e)
    return json({ error: 'upstream' }, 502, 'no-store')
  }
})
