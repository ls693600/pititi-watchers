import type { Page } from '@playwright/test'

// A test family shaped like the real one: 4 households, shows, a movie, lists, recommendations.
export const L = 'local-leandro'
export const A = 'local-ana'

const now = Date.UTC(2026, 9, 11, 18)
const ago = (days: number) => new Date(now - days * 86_400_000).toISOString()
const poster = (n: number) => `https://static.tvmaze.com/test/${n}.jpg`

const show = (id: number, name: string, extra: object) => ({
  id: `w-${id}`,
  kind: 'tv',
  showId: id,
  showName: name,
  poster: poster(id),
  network: 'Netflix',
  genres: ['Drama'],
  year: '2024',
  runtime: 50,
  isRewatch: false,
  notes: '',
  createdAt: ago(5),
  updatedAt: ago(1),
  month: '2026-10',
  ...extra,
})

export const seed = {
  'pititi.households.v1': [
    { id: 'h1', name: 'Leandro & Ana', shareLog: true },
    { id: 'h2', name: 'Fernando & Lara', shareLog: true },
    { id: 'h3', name: 'Eduarda & Thiago', shareLog: true },
    { id: 'h4', name: 'Pero & Marcia', shareLog: true },
  ],
  'pititi.people.v2': [
    { id: L, name: 'Leandro', userId: 'u1', isAdmin: true, householdId: 'h1' },
    { id: A, name: 'Ana', userId: 'u2', isAdmin: false, householdId: 'h1' },
    { id: 'p-fer', name: 'Fernando', userId: 'u3', isAdmin: false, householdId: 'h2' },
    { id: 'p-lara', name: 'Lara', userId: 'u4', isAdmin: false, householdId: 'h2' },
    { id: 'p-edu', name: 'Eduarda', userId: 'u5', isAdmin: false, householdId: 'h3' },
    { id: 'p-thi', name: 'Thiago', userId: 'u6', isAdmin: false, householdId: 'h3' },
    { id: 'p-pero', name: 'Pero', userId: 'u7', isAdmin: false, householdId: 'h4' },
    { id: 'p-mar', name: 'Marcia', userId: 'u8', isAdmin: false, householdId: 'h4' },
    { id: 'p-guest', name: 'Guest', userId: 'u9', isAdmin: false, isViewer: true, householdId: null },
  ],
  'pititi.watches.v2': [
    show(101, 'Lioness', { householdId: 'h1', season: 2, episodesWatched: 3, totalEpisodes: 8, status: 'watching', watchedBy: [L, A], ratings: {}, createdBy: L, episodesByMonth: { '2026-10': 3 } }),
    show(102, 'Last Seen', { householdId: 'h1', season: 1, episodesWatched: 6, totalEpisodes: 6, status: 'done', watchedBy: [L, A], ratings: { [L]: 3, [A]: 4 }, createdBy: L, episodesByMonth: { '2026-10': 6 } }),
    show(103, 'The Bear', { householdId: 'h2', season: 4, episodesWatched: 10, totalEpisodes: 10, status: 'done', watchedBy: ['p-fer', 'p-lara'], ratings: { 'p-fer': 5, 'p-lara': 4 }, createdBy: 'p-fer', episodesByMonth: { '2026-10': 10 } }),
  ],
  'pititi.lists.v1': [
    { id: 'l-up', householdId: 'h1', name: 'Up Next', emoji: '📌', visibility: 'household', sharedWith: [], askVotes: false, isDefault: true, createdBy: L, createdAt: ago(30) },
    { id: 'l-h3', householdId: 'h3', name: 'Scary October', emoji: '👻', visibility: 'circle', sharedWith: [], askVotes: true, isDefault: false, createdBy: 'p-edu', createdAt: ago(3) },
    { id: 'l-h4', householdId: 'h4', name: 'Secret list', emoji: '🎬', visibility: 'household', sharedWith: [], askVotes: false, isDefault: false, createdBy: 'p-pero', createdAt: ago(3) },
  ],
  'pititi.listitems.v1': [
    { id: 'i-1', listId: 'l-up', kind: 'tv', extId: 201, title: 'Severance', poster: poster(201), year: '2022', genres: [], runtime: 50, network: null, addedBy: L, votes: [L], createdAt: ago(5) },
    { id: 'i-2', listId: 'l-h3', kind: 'tv', extId: 202, title: 'Wednesday', poster: poster(202), year: '2022', genres: [], runtime: 50, network: null, addedBy: 'p-edu', votes: ['p-edu'], createdAt: ago(3) },
  ],
  'pititi.recs.v1': [
    { id: 'r-1', from: 'p-fer', to: L, note: 'You will laugh so much', status: 'new', createdAt: ago(0.2), kind: 'tv', extId: 301, title: 'Shrinking', poster: poster(301), year: '2023', genres: [], runtime: 30, network: null },
  ],
  'pititi.comments.v1': [],
  'pititi.reactions.v1': [],
  'pititi.mutes.v1': [],
  // Reveals and badges already seen, so nothing pops up over the screens under test
  'pititi.badges.v1': ['explorer', 'roll', 'family', 'soulmates', 'disagree', 'binge', 'rewatch', 'night', 'centurion'],
  'pititi.chatseen.v1': [],
  'pititi.festive': 'off',
}

