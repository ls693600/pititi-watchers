import { expect, test } from '@playwright/test'
import { L, openAs, seed } from './family'

const dune = { id: 'i-dune', listId: 'l-up', kind: 'movie', extId: 693134, title: 'Dune: Part Two', poster: null, year: '2024', genres: [], runtime: 95, network: null, addedBy: L, votes: [], createdAt: '2026-10-10T20:00:00Z' }
const items = [...(seed['pititi.listitems.v1'] as object[]), dune]

test.describe('Tonight · We have time', () => {
  test('pick how long; next episodes and list movies that fit; Watch starts the log', async ({ page }) => {
    await openAs(page, L, { extra: { 'pititi.listitems.v1': items } })
    await page.getByRole('tab', { name: /We have time/ }).click()
    const panel = page.getByLabel('We have time')
    // 1 hour (default): one 50-minute episode of Lioness; Dune (95 min) doesn't fit
    await expect(panel.getByRole('radio', { name: '1 hour' })).toHaveAttribute('aria-checked', 'true')
    await expect(panel).toContainText('Next episode · S2 E4')
    await expect(panel).not.toContainText('Dune')
    await panel.getByRole('radio', { name: '2 hours' }).click()
    await expect(panel).toContainText('2 episodes · S2 E4–E5')
    await expect(panel).toContainText('1h 40m')
    await expect(panel).toContainText('Dune: Part Two')
    await panel.getByRole('button', { name: "We're watching Dune: Part Two" }).click()
    await expect(page.getByRole('dialog').filter({ hasText: 'Dune: Part Two' })).toBeVisible()
  })

  test('remembers your choice; Portuguese', async ({ page }) => {
    await openAs(page, L, { lang: 'pt', extra: { 'pititi.listitems.v1': items, 'pititi.timefit.v1': '30' } })
    await page.getByRole('tab', { name: /Temos tempo/ }).click()
    await expect(page.getByRole('radio', { name: '30 min' })).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByLabel('Temos tempo')).toContainText('Nada cabe nesse tempo ainda')
  })
})
