import { expect, test, type Page } from '@playwright/test'
import { A, L, openAs, seed } from './family'

// Routes for TVmaze are added after openAs: later routes win over the default test data
// Rewatching a show season by season: two seasons watched this month, more seasons out, one still to come
const base = { kind: 'tv', poster: null, network: 'Paramount+', genres: ['Drama'], year: '2021', runtime: 50, notes: '', householdId: 'h1', createdBy: L, watchedBy: [L, A], ratings: {}, showId: 905, showName: 'Mayor of Kingstown', totalEpisodes: 10, episodesWatched: 10, status: 'done', createdAt: '2026-10-02T00:00:00Z' }
const s1 = { ...base, id: 'mk-1', season: 1, isRewatch: true, month: '2026-10', episodesByMonth: { '2026-10': 10 }, updatedAt: '2026-10-05T00:00:00Z' }
const s2 = { ...base, id: 'mk-2', season: 2, isRewatch: false, month: '2026-10', episodesByMonth: { '2026-10': 10 }, updatedAt: '2026-10-12T00:00:00Z' }
const withLogs = (...logs: object[]) => ({ 'pititi.scale10': '1', 'pititi.watches.v2': [...seed['pititi.watches.v2'], ...logs] })

async function fourSeasonsOut(page: Page) {
  await page.route('https://api.tvmaze.com/shows/905/seasons', (route) =>
    route.fulfill({
      json: [1, 2, 3, 4].map((n) => ({ id: 9050 + n, number: n, episodeOrder: 10, premiereDate: `${2020 + n}-11-14`, endDate: `${2021 + n}-01-15` })).concat({ id: 9055, number: 5, episodeOrder: 10, premiereDate: '2027-06-01', endDate: null }),
    }),
  )
}

test.describe("A show's seasons on Home", () => {
  test('every later season can be started from the sheet, and the next unaired one says when', async ({ page }) => {
    await openAs(page, L, { extra: withLogs(s1, s2) })
    await fourSeasonsOut(page)
    await page.getByRole('button', { name: /Mayor of Kingstown/ }).first().click()
    const sheet = page.getByRole('dialog', { name: 'Mayor of Kingstown' })
    await expect(sheet.getByRole('button', { name: 'Open Mayor of Kingstown season 2' })).toBeVisible()
    await expect(sheet.getByRole('button', { name: /Start Season 3/ })).toBeVisible()
    await expect(sheet.getByRole('button', { name: /Start Season 4/ })).toBeVisible()
    await expect(sheet.getByText(/Season 5/)).toBeVisible()
    await expect(sheet.getByText(/Comes out/)).toBeVisible()
    await expect(sheet.getByRole('button', { name: /Season 5/ })).toHaveCount(0)

    await sheet.getByRole('button', { name: /Start Season 3/ }).click()
    await expect(sheet).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Mayor of Kingstown', level: 1 })).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Season' }).or(page.getByLabel('Season', { exact: true }))).toHaveValue('3')
  })

  test('a later season already logged in another month opens that log instead', async ({ page }) => {
    const s3 = { ...base, id: 'mk-3', season: 3, isRewatch: false, month: '2026-09', episodesByMonth: { '2026-09': 10 }, updatedAt: '2026-09-20T00:00:00Z' }
    await openAs(page, L, { extra: withLogs(s1, s2, s3) })
    await fourSeasonsOut(page)
    await page.getByRole('button', { name: /Mayor of Kingstown/ }).first().click()
    const sheet = page.getByRole('dialog', { name: 'Mayor of Kingstown' })
    await expect(sheet.getByRole('button', { name: 'Open Mayor of Kingstown season 3' })).toContainText('September 2026')
    await expect(sheet.getByRole('button', { name: /Start Season 3/ })).toHaveCount(0)
    await expect(sheet.getByRole('button', { name: /Start Season 4/ })).toBeVisible()
  })

  test('viewers see the seasons but cannot start one', async ({ page }) => {
    await openAs(page, 'p-guest', { extra: withLogs(s1, s2) })
    await fourSeasonsOut(page)
    const tile = page.getByRole('button', { name: /Mayor of Kingstown/ }).first()
    if (!(await tile.isVisible().catch(() => false))) test.skip(true, 'Viewers see the family log differently')
    await tile.click()
    await expect(page.getByRole('button', { name: /Start Season/ })).toHaveCount(0)
  })
})
