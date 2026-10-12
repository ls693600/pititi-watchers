import { expect, test } from '@playwright/test'
import { openAs } from './family'

test.describe('Home', () => {
  test('shows only our household, and Watched next can be undone', async ({ page }) => {
    await openAs(page)
    await expect(page.getByRole('heading', { name: 'Leandro' })).toBeVisible()
    // Our show is on the banner; another household's show is not on our Home
    await expect(page.getByRole('button', { name: 'Open Lioness' }).first()).toBeVisible()
    await expect(page.getByText('The Bear')).toHaveCount(0)

    await expect(page.getByText('Season 2 · 3 of 8')).toBeVisible()
    await page.getByRole('button', { name: 'Watched next' }).click()
    await expect(page.getByText('Episode 4 logged')).toBeVisible()
    await expect(page.getByText('Season 2 · 4 of 8')).toBeVisible()

    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(page.getByText('Season 2 · 3 of 8')).toBeVisible()
  })

  test('press-and-hold menu opens from •••', async ({ page }) => {
    await openAs(page)
    await page.getByRole('button', { name: 'Quick actions for Lioness' }).click()
    await expect(page.getByRole('dialog', { name: 'Quick actions for Lioness' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Watched episode 4/ })).toBeVisible()
  })
})
