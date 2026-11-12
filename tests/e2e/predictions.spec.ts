import { expect, test } from '@playwright/test'
import { A, L, openAs } from './family'

const at = '2026-10-15T20:00:00.000Z'
// Lioness: our household is at S2 E3; a prediction opens at E4
const pred = { id: 'pr-1', householdId: 'h1', showId: 101, season: 2, episode: 4, question: 'Who leaked the mission?', createdBy: L, createdAt: at }
const guesses = [
  { predictionId: 'pr-1', personId: L, guess: 'The general', verdict: null, createdAt: at },
  { predictionId: 'pr-1', personId: A, guess: 'Her own handler', verdict: null, createdAt: at },
]
const seeded = { 'pititi.predictions.v1': [pred], 'pititi.guesses.v1': guesses }
const card = (page: import('@playwright/test').Page) => page.locator('section.predict')

test.describe('Predictions', () => {
  test('make one: question, when it opens, your sealed guess', async ({ page }) => {
    await openAs(page)
    await page.getByRole('button', { name: 'Open Lioness' }).first().click()
    const c = card(page)
    await expect(c).toContainText('Your guesses stay sealed until you log the episode')
    await c.getByRole('button', { name: 'New prediction' }).click()
    await c.getByPlaceholder('Who is the killer?').fill('Does Cruz survive?')
    await expect(c.getByRole('combobox')).toHaveValue('4')
    await c.getByPlaceholder('The butler did it').fill('Yes, barely')
    await c.getByRole('button', { name: /Seal my guess/ }).click()
    await expect(page.getByText('Prediction sealed 🔮')).toBeVisible()
    await expect(c).toContainText('Does Cruz survive?')
    await expect(c).toContainText('🔒 Opens at S2 E4')
    await expect(c).toContainText('“Yes, barely”')
  })

  test("sealed: you see only your own guess until the episode is logged; then all open and get judged", async ({ page }) => {
    await openAs(page, L, { extra: seeded })
    await page.getByRole('button', { name: 'Open Lioness' }).first().click()
    await expect(card(page)).toContainText('“The general”')
    await expect(card(page)).not.toContainText('Her own handler')
    // Log E4 from Quick mark: the prediction opens, once
    await page.goto('/?as=local-leandro&open=quickmark')
    await page.getByRole('button', { name: 'Watched episode 4 of Lioness' }).click()
    await expect(page.getByText('🔮 Predictions are open: Lioness E4')).toBeVisible()
    await page.getByRole('button', { name: 'See', exact: true }).click()
    const c = card(page)
    await expect(c).toContainText('Opened at E4')
    await expect(c).toContainText('“Her own handler”')
    await c.getByRole('group', { name: "Ana's guess" }).getByRole('button', { name: /Nailed it/ }).click()
    await c.getByRole('group', { name: 'Your guess' }).getByRole('button', { name: /Nope/ }).click()
    await expect(c.getByLabel('Score')).toHaveText('Ana 1/1 · You 0/1')
  })

  test('Portuguese', async ({ page }) => {
    await openAs(page, L, { lang: 'pt', extra: seeded })
    await page.getByRole('button', { name: 'Abrir Lioness' }).first().click()
    await expect(card(page)).toContainText('🔒 Abre na T2 E4')
    await expect(card(page)).toContainText('Seu palpite:')
  })
})
