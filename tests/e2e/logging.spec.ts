import { expect, test } from '@playwright/test'
import { openAs } from './family'

test.describe('Logging shows and movies', () => {
  test('log a TV show from search', async ({ page }) => {
    await openAs(page)
    await page.getByRole('button', { name: 'Add a show' }).click()
    await page.getByRole('searchbox', { name: 'Search shows' }).fill('andor')
    await page.getByRole('button', { name: 'Log Andor' }).click()
    const sheet = page.getByRole('dialog')
    await expect(sheet.getByRole('heading', { name: 'Andor' })).toBeVisible()
    await sheet.getByRole('radio', { name: /Finished it/ }).click()
    await sheet.getByRole('button', { name: 'Log it' }).click()
    await expect(page.getByText('Andor added to October 2026')).toBeVisible()
  })

  test('log a movie: one sitting, together, with stars', async ({ page }) => {
    await openAs(page)
    await page.getByRole('button', { name: 'Add a show' }).click()
    await page.getByRole('tab', { name: 'Movies' }).click()
    await page.getByRole('searchbox', { name: 'Search movies' }).fill('dune')
    await page.getByRole('button', { name: 'Log Dune: Part Two' }).click()
    const sheet = page.getByRole('dialog', { name: 'Log Dune: Part Two' })
    await expect(sheet.getByText('2h 47m')).toBeVisible()
    await sheet.getByRole('radio', { name: /Together/ }).click()
    await sheet.getByRole('radio', { name: '9 out of 10' }).click()
    await sheet.getByRole('button', { name: 'We watched it' }).click()
    await expect(page.getByText('Dune: Part Two added to October 2026')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Open Dune: Part Two' })).toBeVisible()
  })
})
