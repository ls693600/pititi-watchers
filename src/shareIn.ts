// "Share to Pititi": turns whatever another app shared (a Netflix or IMDb link, "Check out 'The Bear' on Hulu"…)
// into a show or movie. Parsing and matching are pure; the network calls come in through `ShareDeps`.
import type { Kind, Title } from './types'

/** Query params the installed app receives from the phone's share sheet (manifest `share_target`). */
export const SHARE_PARAMS = { title: 'share_title', text: 'share_text', url: 'share_url' } as const

/** What another app shared: any of the three can be missing or empty. */
export interface Shared {
  title?: string | null
  text?: string | null
  url?: string | null
}

/** A direct pointer to a title in a database we can look up by id. */
export type ShareRef =
  | { source: 'tvmaze'; id: number }
  | { source: 'tmdb'; kind: Kind; id: number }
  | { source: 'imdb'; id: string }

export interface ShareLookup {
  ref: ShareRef | null
  /** Best title to search for ('' when nothing usable was shared) */
  query: string
  /** TV or movie, when the link or text says so */
  kind: Kind | null
  /** A year mentioned next to the title ("Dune: Part Two (2024)") */
  year: string | null
}

export type ShareResolution =
  | { status: 'found'; title: Title; alternatives: Title[]; query: string; kind: Kind }
  | { status: 'notfound'; query: string; kind: Kind | null }
  | { status: 'offline'; query: string; kind: Kind | null }

/** The network side of resolving. Lookups by id return null when the title doesn't exist. */
export interface ShareDeps {
  showById: (id: number) => Promise<Title | null>
  showByImdb: (imdbId: string) => Promise<Title | null>
  movieById: (id: number) => Promise<Title | null>
  movieByImdb: (imdbId: string) => Promise<Title | null>
  searchShows: (q: string) => Promise<Title[]>
  searchMovies: (q: string) => Promise<Title[]>
}

/** The shared fields from a page address (`?share_title=…&share_text=…&share_url=…`), or null when nothing was shared. */
export function readShare(search: string): Shared | null {
  const p = new URLSearchParams(search)
  const s: Shared = { title: p.get(SHARE_PARAMS.title), text: p.get(SHARE_PARAMS.text), url: p.get(SHARE_PARAMS.url) }
  return [s.title, s.text, s.url].some((v) => v?.trim()) ? s : null
}

/** The same address without the share params (everything else, like ?as=, stays). */
export function withoutShare(href: string): string {
  const u = new URL(href)
  for (const k of Object.values(SHARE_PARAMS)) u.searchParams.delete(k)
  return u.pathname + u.search + u.hash
}

// Streaming services, stores and databases that show up around a title in shared text
const SERVICES = [
  'Amazon Prime Video', 'Prime Video', 'Amazon Prime', 'Amazon', 'Apple TV\\+', 'Apple TV Plus', 'Apple TV', 'Disney\\+', 'Disney Plus', 'Disney',
  'HBO Max', 'HBO', 'Max', 'Netflix', 'Hulu', 'Paramount\\+', 'Paramount Plus', 'Peacock', 'Globoplay', 'Star\\+', 'YouTube', 'JustWatch',
  'Letterboxd', 'IMDb', 'TMDB', 'TMDb', 'The Movie Database', 'TVmaze', 'TV Maze', 'Crunchyroll', 'MUBI', 'Pluto TV', 'Rotten Tomatoes',
  'Google TV', 'Google Play', 'Claro TV\\+', 'Telecine', 'Looke',
]
const SERVICE = `(?:${SERVICES.join('|')})`
const SERVICE_RE = new RegExp(`\\b${SERVICE}(?=$|[\\s.,!?:;)|/-])`, 'i')

const URL_RE = /\bhttps?:\/\/[^\s<>"'“”‘’]+/gi
const BARE_URL_RE = /\b(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|tv|io|app|be|ly|co|br)(?:\/[^\s]*)?/gi

/** Every link in a piece of text (trailing punctuation trimmed). */
export function findLinks(text: string): string[] {
  return (text.match(URL_RE) ?? []).map((u) => u.replace(/[.,!?;:)\]]+$/, ''))
}

