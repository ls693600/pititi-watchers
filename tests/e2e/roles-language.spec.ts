import { expect, test } from '@playwright/test'
import { openAs } from './family'

test.describe('Viewers, language and festive looks', () => {
  test('a viewer sees but cannot add or rate', async ({ page }) => {
    await openAs(page, 'p-guest')
    await expect(page.getByRole('heading', { name: 'Guest' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add a show' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Watched next' })).toHaveCount(0)
  })

  test('Portuguese with one tap, and back', async ({ page }) => {
    await openAs(page)
    await page.getByRole('button', { name: 'Mudar para português' }).click()
    await expect(page.getByRole('button', { name: /Listas/ })).toBeVisible()
    await expect(page.getByText('Vendo agora')).toBeVisible()
    await page.getByRole('button', { name: 'Switch to English' }).click()
    await expect(page.getByText('Currently watching')).toBeVisible()
  })

  test('festive look on its day, and the switch turns it off', async ({ page }) => {
    await openAs(page, undefined, { path: '/', extra: { 'pititi.festive': 'on' } })
    await page.goto('/?as=local-leandro&festive=halloween')
    await expect(page.getByText('Happy Halloween! Spooky picks tonight?')).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('data-festive', 'halloween')
    await page.getByRole('button', { name: 'Your profile and settings' }).click()
    await page.getByRole('switch', { name: 'Festive looks' }).click()
    await expect(page.locator('html')).not.toHaveAttribute('data-festive', 'halloween')
  })
})
