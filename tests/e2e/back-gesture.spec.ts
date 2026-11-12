import { expect, test, type Page } from '@playwright/test'
import { openAs } from './family'

// The phone's Back closes what's on top, one layer at a time, and never drops you out of the app mid-way
const back = async (page: Page) => {
  await page.goBack()
  await page.waitForTimeout(150)
}
const onHome = (page: Page) => expect(page.getByRole('button', { name: 'Home' })).toHaveAttribute('aria-current', 'page')

test.describe('Back gesture', () => {
  test('show page → Back → Home', async ({ page }) => {
    await openAs(page)
    await page.getByRole('button', { name: 'Open Lioness' }).first().click()
    await expect(page.getByRole('heading', { name: 'Lioness', level: 1 })).toBeVisible()
    await back(page)
    await expect(page.getByRole('heading', { name: 'Lioness', level: 1 })).toBeHidden()
    await onHome(page)
  })

  test('a trailer over the show page: Back closes the trailer first, then the page', async ({ page }) => {
    await openAs(page)
    await page.getByRole('button', { name: 'Open Lioness' }).first().click()
    await page.getByRole('button', { name: 'Watch the trailer of Lioness' }).first().click()
    await expect(page.getByRole('dialog', { name: 'Trailer of Lioness' })).toBeVisible()
    await back(page)
    await expect(page.getByRole('dialog', { name: 'Trailer of Lioness' })).toBeHidden()
    await expect(page.getByRole('heading', { name: 'Lioness', level: 1 })).toBeVisible()
    await back(page)
    await onHome(page)
  })

  test('Lists: sheet → list → Lists → Home, one Back each', async ({ page }) => {
    await openAs(page)
    await page.getByRole('button', { name: 'Lists' }).click()
    await page.getByRole('button', { name: /Up Next/ }).click()
    await page.getByRole('button', { name: 'Options for Severance' }).click()
    await expect(page.getByRole('dialog', { name: 'Severance' })).toBeVisible()
    await back(page)
    await expect(page.getByRole('dialog', { name: 'Severance' })).toBeHidden()
    await expect(page.getByRole('button', { name: 'Options for Severance' })).toBeVisible()
    await back(page)
    await expect(page.getByRole('button', { name: /Up Next/ })).toBeVisible()
    await back(page)
    await onHome(page)
  })

  test('closing with its own button, then opening something else: Back still closes the new one', async ({ page }) => {
    await openAs(page)
    await page.getByRole('button', { name: 'Open Lioness' }).first().click()
    await page.getByRole('button', { name: 'Watch the trailer of Lioness' }).first().click()
    await page.getByRole('dialog', { name: 'Trailer of Lioness' }).getByRole('button', { name: 'Close' }).last().click()
    await expect(page.getByRole('dialog', { name: 'Trailer of Lioness' })).toBeHidden()
    await back(page)
    await onHome(page)
    await page.getByRole('button', { name: 'Stats', exact: true }).click()
    await back(page)
    await onHome(page)
  })

  test('switching tabs does not pile up: one Back returns Home', async ({ page }) => {
    await openAs(page)
    await page.getByRole('button', { name: 'Lists' }).click()
    await page.getByRole('button', { name: 'Stats', exact: true }).click()
    await page.getByRole('button', { name: /^Family/ }).click()
    await back(page)
    await onHome(page)
  })
})
