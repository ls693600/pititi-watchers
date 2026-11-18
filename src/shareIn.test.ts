import manifestText from '../public/manifest.webmanifest?raw'
import { describe, expect, it, vi } from 'vitest'
import { extractTitle, matchScore, parseShare, pickBest, readLink, readShare, resolveShare, SHARE_PARAMS, withoutShare } from './shareIn'
import type { ShareDeps } from './shareIn'
import type { Title } from './types'

const tv = (extId: number, title: string, year: string | null = '2022'): Title => ({ kind: 'tv', extId, title, poster: null, year, genres: [], runtime: 50, network: 'Apple TV+' })
const movie = (extId: number, title: string, year: string | null = '2024'): Title => ({ kind: 'movie', extId, title, poster: null, year, genres: [], runtime: null, network: null })

describe('extractTitle: real share text', () => {
  const cases: [string, string][] = [
    ['Assista Severance na Apple TV+', 'Severance'],
    ["Check out 'The Bear' on Hulu https://www.hulu.com/series/the-bear-05eb6a8e-90ed-4947-8c0b-e6536cbddd5f", 'The Bear'],
    ['Watch Severance | Netflix Official Site', 'Severance'],
    ['Stranger Things | Netflix', 'Stranger Things'],
    ['Severance — Official Trailer | Apple TV+ - YouTube', 'Severance'],
    ['The Bear (TV Series 2022– ) - IMDb', 'The Bear'],
    ['Dune: Part Two (2024) - IMDb', 'Dune: Part Two'],
    ['Dune: Part Two (2024) directed by Denis Villeneuve • Reviews, film + cast • Letterboxd', 'Dune: Part Two'],
    ['Severance streaming: where to watch online?', 'Severance'],
    ['Severance - watch tv show streaming online', 'Severance'],
    ['Where to watch Severance', 'Severance'],
    ['Olha só: "Round 6" na Netflix 🔥🔥', 'Round 6'],
    ['Estou assistindo The Last of Us no Max 🍿', 'The Last of Us'],
    ['Acabei de assistir Ainda Estou Aqui no Globoplay!', 'Ainda Estou Aqui'],
    ['Confira “A Casa do Dragão” na HBO Max', 'A Casa do Dragão'],
    ['Você precisa ver Shōgun no Disney+ https://disneyplus.com/series/shogun/abc', 'Shōgun'],
    ['The Bear: Season 3 | Hulu', 'The Bear'],
    ['Severance S02E01 "Hello, Ms. Cobel"', 'Severance'],
    ['Andor - Temporada 2 - Episódio 3 | Disney+', 'Andor'],
    ['I just watched Oppenheimer on Prime Video!', 'Oppenheimer'],
    ['Check this out: Watch Wednesday on Netflix now', 'Wednesday'],
    ['Mission: Impossible - Dead Reckoning Part One', 'Mission: Impossible - Dead Reckoning Part One'],
    ["Grey's Anatomy on Hulu", "Grey's Anatomy"],
    ['Spider-Man: Across the Spider-Verse - Official Trailer', 'Spider-Man: Across the Spider-Verse'],
    ['#Severance 😍 @AppleTV', 'Severance'],
    ['Wandinha | Site oficial da Netflix', 'Wandinha'],
    ['Assista a Pedaço de Mim | Netflix', 'Pedaço de Mim'],
  ]
  it.each(cases)('%s → %s', (raw, want) => {
    expect(extractTitle(raw).title).toBe(want)
  })

  it('nothing usable: emoji, links, a service name on its own', () => {
    expect(extractTitle('🔥🔥🔥').title).toBe('')
    expect(extractTitle('https://www.netflix.com/title/81231974').title).toBe('')
    expect(extractTitle('Netflix').title).toBe('')
    expect(extractTitle('   ').title).toBe('')
  })

  it('reads the year and whether it is a series', () => {
    expect(extractTitle('The Bear (TV Series 2022– ) - IMDb')).toMatchObject({ year: '2022', kind: 'tv' })
    expect(extractTitle('Dune: Part Two (2024) - IMDb')).toMatchObject({ year: '2024', kind: null })
    expect(extractTitle('The Bear: Season 3').kind).toBe('tv')
  })
})