/** Words of a URL slug ("the-bear-05eb6a8e-…" → "the bear"), ids and hashes dropped. */
function slugWords(slug: string | undefined): string {
  if (!slug) return ''
  let s = slug
  try {
    s = decodeURIComponent(slug)
  } catch {
    // Keep the raw slug
  }
  s = s.replace(/\.[a-z]{2,4}$/i, '')
  // Hulu-style trailing uuid, TMDB-style leading id
  s = s.replace(/-?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, '').replace(/^\d+-/, '')
  if (/^(?:umc\.|tt\d|[a-z0-9]{12,})$/i.test(s) && !/[-_]/.test(s)) return ''
  if (/^\d+$/.test(s)) return ''
  return s.replace(/[-_+]+/g, ' ').trim()
}

interface LinkInfo {
  ref: ShareRef | null
  kind: Kind | null
  slug: string
}

/** What a link points to: an id we can look up, whether it's TV or a movie, and the title words in its address. */
export function readLink(link: string): LinkInfo | null {
  let u: URL
  try {
    u = new URL(link)
  } catch {
    return null
  }
  const host = u.hostname.replace(/^(?:www|m|mobile)\./, '').toLowerCase()
  const parts = u.pathname.split('/').filter(Boolean)
  const after = (...names: string[]) => {
    const i = parts.findIndex((p) => names.includes(p.toLowerCase()))
    return i >= 0 ? parts[i + 1] : undefined
  }
  const has = (...names: string[]) => parts.some((p) => names.includes(p.toLowerCase()))

  if (host.endsWith('imdb.com')) {
    const id = u.pathname.match(/\/title\/(tt\d{5,10})/i)?.[1]
    return id ? { ref: { source: 'imdb', id: id.toLowerCase() }, kind: null, slug: '' } : { ref: null, kind: null, slug: '' }
  }
  if (host.endsWith('tvmaze.com')) {
    const i = parts.findIndex((p) => p === 'shows')
    const id = i >= 0 ? Number(parts[i + 1]) : NaN
    return { ref: id > 0 ? { source: 'tvmaze', id } : null, kind: 'tv', slug: i >= 0 ? slugWords(parts[i + 2]) : '' }
  }
  if (host.endsWith('themoviedb.org')) {
    for (const kind of ['movie', 'tv'] as const) {
      const seg = after(kind)
      const id = seg ? Number(seg.match(/^(\d+)/)?.[1]) : NaN
      if (id > 0) return { ref: { source: 'tmdb', kind, id }, kind, slug: slugWords(seg!.replace(/^\d+-?/, '')) }
    }
    return { ref: null, kind: null, slug: '' }
  }
  if (host.endsWith('letterboxd.com')) return { ref: null, kind: 'movie', slug: slugWords(after('film')) }
  if (host.endsWith('justwatch.com'))
    return has('tv-show', 'serie', 'series')
      ? { ref: null, kind: 'tv', slug: slugWords(after('tv-show', 'serie', 'series')) }
      : { ref: null, kind: has('movie', 'filme', 'pelicula') ? 'movie' : null, slug: slugWords(after('movie', 'filme', 'pelicula')) }
  if (host === 'tv.apple.com' || host.endsWith('apple.com'))
    return has('show') ? { ref: null, kind: 'tv', slug: slugWords(after('show')) } : { ref: null, kind: has('movie') ? 'movie' : null, slug: slugWords(after('movie')) }
  if (host.includes('disneyplus') || host.includes('hulu') || host.includes('max.com') || host.includes('hbomax') || host.includes('paramountplus') || host.includes('peacocktv')) {
    if (has('series', 'show', 'shows', 'serie')) return { ref: null, kind: 'tv', slug: slugWords(after('series', 'show', 'shows', 'serie')) }
    if (has('movies', 'movie', 'filme', 'filmes')) return { ref: null, kind: 'movie', slug: slugWords(after('movies', 'movie', 'filme', 'filmes')) }
    return { ref: null, kind: null, slug: '' }
  }
  if (host.includes('primevideo') || host.includes('amazon.')) return { ref: null, kind: null, slug: slugWords(after('detail', 'dp')) }
  // Netflix, YouTube and everything else: no title in the address
  return { ref: null, kind: null, slug: '' }
}

