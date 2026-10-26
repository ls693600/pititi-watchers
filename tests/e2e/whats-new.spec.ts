import { expect, test } from '@playwright/test'
import { L, openAs } from './family'

test.describe("What's new after an update", () => {
  test('shows once on Home until dismissed; Settings lists every release', async ({ page }) => {
    await openAs(page, L, { extra: { 'pititi.whatsnew.seen': 'older-version' } })
    const card = page.getByRole('region', { name: "What's new in Pititi" })
    await expect(card).toBeVisible()
    await expect(card.getByRole('listitem').first()).toBeVisible()
    await card.getByRole('button', { name: 'Got it' }).click()
    await expect(card).toBeHidden()
    await page.reload()
    await expect(page.getByRole('heading', { name: "What's new in Pititi" })).toBeHidden()

    await page.getByRole('button', { name: 'Your profile and settings' }).click()
    await page.getByRole('button', { name: "What's new" }).click()
    const sheet = page.getByRole('dialog', { name: "What's new" })
    await expect(sheet.getByText('Ratings go from 1 to 10', { exact: false })).toBeVisible()
  })
})