describe('readLink', () => {
  it('TVmaze, TMDB and IMDb ids', () => {
    expect(readLink('https://www.tvmaze.com/shows/44778/severance')).toEqual({ ref: { source: 'tvmaze', id: 44778 }, kind: 'tv', slug: 'severance' })
    expect(readLink('https://www.themoviedb.org/movie/693134-dune-part-two?language=pt-BR')).toEqual({
      ref: { source: 'tmdb', kind: 'movie', id: 693134 },
      kind: 'movie',
      slug: 'dune part two',
    })
    expect(readLink('https://www.themoviedb.org/tv/95396-severance')?.ref).toEqual({ source: 'tmdb', kind: 'tv', id: 95396 })
    expect(readLink('https://m.imdb.com/title/tt11280740/?ref_=nv_sr_srsg_0')?.ref).toEqual({ source: 'imdb', id: 'tt11280740' })
    expect(readLink('https://www.imdb.com/title/tt14452776/episodes/?season=3')?.ref).toEqual({ source: 'imdb', id: 'tt14452776' })
    expect(readLink('https://imdb.com/name/nm0000138/')?.ref).toBeNull()
  })

  it('streaming links: TV or movie, and the title in the address', () => {
    expect(readLink('https://tv.apple.com/us/show/severance/umc.cmc.1srk2goyh2q2zdxcx605w8vtx')).toMatchObject({ kind: 'tv', slug: 'severance' })
    expect(readLink('https://www.disneyplus.com/series/andor/3xsQKWG00GL5')).toMatchObject({ kind: 'tv', slug: 'andor' })
    expect(readLink('https://www.hulu.com/series/the-bear-05eb6a8e-90ed-4947-8c0b-e6536cbddd5f')).toMatchObject({ kind: 'tv', slug: 'the bear' })
    expect(readLink('https://letterboxd.com/film/dune-part-two/')).toMatchObject({ kind: 'movie', slug: 'dune part two' })
    expect(readLink('https://www.justwatch.com/br/serie/ruptura')).toMatchObject({ kind: 'tv', slug: 'ruptura' })
    expect(readLink('https://www.justwatch.com/us/movie/oppenheimer')).toMatchObject({ kind: 'movie', slug: 'oppenheimer' })
    expect(readLink('https://www.netflix.com/title/81231974')).toEqual({ ref: null, kind: null, slug: '' })
    expect(readLink('https://youtu.be/xEQP4VVuyrY')).toEqual({ ref: null, kind: null, slug: '' })
    expect(readLink('not a link')).toBeNull()
  })
})

describe('parseShare', () => {
  it('an IMDb link inside the text', () => {
    expect(parseShare({ text: 'The Bear (TV Series 2022– ) - IMDb https://m.imdb.com/title/tt14452776/' })).toEqual({
      ref: { source: 'imdb', id: 'tt14452776' },
      query: 'The Bear',
      kind: 'tv',
      year: '2022',
    })
  })

  it('Android share: title + text + url, title field first', () => {
    expect(parseShare({ title: 'Severance | Apple TV+', text: 'Check out Severance on Apple TV+', url: 'https://tv.apple.com/us/show/severance/umc.cmc.1' })).toMatchObject({
      ref: null,
      query: 'Severance',
      kind: 'tv',
    })
  })

  it('falls back to the words in the link', () => {
    expect(parseShare({ url: 'https://letterboxd.com/film/dune-part-two/' })).toMatchObject({ query: 'Dune Part Two', kind: 'movie' })
    expect(parseShare({ title: 'Netflix', url: 'https://www.netflix.com/title/81231974' })).toMatchObject({ query: '', ref: null })
  })

  it('a TMDB TV link: the TMDB id is not a TVmaze id, so it searches by name', () => {
    expect(parseShare({ text: 'https://www.themoviedb.org/tv/95396-severance' })).toMatchObject({ ref: { source: 'tmdb', kind: 'tv', id: 95396 }, query: 'Severance', kind: 'tv' })
  })

  it('a long sentence without a title is not a query', () => {
    expect(parseShare({ text: 'hey are you coming tonight because we need to decide what to do about dinner and the kids school thing' }).query).toBe('')
  })
})

describe('matching', () => {
  it('scores exact, article-less, prefix and overlap', () => {
    expect(matchScore('The Bear', 'The Bear')).toBe(100)
    expect(matchScore('Dune Part Two', 'Dune: Part Two')).toBe(100)
    expect(matchScore('Casa do Dragão', 'A Casa do Dragão')).toBe(95)
    expect(matchScore('Dune', 'Dune: Part Two')).toBeGreaterThanOrEqual(70)
    expect(matchScore('zzqx blorp', 'Andor')).toBe(0)
  })

  it('exact title first, even when search ranked it lower; alternatives kept', () => {
    const r = pickBest({ query: 'The Bear', kind: null, year: null }, [tv(1, 'Bear Grylls'), tv(2, 'The Bear'), movie(3, 'The Bear', '1988')])
    expect(r.best?.extId).toBe(2)
    expect(r.alternatives.map((x) => x.extId)).toEqual([3, 1])
  })

  it('year and kind break ties', () => {
    const r = pickBest({ query: 'The Bear', kind: 'movie', year: '1988' }, [tv(2, 'The Bear'), movie(3, 'The Bear', '1988')])
    expect(r.best?.extId).toBe(3)
  })

  it('nothing close enough → no best, alternatives still offered', () => {
    const r = pickBest({ query: 'zzqx blorp', kind: null, year: null }, [tv(1, 'Andor'), movie(2, 'Dune: Part Two')])
    expect(r.best).toBeNull()
    expect(r.alternatives).toHaveLength(2)
  })
})