// Words people (and apps) put before the title, in English and Portuguese
const LEADS = [
  'check (?:this|it) out', 'check out', 'you (?:should|have to|need to|gotta|must) (?:watch|see)', 'have you (?:seen|watched)',
  "i'?m (?:currently )?watching", 'i am (?:currently )?watching', 'i (?:just )?(?:watched|finished|started)', 'just (?:watched|finished|started)',
  'now (?:watching|streaming)', 'watching', 'watch(?: now| it| this)?', 'stream(?:ing)?(?: now)?', 'look at', 'loving', 'recommend(?:ing)?', 'new on',
  'estou assistindo', 'tô assistindo', 'to assistindo', 'assistindo', 'assista(?: a| ao| à| aos| às)?', 'assistir(?: a| ao| à)?', 'assisti(?: a| ao| à)?',
  'acabei de (?:assistir|ver|terminar)', 'comecei a (?:assistir|ver)', 'vem (?:assistir|ver)', 'você (?:precisa|tem que) (?:assistir|ver)',
  'voce (?:precisa|tem que) (?:assistir|ver)', 'olha(?: só| so| isso)?', 'confira', 'veja', 'vejam', 'dá uma olhada(?: em| no| na)?',
  'da uma olhada(?: em| no| na)?', 'recomendo', 'where to (?:watch|stream)', 'onde assistir(?: a| ao| à)?', 'novidade(?: na| no)', 'série', 'serie', 'filme', 'the series', 'the movie', 'the film',
]
const LEAD_RE = new RegExp(`^(?:${LEADS.join('|')})(?=\\s|:|$)[\\s:,-]*`, 'i')

