import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import { weekOf } from '../../src/weeklyPicks'
import { A, L, openAs, TEST_NOW } from './family'

const picks = JSON.parse(fs.readFileSync(new URL('./weekly-picks.data.json', import.meta.url), 'utf8')) as { kind: string; extId: number; title: string }[]
const thisWeek = { 'pititi.weekly.v1': { week: weekOf(TEST_NOW), items: picks } }
const movies = picks.filter((p) => p.kind === 'movie').slice(0, 3)
const at = new Date(TEST_NOW.getTime() - 3_600_000).toISOString()
const night = { id: 'n-1', householdId: 'h1', createdBy: A, titles: movies, createdAt: at }
const anaVotes = movies.map((m, i) => ({ nightId: 'n-1', personId: A, ref: `movie:${m.extId}`, yes: i === 1, createdAt: at }))
const dialog = (page: import('@playwright/test').Page) => page.getByRole('dialog', { name: 'Decide together' })

test.describe('Decide together (swipe match)', () => {
  test('start a movie night: choose what, then swipe', async ({ page }) => {
    await openAs(page, L, { extra: thisWeek })
    await page.getByRole('button', { name: /^Decide together/ }).click()
    const d = dialog(page)
    await d.getByRole('radio', { name: 'Both' }).click()
    const start = d.getByRole('button', { name: /^Start · \d+ posters$/ })
    await expect(start).toBeEnabled()
    await expect(d).toContainText('Ana gets a notification to join.')
    await start.click()
    await expect(d.getByText(/^1 of \d+$/)).toBeVisible()
    await d.getByRole('button', { name: /^No to / }).click()
    await expect(d.getByText(/^2 of \d+$/)).toBeVisible()
  })

  test("Ana started one: swipe to the match, then We're watching it opens the log", async ({ page }) => {
    await openAs(page, L, { extra: { ...thisWeek, 'pititi.nights.v1': [night], 'pititi.nightvotes.v1': anaVotes } })
    await expect(page.getByRole('button', { name: /Ana started movie night/ })).toContainText('3 posters left')
    await page.getByRole('button', { name: /Ana started movie night/ }).click()
    const d = dialog(page)
    // Order is shuffled: say yes to everything, the match is the one Ana liked
    for (let i = 0; i < 3 && !(await d.getByText("It's a match").isVisible()); i++) await d.getByRole('button', { name: /^Yes to / }).click()
    await expect(d.getByText("It's a match")).toBeVisible()
    await expect(d.getByRole('heading', { name: movies[1].title })).toBeVisible()
    await d.getByRole('button', { name: "We're watching it" }).click()
    await expect(d).toBeHidden()
    await expect(page.getByRole('dialog').filter({ hasText: movies[1].title })).toBeVisible()
  })

  test('done before Ana: waits for her; no match when nobody agrees', async ({ page }) => {
    await openAs(page, L, { extra: { ...thisWeek, 'pititi.nights.v1': [night] } })
    await page.getByRole('button', { name: /Ana started movie night/ }).click()
    const d = dialog(page)
    for (let i = 0; i < 3; i++) await d.getByRole('button', { name: /^No to / }).click()
    await expect(d).toContainText("You're done")
    await expect(d).toContainText('Waiting for Ana')
    await page.goBack()
    await expect(page.getByRole('button', { name: /Ana started movie night/ })).toContainText('waiting for the others')
  })

  test('Portuguese', async ({ page }) => {
    await openAs(page, L, { lang: 'pt', extra: thisWeek })
    await page.getByRole('button', { name: /^Decidir juntos/ }).click()
    await expect(page.getByRole('dialog', { name: 'Decidir juntos' })).toContainText('Cada um desliza no seu celular')
  })
})
