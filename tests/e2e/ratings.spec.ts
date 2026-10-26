import { expect, test } from '@playwright/test'
import { A, L, openAs, seed } from './family'

const base = { kind: 'tv', householdId: 'h1', showName: 'Slow Horses', poster: null, network: 'Apple TV+', genres: ['Drama'], year: '2022', runtime: 45, isRewatch: false, notes: '', createdBy: L, watchedBy: [L, A], status: 'done', createdAt: '2026-09-01T00:00:00Z' }
// Saved on the old 1–5 scale: the phone doubles them once (5 → 10, 4 → 8)
const s5 = { ...base, id: 'w-sh5', showId: 501, season: 5, episodesWatched: 6, totalEpisodes: 6, month: '2026-09', episodesByMonth: { '2026-09': 6 }, ratings: { [L]: 5, [A]: 4 }, updatedAt: '2026-09-20T00:00:00Z' }
const s6 = { ...base, id: 'w-sh6', showId: 501, season: 6, episodesWatched: 6, totalEpisodes: 6, month: '2026-10', episodesByMonth: { '2026-10': 6 }, ratings: {}, updatedAt: '2026-10-20T00:00:00Z' }

test.describe('Ratings out of 10, one per show', () => {
  test('old ratings are doubled; a new season shows the show rating instead of asking again', async ({ page }) => {
    await openAs(page, L, { extra: { 'pititi.watches.v2': [...seed['pititi.watches.v2'], s5, s6] } })
    // Last Seen was 3★ and 4★ → 6 and 8 → 7.0
    await expect(page.locator('.pcard', { hasText: 'Last Seen' }).locator('.pcard-rating')).toHaveText('★7.0')
    const sh = page.locator('.pcard', { hasText: 'Slow Horses' })
    await expect(sh.locator('.pcard-rating')).toHaveText('★9.0')
    await expect(sh).not.toContainText('Your turn to rate')

    await sh.getByRole('button', { name: 'Open Slow Horses' }).first().click()
    await expect(page.getByText('One rating for the whole show, out of 10.', { exact: false })).toBeVisible()
    const mine = page.getByRole('radiogroup', { name: 'Leandro rating' })
    await expect(mine.getByRole('radio', { name: '10 out of 10' })).toHaveAttribute('aria-checked', 'true')
    await mine.getByRole('radio', { name: '7 out of 10' }).click()
    await expect(page.getByText('Your 7/10 saved')).toBeVisible()
    await expect(page.locator('.avg-row')).toContainText('7.5')
  })

  test('changing the rating on an older season changes it for the whole show', async ({ page }) => {
    await openAs(page, L, { extra: { 'pititi.watches.v2': [...seed['pititi.watches.v2'], s5, s6] } })
    await page.getByRole('button', { name: 'Previous month' }).click()
    await page.getByRole('button', { name: 'Open Slow Horses' }).first().click()
    await page.getByRole('radiogroup', { name: 'Leandro rating' }).getByRole('radio', { name: '6 out of 10' }).click()
    await expect(page.getByText('Your 6/10 saved')).toBeVisible()
    await page.getByRole('button', { name: 'Close' }).first().click()
    await page.getByRole('button', { name: 'Next month' }).click()
    await expect(page.locator('.pcard', { hasText: 'Slow Horses' }).locator('.pcard-rating')).toHaveText('★7.0')
  })

  test('only the latest season asks for a rating', async ({ page }) => {
    const s5open = { ...s5, ratings: {} }
    await openAs(page, L, { extra: { 'pititi.watches.v2': [...seed['pititi.watches.v2'], s5open, s6] } })
    await expect(page.locator('.pcard', { hasText: 'Slow Horses' })).toContainText('Your turn to rate')
    await page.getByRole('button', { name: 'Previous month' }).click()
    const old = page.locator('.pcard', { hasText: 'Slow Horses' })
    await expect(old).toContainText('S5')
    await expect(old).not.toContainText('Your turn to rate')
  })
})
