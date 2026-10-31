import { expect, test, type Page } from '@playwright/test'
import { A, L, openAs } from './family'

// Leandro & Ana finished four shows; TVmaze has news on three of them
// Local dates, like the phone
const day = (offset: number) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const ago = (days: number) => day(-days)
const ahead = (days: number) => day(days)
const now = new Date().toISOString()
const done = (id: number, name: string, season: number, ratings: Record<string, number> = {}) => ({
  id: `b-${id}`, kind: 'tv', householdId: 'h1', showId: id, showName: name, poster: null, network: null, genres: [], year: '2022', season,
  episodesWatched: 8, totalEpisodes: 8, runtime: 50, month: '2026-09', status: 'done', watchedBy: [L, A], ratings, isRewatch: false, notes: '',
  createdBy: L, createdAt: now, updatedAt: now,
})
const seasons = (n: number, last: string | null) =>
  Array.from({ length: n }, (_, i) => ({ id: 800 + i, number: i + 1, episodeOrder: 6, premiereDate: i + 1 === n ? last : `20${15 + i}-01-01`, endDate: null }))
const NEWS: Record<number, object> = {
  501: { status: 'Running', ended: null, _embedded: { seasons: seasons(6, ago(5)) } },
  502: { status: 'Running', ended: null, _embedded: { seasons: seasons(4, ahead(21)) } },
  503: { status: 'Running', ended: null, _embedded: { seasons: seasons(3, null) } },
  504: { status: 'Ended', ended: ago(400), _embedded: { seasons: seasons(2, '2020-01-01') } },
}
const watches = [done(501, 'Slow Horses', 5, { [L]: 9, [A]: 9 }), done(502, 'Shrinking', 3), done(503, 'Severance', 2, { [L]: 10, [A]: 9 }), done(504, 'Old Show', 2)]

async function open(page: Page, who = L, extra: Record<string, unknown> = {}, routes?: () => Promise<unknown>) {
  await openAs(page, who, { extra })
  await routes?.()
  await page.evaluate((add) => {
    localStorage.setItem('pititi.watches.v2', JSON.stringify([...JSON.parse(localStorage.getItem('pititi.watches.v2') || '[]'), ...add]))
    // No rating reveals over the screen
    const seen = JSON.parse(localStorage.getItem('pititi.reveals.v2') || '[]')
    localStorage.setItem('pititi.reveals.v2', JSON.stringify([...seen, ...add.map((w: { showId: number }) => `h1|tv|${w.showId}:local-ana,local-leandro`)]))
  }, watches)
  await page.route('https://api.tvmaze.com/shows/**', (route) => {
    const u = new URL(route.request().url())
    const id = Number(u.pathname.split('/')[2])
    if (u.searchParams.get('embed') === 'seasons') return route.fulfill({ json: NEWS[id] ?? { status: 'Running', ended: null, _embedded: { seasons: [] } } })
    if (u.pathname.endsWith('/seasons') && NEWS[id]) return route.fulfill({ json: (NEWS[id] as { _embedded: { seasons: unknown[] } })._embedded.seasons })
    return route.fallback()
  })
  await page.reload()
}
const back = (page: Page) => page.getByRole('region', { name: "It's back" })

test.describe("It's back", () => {
  test('news on finished shows: out now first, then the date, then the renewal; old endings stay quiet', async ({ page }) => {
    await open(page)
    const rows = back(page).locator('.back-row')
    await expect(rows).toHaveCount(3)
    await expect(rows.nth(0)).toContainText('Slow Horses')
    await expect(rows.nth(0)).toContainText('Season 6 is out')
    await expect(rows.nth(1)).toContainText('Season 4 ·')
    await expect(rows.nth(1)).toContainText('In 21 days')
    await expect(rows.nth(2)).toContainText('Renewed for season 3')
    await expect(back(page)).not.toContainText('Old Show')
  })

  test('Start S6 opens a new log on season 6 with the same people', async ({ page }) => {
    await open(page)
    await back(page).getByRole('button', { name: 'Start season 6 of Slow Horses' }).click()
    await expect(page.getByText('New log')).toBeVisible()
    await expect(page.locator('label.field select').first()).toHaveValue('6')
  })

  test('hiding a piece of news keeps it hidden after reopening', async ({ page }) => {
    await open(page)
    await back(page).getByRole('button', { name: 'Hide this news about Shrinking' }).click()
    await expect(back(page).locator('.back-row')).toHaveCount(2)
    await page.reload()
    await expect(back(page).locator('.back-row')).toHaveCount(2)
    await expect(back(page)).not.toContainText('Shrinking')
  })

  test("news is per household: Fernando doesn't get ours", async ({ page }) => {
    await open(page, 'p-fer')
    await expect(page.getByRole('heading', { name: 'Currently watching' }).or(page.getByRole('heading', { name: /Watched this month/ })).first()).toBeVisible()
    await expect(back(page)).toHaveCount(0)
  })
})

test.describe('For us', () => {
  const pick = (extId: number, title: string, because: string[]) => ({ kind: 'tv', extId, title, titlePt: title, year: '2023', poster: `https://static.tvmaze.com/test/${extId}.jpg`, genres: [], runtime: 50, network: null, score: 8.2, because })
  const forus = [
    pick(601, 'Silo', ['tv:503']), pick(602, 'Andor', ['tv:501']), pick(603, 'Dark', ['tv:503']), pick(604, 'Hacks', ['tv:501', 'tv:503']),
    pick(605, 'Beef', ['tv:501']), pick(606, 'Fallout', ['tv:503']), pick(501, 'Slow Horses', ['tv:503']), pick(607, 'Mr. Robot', ['tv:503']),
  ]

  test('a For us tab from what you rated 8+, without what you already watched; Trending is one tap away', async ({ page }) => {
    let asked = ''
    await open(page, L, {}, () =>
      page.route('**/functions/v1/tmdb**', (route) => {
        const loved = new URL(route.request().url()).searchParams.get('forus')
        if (!loved) return route.fallback()
        asked = loved
        return route.fulfill({ json: forus })
      }),
    )
    await expect.poll(() => asked).toBe('tv:503,tv:501')
    const rail = page.getByRole('region', { name: 'What to watch' })
    await expect(rail.getByRole('tab', { name: /For us/ })).toHaveAttribute('aria-selected', 'true')
    await expect(rail).toContainText('Because you loved Severance and Slow Horses')
    await expect(rail.getByRole('button', { name: /Because you loved/ })).toHaveCount(7)
    await expect(rail.getByRole('button', { name: /^Hacks, series 2023, rated 8\.2 out of 10\. Because you loved Slow Horses/ })).toBeVisible()
    await rail.getByRole('button', { name: /^Hacks/ }).click()
    await expect(page.getByRole('dialog', { name: 'For us' }).locator('.pick.focused')).toContainText('Because you loved Slow Horses and Severance')
  })

  test('without loved titles there is no For us tab, just Picks of the week', async ({ page }) => {
    await openAs(page, L)
    await expect(page.getByRole('heading', { name: 'Currently watching' })).toBeVisible()
    await expect(page.getByRole('tab', { name: /For us/ })).toHaveCount(0)
  })
})
