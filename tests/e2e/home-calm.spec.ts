import { expect, test } from '@playwright/test'
import { openAs } from './family'

test.describe('Calmer Home', () => {
  test('Currently watching comes first, then the month; Customize Home hides sections on this phone', async ({ page }) => {
    await openAs(page)
    const order = await page.evaluate(() => [...document.querySelectorAll('.hero, .monthbar')].map((el) => (el.classList.contains('hero') ? 'watching' : 'month')))
    expect(order[0]).toBe('watching')
    await page.getByRole('button', { name: 'Customize Home' }).click()
    const sheet = page.getByRole('dialog', { name: 'Customize Home' })
    await expect(sheet.getByRole('switch', { name: 'Currently watching' })).toBeDisabled()
    await sheet.getByRole('switch', { name: 'This month' }).click()
    await sheet.getByRole('switch', { name: 'Family chat' }).click()
    await sheet.getByRole('button', { name: 'Close' }).last().click()
    await expect(page.getByRole('button', { name: 'Previous month' })).toHaveCount(0)
    await expect(page.locator('.chat-strip')).toHaveCount(0)
    // Saved on this phone
    await page.reload()
    await expect(page.getByRole('button', { name: 'Previous month' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Customize Home' }).click()
    await page.getByRole('dialog', { name: 'Customize Home' }).getByRole('button', { name: 'Reset to default' }).click()
    await page.keyboard.press('Escape')
    await page.goBack()
    await expect(page.getByRole('button', { name: 'Previous month' })).toBeVisible()
  })

  test('every poster has a visible ⋯ for quick actions', async ({ page }) => {
    await openAs(page)
    await page.getByRole('button', { name: 'Quick actions for Last Seen' }).click()
    await expect(page.getByRole('dialog', { name: /Last Seen/ })).toBeVisible()
  })

  test('Portuguese', async ({ page }) => {
    await openAs(page, undefined, { lang: 'pt' })
    await page.getByRole('button', { name: 'Personalizar o Início' }).click()
    await expect(page.getByRole('dialog', { name: 'Personalizar o Início' })).toContainText('Só neste celular. Cada um ajusta o seu.')
  })
})
