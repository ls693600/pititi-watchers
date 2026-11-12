import { expect, test } from '@playwright/test'
import { openAs } from './family'

test.describe('Story texts in Portuguese', () => {
  test('a series shows TMDB\'s Portuguese story; English keeps TVmaze\'s', async ({ page }) => {
    await openAs(page, undefined, { lang: 'pt' })
    await page.getByRole('button', { name: 'Abrir Lioness' }).first().click()
    await expect(page.getByText('Uma série.')).toBeVisible()
    await expect(page.getByText('A show.')).toHaveCount(0)
  })

  test('English is unchanged', async ({ page }) => {
    await openAs(page)
    await page.getByRole('button', { name: 'Open Lioness' }).first().click()
    await expect(page.getByText('A show.')).toBeVisible()
  })

  test('no Portuguese story found: the English one stays', async ({ page }) => {
    await openAs(page, undefined, { lang: 'pt' })
    await page.route('**/functions/v1/tmdb**', (route) => (new URL(route.request().url()).searchParams.get('story') ? route.fulfill({ json: { overview: null } }) : route.fallback()))
    await page.getByRole('button', { name: 'Abrir Lioness' }).first().click()
    await expect(page.getByText('A show.')).toBeVisible()
  })
})