// Season and episode markers: the title is whatever comes before them
const EPISODE_RE =
  /(?:^|[\s,:(|·•\-–—])(?:s\d{1,2}\s?e\d{1,3}\b|\d{1,2}x\d{1,3}\b|(?:season|temporada|series|staffel|saison)\s*\d+|\d+(?:st|nd|rd|th|ª|a)?\s+(?:season|temporada)\b|(?:episode|episódio|episodio|ep\.?|cap[ií]tulo)\s*\d+|t\d{1,2}\s?(?:e|ep)\s?\d{1,3}\b|\bt\d{1,2}\b|(?:limited series|minissérie|miniseries)\b)/i

// Trailing pieces that are never part of a title
const JUNK_SEGMENT =
  /^(?:(?:official |oficial )?(?:trailer|teaser)(?: oficial| official)?(?: \d+)?|official site|site oficial|watch (?:online|now|tv shows? online|movies? online)|where to watch.*|.*streaming online.*|.*watch (?:tv show|movie|series) streaming.*|reviews?, film.*|film \+ cast|full (?:movie|episode)s?|assista(?: online)?|trailer legendado|trailer dublado|legendado|dublado|now streaming|streaming now|disponível.*|available now.*|só na.*|so na.*|only on.*|tv series|tv show|series|movie|film|filme|série|serie)$/i

// Store-page endings: "Severance streaming: where to watch online?", "Severance - watch tv show streaming online"
const TAIL_JUNK = [
  /\s*(?:streaming)?\s*[:\-–]?\s*(?:where to watch|onde assistir|dónde ver)\b.*$/i,
  /\s*[-–:]?\s*watch\s+(?:tv show\s+|movie\s+|series\s+)?streaming\s+online.*$/i,
  /\s+[-–:]?\s*(?:assistir|assista)\s+(?:online|série|serie|filme)\b.*$/i,
]

const QUOTE_RE = /(?:^|[\s(:])["“”«‘'](.{1,90}?)["“”»’'](?=$|[\s.,!?:;)])/

/** Strips emoji, URLs and service names, and finds the title in a line someone shared. Returns '' when nothing is left. */
export function extractTitle(raw: string): { title: string; year: string | null; kind: Kind | null } {
  let kind: Kind | null = null
  let year: string | null = null
  let s = raw
    .replace(URL_RE, ' ')
    .replace(BARE_URL_RE, ' ')
    .replace(/\p{Extended_Pictographic}|\u{FE0F}|\u{200D}|\u{20E3}|[\u{1F1E6}-\u{1F1FF}]|[\u{1F3FB}-\u{1F3FF}]/gu, ' ')
    // @accounts aren't titles; #hashtags often are (#Severance)
    .replace(/(?:^|\s)@\w+/g, ' ')
    .replace(/#(?=\w)/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  // A quoted title wins: "Check out 'The Bear' on Hulu"
  // (but not an episode name: Severance S02E01 "Hello, Ms. Cobel")
  const qm = s.match(QUOTE_RE)
  const quoted = qm?.[1]?.trim()
  if (quoted && /\p{L}/u.test(quoted) && !EPISODE_RE.test(s.slice(0, qm!.index! + 1))) s = quoted

  // "(TV Series 2022– )", "(2024)", "(Série de TV 2022)"
  s = s.replace(/\(([^()]*)\)/g, (_, inside: string) => {
    if (/\b(?:tv|série|serie|series|mini)/i.test(inside)) kind = 'tv'
    else if (/\b(?:film|filme|movie)\b/i.test(inside)) kind = 'movie'
    const y = inside.match(/\b(19\d{2}|20\d{2})\b/)?.[1]
    if (y) {
      year = year ?? y
      return ' '
    }
    return /\b(?:tv|série|serie|series|film|filme|movie|trailer|official|oficial|legendado|dublado)\b/i.test(inside) ? ' ' : `(${inside})`
  })
  s = s.replace(/\[[^\]]*\]/g, ' ')

  // "… on Netflix", "… na Apple TV+", "… | Prime Video": everything from the service name on goes
  s = s.replace(new RegExp(`\\s+(?:now\\s+|only\\s+|exclusively\\s+|agora\\s+|só\\s+|so\\s+)?(?:on|in|at|via|from|na|no|em|pela|pelo|do|da|direto\\s+(?:na|no))\\s+(?:the\\s+)?${SERVICE}(?=$|[\\s.,!?:;|/-]).*$`, 'i'), '')

  for (const re of TAIL_JUNK) {
    // Only as an ending: "Where to watch Severance" keeps its title
    const m = s.match(re)
    if (m?.index) s = s.slice(0, m.index)
  }

  // Trailing "| Netflix", "- Official Trailer", "• Letterboxd" pieces, one at a time from the end
  const SEP = /\s+[|\-–—•·:]\s+|\s*[|•·]\s*/
  for (let guard = 0; guard < 8; guard++) {
    const m = [...s.matchAll(new RegExp(SEP.source, 'g'))].pop()
    if (!m || m.index === undefined || m.index === 0) break
    const tail = s.slice(m.index + m[0].length).trim()
    if (!tail || SERVICE_RE.test(tail) || JUNK_SEGMENT.test(tail) || EPISODE_RE.test(` ${tail}`)) s = s.slice(0, m.index).trim()
    else break
  }

  // Season / episode: keep what comes before ("The Bear: Season 3", "Severance S02E01")
  const ep = s.match(EPISODE_RE)
  if (ep && ep.index !== undefined) {
    const before = s.slice(0, ep.index).trim()
    if (/\p{L}/u.test(before)) {
      s = before
      kind = 'tv'
    }
  }

  // Leading "Watch", "Check out", "Assista"… (repeat: "Check this out: Watch Severance")
  for (let guard = 0; guard < 4; guard++) {
    const next = s.replace(LEAD_RE, '').trim()
    if (next === s) break
    s = next
  }
  s = s.replace(/\s+(?:directed by|dirigido por)\s+.*$/i, '')
  s = s.replace(/\s+(?:now|agora|today|hoje|tonight|hoje à noite)$/i, '')
  s = s.replace(/\s+(?:trailer|official trailer|trailer oficial)$/i, '')
  // A service name standing alone ("Netflix") isn't a title
  if (new RegExp(`^${SERVICE}$`, 'i').test(s.trim())) s = ''
  s = s
    .replace(/^[\s"“”«»‘’'.,:;!?|\-–—•·]+|[\s"“”«»‘’'.,:;!?|\-–—•·]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!/\p{L}|\d/u.test(s)) s = ''
  return { title: s.slice(0, 120), year, kind }
}

/** Reads what was shared into something we can look up. */
export function parseShare(shared: Shared): ShareLookup {
  const fields = [shared.url, shared.text, shared.title].map((v) => (v ?? '').trim())
  const links = fields.flatMap((f) => findLinks(f))
  let ref: ShareRef | null = null
  let kind: Kind | null = null
  let slug = ''
  for (const l of links) {
    const info = readLink(l)
    if (!info) continue
    if (!ref && info.ref) ref = info.ref
    kind = kind ?? info.kind
    slug = slug || info.slug
  }
  if (ref?.source === 'tmdb' || ref?.source === 'tvmaze') kind = ref.source === 'tvmaze' ? 'tv' : ref.kind

  // The title field first ("Severance | Apple TV+"), then the text, then the words in the link
  let query = ''
  let year: string | null = null
  for (const f of [shared.title ?? '', shared.text ?? '']) {
    const x = extractTitle(f)
    year = year ?? x.year
    kind = kind ?? x.kind
    if (!query && x.title && x.title.split(' ').length <= 12) query = x.title
  }
  if (!query && slug) query = slug.replace(/\b\p{L}/gu, (c) => c.toUpperCase())
  return { ref, query, kind, year }
}

/** Lowercase, no accents or punctuation: "Grey's Anatomy" → "greys anatomy", "Dune: Part Two" → "dune part two". */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’`]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

const ARTICLE = /^(?:the|a|an|o|a|os|as|el|la|los|las|le|les)\s+/

/** How well a title matches what was shared, 0–100. */
export function matchScore(query: string, title: string): number {
  const q = normalize(query)
  const t = normalize(title)
  if (!q || !t) return 0
  if (q === t) return 100
  if (q.replace(ARTICLE, '') === t.replace(ARTICLE, '')) return 95
  const qw = q.split(' ')
  const tw = t.split(' ')
  // "Dune" for "Dune: Part Two", or "The Bear Season" leftovers
  if (t.startsWith(`${q} `) || q.startsWith(`${t} `)) return 70 + 15 * (Math.min(qw.length, tw.length) / Math.max(qw.length, tw.length))
  const tset = new Set(tw)
  const common = qw.filter((w) => tset.has(w)).length
  const union = new Set([...qw, ...tw]).size
  return Math.round((common / union) * 70)
}

/** Below this, a search result isn't what was shared. */
export const MIN_MATCH = 50

/** The best match among search results (exact title first), plus the next few as alternatives. */
export function pickBest(lookup: Pick<ShareLookup, 'query' | 'kind' | 'year'>, candidates: Title[]): { best: Title | null; alternatives: Title[] } {
  const ranked = candidates
    .map((c, i) => {
      const base = matchScore(lookup.query, c.title)
      const bonus = (lookup.year && c.year === lookup.year ? 6 : 0) + (lookup.kind && c.kind === lookup.kind ? 4 : 0)
      return { c, score: base + (base > 0 ? bonus : 0), i }
    })
    // Same score: the search's own order (TVmaze and TMDB rank by popularity)
    .sort((a, b) => b.score - a.score || a.i - b.i)
  const seen = new Set<string>()
  const unique = ranked.filter(({ c }) => !seen.has(`${c.kind}:${c.extId}`) && seen.add(`${c.kind}:${c.extId}`))
  const top = unique[0]
  if (!top || top.score < MIN_MATCH) return { best: null, alternatives: unique.slice(0, 5).map((x) => x.c) }
  return { best: top.c, alternatives: unique.slice(1, 6).map((x) => x.c) }
}

/** Network trouble (offline, DNS, CORS), as opposed to "not found" or "movies not set up". */
export function isNetworkError(e: unknown): boolean {
  return e instanceof TypeError || (e instanceof Error && /network|failed to fetch|load failed|offline/i.test(e.message))
}

/** Finds the shared title: by id when the link has one, otherwise by searching TV and movies for the shared title. */
export async function resolveShare(lookup: ShareLookup, deps: ShareDeps): Promise<ShareResolution> {
  let networkDown = false
  const attempt = async <T>(p: () => Promise<T>): Promise<T | null> => {
    try {
      return await p()
    } catch (e) {
      if (isNetworkError(e)) networkDown = true
      return null
    }
  }
  const found = (title: Title): ShareResolution => ({ status: 'found', title, alternatives: [], query: lookup.query || title.title, kind: title.kind })

  const ref = lookup.ref
  if (ref?.source === 'tvmaze') {
    const show = await attempt(() => deps.showById(ref.id))
    if (show) return found(show)
  } else if (ref?.source === 'tmdb' && ref.kind === 'movie') {
    const movie = await attempt(() => deps.movieById(ref.id))
    if (movie) return found(movie)
  } else if (ref?.source === 'imdb') {
    // A show on TVmaze first (most shares are series), then a movie through TMDB
    const show = lookup.kind === 'movie' ? null : await attempt(() => deps.showByImdb(ref.id))
    if (show) return found(show)
    const movie = await attempt(() => deps.movieByImdb(ref.id))
    if (movie) return found(movie)
  }

  if (!lookup.query) return { status: networkDown ? 'offline' : 'notfound', query: '', kind: lookup.kind }
  const [shows, movies] = await Promise.all([attempt(() => deps.searchShows(lookup.query)), attempt(() => deps.searchMovies(lookup.query))])
  // TV first when nothing says otherwise: shows are most of what the family logs
  const pool = lookup.kind === 'movie' ? [...(movies ?? []), ...(shows ?? [])] : [...(shows ?? []), ...(movies ?? [])]
  const { best, alternatives } = pickBest(lookup, pool)
  if (best) return { status: 'found', title: best, alternatives, query: lookup.query, kind: best.kind }
  if (shows === null && movies === null && networkDown) return { status: 'offline', query: lookup.query, kind: lookup.kind }
  return { status: 'notfound', query: lookup.query, kind: lookup.kind }
}