describe('resolveShare', () => {
  const deps = (over: Partial<ShareDeps> = {}): ShareDeps => ({
    showById: vi.fn(async (id: number) => tv(id, 'Severance')),
    showByImdb: vi.fn(async () => null),
    movieById: vi.fn(async (id: number) => movie(id, 'Dune: Part Two')),
    movieByImdb: vi.fn(async () => null),
    searchShows: vi.fn(async () => [tv(401, 'Andor')]),
    searchMovies: vi.fn(async () => [movie(693134, 'Dune: Part Two')]),
    ...over,
  })

  it('TVmaze link → that show, no search', async () => {
    const d = deps()
    const r = await resolveShare(parseShare({ url: 'https://www.tvmaze.com/shows/44778/severance' }), d)
    expect(r).toMatchObject({ status: 'found', title: { extId: 44778, kind: 'tv' } })
    expect(d.searchShows).not.toHaveBeenCalled()
  })

  it('TMDB movie link → that movie', async () => {
    const r = await resolveShare(parseShare({ url: 'https://www.themoviedb.org/movie/693134-dune-part-two' }), deps())
    expect(r).toMatchObject({ status: 'found', title: { extId: 693134, kind: 'movie' } })
  })

  it('IMDb: a show on TVmaze first', async () => {
    const d = deps({ showByImdb: vi.fn(async () => tv(44778, 'Severance')) })
    const r = await resolveShare(parseShare({ text: 'https://www.imdb.com/title/tt11280740/' }), d)
    expect(r).toMatchObject({ status: 'found', title: { extId: 44778 }, query: 'Severance' })
    expect(d.movieByImdb).not.toHaveBeenCalled()
  })

  it('IMDb: not a show → the movie through TMDB', async () => {
    const d = deps({ movieByImdb: vi.fn(async () => movie(693134, 'Dune: Part Two')) })
    const r = await resolveShare(parseShare({ text: 'Dune: Part Two (2024) - IMDb https://m.imdb.com/title/tt15239678/' }), d)
    expect(r).toMatchObject({ status: 'found', title: { kind: 'movie', extId: 693134 } })
  })

  it('IMDb: the movie lookup is not deployed yet → searches the shared title', async () => {
    const d = deps({ movieByImdb: vi.fn(async () => Promise.reject(new Error('Movies 400'))) })
    const r = await resolveShare(parseShare({ text: 'Dune: Part Two (2024) - IMDb https://m.imdb.com/title/tt15239678/' }), d)
    expect(r).toMatchObject({ status: 'found', title: { kind: 'movie', extId: 693134 } })
    expect(d.searchMovies).toHaveBeenCalledWith('Dune: Part Two')
  })

  it('plain text → best match across TV and movies', async () => {
    const r = await resolveShare(parseShare({ text: 'Check out Andor on Disney+' }), deps())
    expect(r).toMatchObject({ status: 'found', title: { extId: 401 }, alternatives: [{ extId: 693134 }] })
  })

  it('movies not set up (or failing) still finds shows', async () => {
    const r = await resolveShare(parseShare({ text: 'Andor' }), deps({ searchMovies: vi.fn(async () => Promise.reject(new Error('Movies 503'))) }))
    expect(r).toMatchObject({ status: 'found', title: { extId: 401 } })
  })

  it('nothing close → not found, keeps the query for Search', async () => {
    expect(await resolveShare(parseShare({ text: 'zzqx blorp' }), deps())).toEqual({ status: 'notfound', query: 'zzqx blorp', kind: null })
    expect(await resolveShare(parseShare({ text: '🙃🙃' }), deps())).toEqual({ status: 'notfound', query: '', kind: null })
  })

  it('no connection → offline', async () => {
    const down = vi.fn(async () => Promise.reject(new TypeError('Failed to fetch')))
    const r = await resolveShare(parseShare({ text: 'Severance' }), deps({ searchShows: down, searchMovies: down }))
    expect(r).toEqual({ status: 'offline', query: 'Severance', kind: null })
  })
})

describe('share params and the manifest', () => {
  it('reads and removes the share params, keeping ?as= and ?open=', () => {
    expect(readShare('?as=local-leandro&share_text=Andor')).toEqual({ title: null, text: 'Andor', url: null })
    expect(readShare('?as=x&share_title=%20')).toBeNull()
    expect(readShare('?open=add')).toBeNull()
    expect(withoutShare('http://localhost/pititi-watchers/?as=x&share_title=A&share_text=B&share_url=C&open=add')).toBe('/pititi-watchers/?as=x&open=add')
  })

  it('manifest share_target is valid and uses the same params', () => {
    const m = JSON.parse(manifestText)
    expect(m.share_target).toEqual({ action: './', method: 'GET', params: { title: SHARE_PARAMS.title, text: SHARE_PARAMS.text, url: SHARE_PARAMS.url } })
    // The action must stay inside the app's scope, and never collide with existing params
    expect(m.scope).toBe('./')
    expect(Object.values(m.share_target.params)).not.toContain('as')
    expect(Object.values(m.share_target.params)).not.toContain('open')
  })
})
