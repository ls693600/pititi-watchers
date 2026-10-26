import { expect, test } from '@playwright/test'
import { A, L, openAs } from './family'

const halloween = { query: { festive: 'halloween' }, extra: { 'pititi.festive': 'on', 'pititi.festive.seen': 'x' } }

test.describe('Festive picks', () => {
  test('the festive card opens the picks; Save opens the list sheet', async ({ page }) => {
    await openAs(page, L, halloween)
    await expect(page.locator('html')).toHaveAttribute('data-festive', 'halloween')
    await page.getByRole('button', { name: 'Halloween: see our picks for today' }).click()
    const sheet = page.getByRole('dialog', { name: 'Halloween picks' })
    await expect(sheet.getByText('We picked a few movies and shows for the occasion.', { exact: false })).toBeVisible()
    await expect(sheet.locator('.pick')).toHaveCount(11)
    await sheet.getByRole('button', { name: 'Save Hocus Pocus to a list' }).click()
    await page.getByRole('button', { name: /Up Next/ }).click()
    await expect(sheet.getByRole('button', { name: 'Hocus Pocus is on a list. Change lists' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(sheet).toBeHidden()
  })

  test('picks you already watched are marked, in Portuguese', async ({ page }) => {
    const seen = { id: 'w-hp', kind: 'movie', householdId: 'h1', showId: 10439, showName: 'Abracadabra', poster: null, network: null, genres: [], year: '1993', runtime: 96, season: 1, episodesWatched: 1, totalEpisodes: 1, month: '2026-10', status: 'done', watchedBy: [L, A], ratings: {}, isRewatch: false, notes: '', createdBy: L, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' }
    await openAs(page, L, { lang: 'pt', ...halloween })
    await page.evaluate((w) => localStorage.setItem('pititi.watches.v2', JSON.stringify([...JSON.parse(localStorage.getItem('pititi.watches.v2') ?? '[]'), w])), seen)
    await page.reload()
    await page.getByRole('button', { name: 'Halloween: veja nossa seleção para hoje' }).click()
    const first = page.locator('.pick').first()
    await expect(first).toContainText('Abracadabra')
    await expect(first.getByText('Já vimos ✓')).toBeVisible()
    await expect(page.locator('.pick').nth(1).getByText('Já vimos ✓')).toHaveCount(0)
  })

  test('no festive day: plain Home, no card', async ({ page }) => {
    await openAs(page, L)
    await expect(page.locator('.festive-card')).toHaveCount(0)
    await expect(page.locator('.festive-ambient')).toHaveCount(0)
  })
})
