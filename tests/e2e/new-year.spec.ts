import { expect, test } from '@playwright/test'
import { openAs } from './family'

test.describe('New Year on a phone that never closes the app', () => {
  test('Home moves to January by itself; after midnight on the 31st it is still December', async ({ page }) => {
    await openAs(page, undefined, { now: new Date('2026-12-31T22:00:00') })
    const month = page.locator('.monthbar-label strong')
    await expect(month).toHaveText('December 2026')
    // 00:30 on Jan 1: still New Year's Eve for the couch
    await page.clock.setFixedTime(new Date('2027-01-01T00:30:00'))
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await expect(month).toHaveText('December 2026')
    // The next morning, coming back to the app
    await page.clock.setFixedTime(new Date('2027-01-01T09:00:00'))
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
    await expect(month).toHaveText('January 2027')
  })

  test('browsing an older month is left alone when the month changes', async ({ page }) => {
    await openAs(page, undefined, { now: new Date('2026-12-31T22:00:00') })
    await page.getByRole('button', { name: 'Previous month' }).click()
    const month = page.locator('.monthbar-label strong')
    await expect(month).toHaveText('November 2026')
    await page.clock.setFixedTime(new Date('2027-01-01T09:00:00'))
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await page.waitForTimeout(200)
    await expect(month).toHaveText('November 2026')
  })

  test('in January, Stats opens on the year that just ended', async ({ page }) => {
    await openAs(page, undefined, { now: new Date('2027-01-10T20:00:00') })
    await page.getByRole('button', { name: 'Stats', exact: true }).click()
    await expect(page.getByRole('region', { name: '2026 summary' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Next year' })).toBeEnabled()
  })
})
