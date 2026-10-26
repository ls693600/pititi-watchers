import { expect, test } from '@playwright/test'
import { A, L, openAs, seed } from './family'

const base = { kind: 'tv', householdId: 'h1', poster: null, network: 'HBO', genres: ['Drama'], year: '2013', runtime: 60, isRewatch: false, notes: '', createdBy: L, createdAt: '2026-10-02T00:00:00Z', month: '2026-10' }
const tunnel = (season: number) => ({ ...base, id: `w-tun${season}`, showId: 701, showName: 'The Tunnel', season, episodesWatched: 8, totalEpisodes: 8, status: 'done', watchedBy: [L, A], ratings: { [L]: 8, [A]: 8 }, episodesByMonth: { '2026-10': 8 }, updatedAt: `2026-10-${10 + season}T00:00:00Z` })
const crystal = { ...base, id: 'w-cl', showId: 702, showName: 'Crystal Lake', season: 1, episodesWatched: 3, totalEpisodes: 8, status: 'watching', watchedBy: [L], ratings: {}, episodesByMonth: { '2026-10': 3 }, updatedAt: '2026-10-20T00:00:00Z' }
const extra = { 'pititi.scale10': '1', 'pititi.watches.v2': [...seed['pititi.watches.v2'], tunnel(1), tunnel(2), tunnel(3), crystal] }

test.describe('Home: together vs alone, one poster per show', () => {
  test('three seasons watched together are one poster that opens them', async ({ page }) => {
    await openAs(page, L, { extra })
    const card = page.locator('.pcard', { hasText: 'The Tunnel' })
    await expect(card).toHaveCount(1)
    await expect(card).toContainText('S1–S3')
    await expect(card.locator('.pcard-img.stacked')).toHaveCount(1)
    await card.getByRole('button', { name: 'The Tunnel: see its 3 seasons' }).click()
    const sheet = page.getByRole('dialog', { name: 'The Tunnel' })
    await expect(sheet.getByRole('listitem')).toHaveCount(3)
    await expect(sheet).toContainText('8.0')
    await sheet.getByRole('button', { name: 'Open The Tunnel season 2' }).click()
    await expect(page.getByRole('heading', { name: 'The Tunnel', level: 1 })).toBeVisible()
  })

  test('your solo show is under your name, not Together; Currently watching keeps it', async ({ page }) => {
    await openAs(page, L, { extra })
    const filter = page.getByRole('radiogroup', { name: 'Whose shows' })
    await expect(filter.getByRole('radio', { name: 'Together' })).toHaveAttribute('aria-checked', 'true')
    // Together: Lioness, Last Seen, The Tunnel (Crystal Lake is Leandro alone)
    await expect(page.getByRole('button', { name: /^3 shows\./ })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Currently watching' }).getByText('Crystal Lake').first()).toBeVisible()
    await filter.getByRole('radio', { name: 'Leandro alone' }).click()
    await expect(page.getByRole('button', { name: /^1 show\./ })).toBeVisible()
    await expect(page.locator('.pcard', { hasText: 'The Tunnel' })).toHaveCount(0)
  })
})
