import { expect, test } from '@playwright/test'
import { openAs } from './family'

test.describe('Home tiles show what was watched', () => {
  test('tap "shows": every show of the month with its episodes, sortable, opens the show', async ({ page }) => {
    await openAs(page)
    await page.getByRole('button', { name: /^2 shows\. See the 2 shows watched in October/ }).click()
    const sheet = page.getByRole('dialog', { name: 'What you watched together in October' })
    const rows = sheet.getByRole('listitem')
    await expect(rows).toHaveCount(2)
    // Most episodes first
    await expect(rows.nth(0)).toContainText('Last Seen')
    await expect(rows.nth(0)).toContainText('6 eps')
    await expect(rows.nth(0)).toContainText('Finished')
    await expect(rows.nth(1)).toContainText('Lioness')
    await expect(rows.nth(1)).toContainText('Watching')
    await expect(sheet.getByText('2 shows · 9 eps · 7h 30m')).toBeVisible()
    await sheet.getByRole('radio', { name: 'A–Z' }).click()
    await expect(rows.nth(0)).toContainText('Last Seen')
    await expect(rows.nth(1)).toContainText('Lioness')
    await sheet.getByRole('button', { name: 'Open Lioness' }).click()
    await expect(sheet).toBeHidden()
    await expect(page.getByRole('heading', { name: 'Lioness', level: 1 })).toBeVisible()
  })

  test('tap "hours": sorted by time; Escape closes', async ({ page }) => {
    await openAs(page)
    await page.getByRole('button', { name: /See time by show for October/ }).click()
    const sheet = page.getByRole('dialog', { name: 'What you watched together in October' })
    await expect(sheet.getByRole('radio', { name: 'Time' })).toHaveAttribute('aria-checked', 'true')
    await expect(sheet.getByRole('listitem').first()).toContainText('5h')
    await page.keyboard.press('Escape')
    await expect(sheet).toBeHidden()
  })

  test('follows the person filter (what they watched alone) and is off for an empty month', async ({ page }) => {
    await openAs(page)
    // Everything in the test family was watched together: Ana alone has nothing yet
    await page.getByRole('radiogroup', { name: 'Whose shows' }).getByRole('radio', { name: 'Ana alone' }).click()
    await expect(page.getByRole('button', { name: /See the 0 shows/ })).toBeDisabled()
    await page.getByRole('radiogroup', { name: 'Whose shows' }).getByRole('radio', { name: 'Together' }).click()
    await page.getByRole('button', { name: 'Previous month' }).click()
    await expect(page.getByRole('button', { name: /See the 0 shows/ })).toBeDisabled()
  })

  test('Portuguese', async ({ page }) => {
    await openAs(page, undefined, { lang: 'pt' })
    await page.getByRole('button', { name: /Ver as 2 séries vistas em outubro/ }).click()
    await expect(page.getByRole('dialog', { name: 'O que vocês viram juntos em outubro' }).getByText('Terminada')).toBeVisible()
  })

  test('shows and movies are counted apart; a movie adds time, not episodes', async ({ page }) => {
    const now = new Date().toISOString()
    const movie = {
      id: 'w-movie', kind: 'movie', householdId: 'h1', showId: 693134, showName: 'Dune: Part Two', poster: null, network: null, genres: [], year: '2024',
      season: 1, episodesWatched: 1, totalEpisodes: 1, runtime: 166, month: '2026-10', status: 'done', watchedBy: ['local-leandro', 'local-ana'],
      ratings: {}, isRewatch: false, notes: '', createdBy: 'local-leandro', createdAt: now, updatedAt: now, episodesByMonth: { '2026-10': 1 },
    }
    await openAs(page)
    await page.evaluate((m) => localStorage.setItem('pititi.watches.v2', JSON.stringify([...JSON.parse(localStorage.getItem('pititi.watches.v2') || '[]'), m])), movie)
    await page.reload()
    await expect(page.getByRole('button', { name: /^2 shows\. See the 2 shows/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /^9 episodes\./ })).toBeVisible()
    await page.getByRole('button', { name: /^1 movie\. See the 1 movies watched in October/ }).click()
    const sheet = page.getByRole('dialog', { name: 'What you watched together in October' })
    await expect(sheet.getByRole('radio', { name: 'Movies' })).toHaveAttribute('aria-checked', 'true')
    await expect(sheet.getByRole('listitem')).toHaveCount(1)
    await expect(sheet.getByRole('listitem')).toContainText('Dune: Part Two')
    await expect(sheet.getByText('1 movie · 2h 46m')).toBeVisible()
    await sheet.getByRole('radio', { name: 'All' }).click()
    await expect(sheet.getByRole('listitem')).toHaveCount(3)
    await expect(sheet.getByText('2 shows · 1 movie · 9 eps · 10h 16m')).toBeVisible()
  })
})
