import { expect, test } from '@playwright/test'
import { A, L, openAs, seed } from './family'

// Season 1 finished this month, Season 2 in progress (episode 5 of 10)
const base = { kind: 'tv', poster: null, network: 'USA', genres: ['Drama'], year: '2025', runtime: 45, notes: '', householdId: 'h1', createdBy: L, watchedBy: [L, A], ratings: {}, showId: 906, showName: 'The Rainmaker', totalEpisodes: 10, isRewatch: false, createdAt: '2026-10-02T00:00:00Z', month: '2026-10' }
const s1 = { ...base, id: 'rm-1', season: 1, episodesWatched: 10, status: 'done', episodesByMonth: { '2026-10': 10 }, updatedAt: '2026-10-08T00:00:00Z' }
const s2 = { ...base, id: 'rm-2', season: 2, episodesWatched: 5, status: 'watching', episodesByMonth: { '2026-10': 5 }, updatedAt: '2026-10-18T00:00:00Z' }
const extra = { 'pititi.scale10': '1', 'pititi.watches.v2': [...seed['pititi.watches.v2'], s1, s2] }

test.describe('The season you are on', () => {
  test('a finished season in "Watched this month" opens the season you are watching now', async ({ page }) => {
    await openAs(page, L, { extra })
    await page.locator('.grid').getByRole('button', { name: 'Open The Rainmaker' }).click()
    await expect(page.getByRole('heading', { name: 'The Rainmaker', level: 1 })).toBeVisible()
    await expect(page.getByText('Season 2 · 5 of 10')).toBeVisible()
    await expect(page.getByText(/You're on Season/)).toHaveCount(0)
  })

  test("an earlier season's page says which season you're on, with a way there", async ({ page }) => {
    await openAs(page, L, { extra })
    // After openAs: later routes win over the default test data
    await page.route('https://api.tvmaze.com/shows/906/seasons', (r) =>
      r.fulfill({ json: [1, 2].map((n) => ({ id: 9060 + n, number: n, episodeOrder: 10, premiereDate: `${2024 + n}-01-10`, endDate: n === 1 ? '2025-03-01' : null })) }),
    )
    await page.locator('.grid').getByRole('button', { name: 'Open The Rainmaker' }).click()
    await page.getByRole('combobox', { name: /^Season/ }).selectOption('1')
    await expect(page.getByText("You're on Season 2")).toBeVisible()
    await expect(page.getByText('5 of 10 episodes')).toBeVisible()
    await page.getByRole('button', { name: 'Go to Season 2' }).click()
    await expect(page.getByText('Season 2 · 5 of 10')).toBeVisible()
  })
})