/** Loads the app as a person (?as=), with the test family and fixed answers for TVmaze and movies. */
export async function openAs(page: Page, personId = L, opts: { lang?: 'en' | 'pt'; path?: string; extra?: Record<string, unknown>; query?: Record<string, string> } = {}) {
  await page.addInitScript(
    ({ data, lang }) => {
      // Only on the first load of this test: later reloads keep what the test changed
      if (sessionStorage.getItem('seeded')) return
      sessionStorage.setItem('seeded', '1')
      localStorage.clear()
      for (const [k, v] of Object.entries(data)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v))
      localStorage.setItem('pititi.tip.hold.v1', '1')
      localStorage.setItem('pititi.theme', 'light')
      localStorage.setItem('pititi.lang', lang)
    },
    { data: { ...seed, ...(opts.extra ?? {}) }, lang: opts.lang ?? 'en' },
  )
  await page.route('https://api.tvmaze.com/**', (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/search/shows')
      return route.fulfill({
        json: [
          { show: { id: 401, name: 'Andor', premiered: '2022-09-21', genres: ['Drama', 'Science-Fiction'], averageRuntime: 50, image: { medium: poster(401) }, webChannel: { name: 'Disney+' } } },
        ],
      })
    if (url.pathname.endsWith('/seasons'))
      return route.fulfill({
        json: [
          { id: 9001, number: 1, episodeOrder: 6, premiereDate: '2022-09-21', endDate: '2022-11-23' },
          { id: 9002, number: 2, episodeOrder: 12, premiereDate: '2025-04-22', endDate: '2025-05-13' },
        ],
      })
    if (url.pathname.startsWith('/seasons/'))
      return route.fulfill({ json: Array.from({ length: 12 }, (_, i) => ({ number: i + 1, name: `Ep ${i + 1}`, airdate: '2022-10-01', type: 'regular' })) })
    return route.fulfill({ json: { id: 1, name: 'Show', summary: '<p>A show.</p>', rating: { average: 8 }, status: 'Ended', averageRuntime: 50, webChannel: { name: 'Disney+' }, officialSite: 'https://example.com' } })
  })
  await page.route('**/functions/v1/tmdb**', (route) => {
    const url = new URL(route.request().url())
    // Trailers: Last Seen (102) has none, everything else gets one named after what was asked
    const trailer = url.searchParams.get('trailer')
    if (trailer) {
      const id = url.searchParams.get('id')
      if (id === '102') return route.fulfill({ json: { key: null } })
      const season = url.searchParams.get('season')
      return route.fulfill({ json: { key: `yt-${trailer}-${id}${season ? `-s${season}` : ''}`, name: `Official Trailer${season ? ` · Season ${season}` : ''}` } })
    }
    if (url.searchParams.get('q'))
      return route.fulfill({ json: [{ id: 693134, title: 'Dune: Part Two', year: '2024', poster: null, genres: ['Science-Fiction'], overview: 'Paul joins the Fremen.', rating: 8.1 }] })
    return route.fulfill({
      json: { id: 693134, title: 'Dune: Part Two', year: '2024', poster: null, backdrop: null, genres: ['Science-Fiction'], runtime: 167, overview: 'Paul joins the Fremen.', rating: 8.1, tagline: null, providers: [{ name: 'Apple TV Store', how: 'rent' }], link: 'https://example.com' },
    })
  })
  // The YouTube player: a stand-in page, so tests never load YouTube
  await page.route('https://www.youtube-nocookie.com/**', (route) => route.fulfill({ contentType: 'text/html', body: '<title>player</title><p>Trailer playing</p>' }))
  // Posters: a tiny blank image so nothing waits on the network
  await page.route('https://static.tvmaze.com/**', (route) => route.fulfill({ status: 404, body: '' }))
  await page.goto(`${opts.path ?? '/'}?${new URLSearchParams({ as: personId, ...opts.query })}`)
}
