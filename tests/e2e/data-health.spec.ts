import { expect, test, type Page } from '@playwright/test'
import { A, L, openAs, seed } from './family'

const base = { kind: 'tv', poster: null, network: 'HBO', genres: ['Drama'], year: '2026', runtime: 58, isRewatch: false, notes: '', createdAt: '2026-10-02T00:00:00Z', updatedAt: '2026-10-20T00:00:00Z', month: '2026-10', showId: 801, showName: 'War', season: 1, totalEpisodes: 8, status: 'watching' }
const ours = (over: object = {}) => ({ ...base, id: 'w-war', householdId: 'h1', createdBy: L, episodesWatched: 4, watchedBy: [L, A], ratings: {}, episodesByMonth: { '2026-10': 4 }, ...over })
// Pero & Marcia logged the same season on their own
const theirs = { ...base, id: 'w-war-h4', householdId: 'h4', createdBy: 'p-pero', episodesWatched: 0, watchedBy: ['p-pero', 'p-mar'], ratings: {}, episodesByMonth: {} }
const withLogs = (...logs: object[]) => ({ 'pititi.scale10': '1', 'pititi.watches.v2': [...seed['pititi.watches.v2'], ...logs] })

/** Season 1 premieres in November 2026, so an October log was filed before it aired. */
async function premieresInNovember(page: Page) {
  await page.route('https://api.tvmaze.com/shows/*/seasons', (route) => route.fulfill({ json: [{ id: 9101, number: 1, episodeOrder: 8, premiereDate: '2026-11-03', endDate: null }] }))
}

test.describe('Show page data health', () => {
  test('another family logging the same season is not a duplicate', async ({ page }) => {
    await openAs(page, L, { extra: withLogs(ours(), theirs) })
    await page.getByRole('button', { name: 'Open War' }).click()
    await expect(page.getByRole('heading', { name: 'War', level: 1 })).toBeVisible()
    await expect(page.getByText('This season is logged twice')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Merge into one' })).toHaveCount(0)
  })

  test('Move to the premiere month saves in one click', async ({ page }) => {
    await openAs(page, L, { extra: withLogs(ours()) })
    await premieresInNovember(page)
    await page.getByRole('button', { name: 'Open War' }).click()
    await expect(page.getByText('Filed before it aired')).toBeVisible()
    await page.getByRole('button', { name: 'Move to November 2026' }).click()
    await expect(page.getByText('Moved to November 2026')).toBeVisible()
    // Back on Home, in November, with the show there; nothing left in October
    await expect(page.getByRole('heading', { name: 'War', level: 1 })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Open War' })).toBeVisible()
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pititi.watches.v2') || '[]').find((w: { id: string }) => w.id === 'w-war'))
    expect(saved.month).toBe('2026-11')
    expect(saved.episodesByMonth).toEqual({ '2026-11': 4 })
  })

  test('people from another household pulled into a log can be removed', async ({ page }) => {
    await openAs(page, L, { extra: withLogs(ours({ watchedBy: [L, A, 'p-mar'], ratings: { 'p-mar': 6 } }), theirs) })
    await page.getByRole('button', { name: 'Open War' }).click()
    await expect(page.getByText("Marcia isn't in your household")).toBeVisible()
    await page.getByRole('button', { name: 'Remove from this log' }).click()
    await expect(page.getByText('Removed from this log')).toBeVisible()
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pititi.watches.v2') || '[]').find((w: { id: string }) => w.id === 'w-war'))
    expect(saved.watchedBy).toEqual(['local-leandro', 'local-ana'])
    expect(saved.ratings).toEqual({})
    const theirsSaved = await page.evaluate(() => JSON.parse(localStorage.getItem('pititi.watches.v2') || '[]').find((w: { id: string }) => w.id === 'w-war-h4'))
    expect(theirsSaved.watchedBy).toEqual(['p-pero', 'p-mar'])
  })
})
