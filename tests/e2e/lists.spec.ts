import { expect, test } from '@playwright/test'
import { openAs } from './family'

test.describe('Lists, privacy and votes', () => {
  test('family lists show, private lists of other households do not', async ({ page }) => {
    await openAs(page)
    await page.getByRole('button', { name: 'Lists' }).click()
    await expect(page.getByRole('button', { name: /Up Next/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Scary October/ })).toBeVisible()
    await expect(page.getByText('Secret list')).toHaveCount(0)
  })

  test('vote on another household\'s list, and take it back', async ({ page }) => {
    await openAs(page)
    await page.getByRole('button', { name: 'Lists' }).click()
    await page.getByRole('button', { name: /Scary October/ }).click()
    const vote = page.getByRole('button', { name: 'Vote for Wednesday' })
    await expect(vote).toHaveText(/1/)
    await vote.click()
    await expect(page.getByRole('button', { name: 'Take back your vote for Wednesday' })).toHaveText(/2/)
    // Not ours: no remove / watch actions
    await page.getByRole('button', { name: 'Options for Wednesday' }).click()
    await expect(page.getByRole('button', { name: /Remove from/ })).toHaveCount(0)
  })

  test('create a family-wide "help us pick" list and add a movie to it', async ({ page }) => {
    await openAs(page)
    await page.getByRole('button', { name: 'Lists' }).click()
    await page.getByRole('button', { name: 'New list' }).first().click()
    const editor = page.getByRole('dialog', { name: 'New list' })
    await editor.getByRole('textbox', { name: 'List name' }).fill('Movie night')
    await editor.getByRole('radio', { name: /Whole family/ }).click()
    await editor.getByRole('switch', { name: 'Help us pick' }).click()
    await editor.getByRole('button', { name: 'Create list' }).click()
    await page.getByRole('button', { name: /Movie night/ }).click()
    await page.getByRole('button', { name: 'Add a show or movie' }).click()
    await page.getByRole('tab', { name: 'Movies' }).click()
    await page.getByRole('searchbox', { name: 'Search movies' }).fill('dune')
    await page.getByRole('button', { name: 'Add Dune: Part Two to Movie night' }).click()
    await expect(page.getByText('Dune: Part Two saved to 🍿 Movie night')).toBeVisible()
  })
})
