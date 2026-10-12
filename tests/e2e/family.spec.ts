import { expect, test } from '@playwright/test'
import { A, openAs } from './family'

test.describe('Family circle', () => {
  test('a recommendation goes to Up Next', async ({ page }) => {
    await openAs(page)
    await page.getByRole('button', { name: /^Family/ }).click()
    await expect(page.getByText('Fernando recommends a show')).toBeVisible()
    await page.getByRole('button', { name: 'Add Shrinking to Up Next' }).click()
    await expect(page.getByText('Shrinking saved to 📌 Up Next')).toBeVisible()
    await expect(page.getByText('Fernando recommends a show')).toHaveCount(0)
  })

  test('another household\'s show is read-only but you can chat', async ({ page }) => {
    await openAs(page)
    await page.getByRole('button', { name: /^Family/ }).click()
    await page.getByRole('button', { name: /Finished The Bear/ }).click()
    await expect(page.getByText(/This is Fernando & Lara's show/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0)
    await expect(page.getByRole('textbox', { name: 'Message' })).toBeVisible()
  })

  test('recommend a show to people in other households', async ({ page }) => {
    await openAs(page)
    await page.getByRole('button', { name: 'Add a show' }).click()
    await page.getByRole('searchbox', { name: 'Search shows' }).fill('andor')
    await page.getByRole('button', { name: 'More for Andor' }).click()
    const sheet = page.getByRole('dialog', { name: 'Andor' })
    await sheet.getByRole('tab', { name: 'Recommend' }).click()
    await sheet.getByRole('button', { name: /Thiago/ }).click()
    await sheet.getByRole('textbox', { name: 'Note' }).fill('Best Star Wars ever')
    await sheet.getByRole('button', { name: 'Recommend', exact: true }).click()
    await expect(page.getByText('Recommendation sent')).toBeVisible()
  })

  test('family chat: send a message and @mention', async ({ page }) => {
    await openAs(page, A)
    await page.getByRole('button', { name: /^Family/ }).click()
    await page.getByRole('tab', { name: /Chats/ }).click()
    await page.getByRole('button', { name: /Family chat/ }).click()
    await page.getByRole('button', { name: '@Leandro' }).click()
    await page.getByRole('textbox', { name: 'Message' }).type('pizza tonight?')
    await page.getByRole('button', { name: 'Send' }).click()
    await expect(page.locator('.chat-list').getByText('pizza tonight?')).toBeVisible()
    await expect(page.locator('.mention').getByText('@Leandro')).toBeVisible()
  })
})
