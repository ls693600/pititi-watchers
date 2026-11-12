import { expect, test } from '@playwright/test'
import { openAs } from './family'

// With screen animations on (as on real phones): open a show from a poster and come back, by button and by Back
test.describe('Screen transitions', () => {
  test('poster → show page → back, with the animation running', async ({ page }) => {
    await openAs(page, undefined, { transitions: true })
    expect(await page.evaluate(() => 'startViewTransition' in document)).toBe(true)
    await page.getByRole('button', { name: 'Open Last Seen' }).first().click()
    await expect(page.getByRole('heading', { name: 'Last Seen', level: 1 })).toBeVisible()
    await page.waitForTimeout(500)
    await page.goBack()
    await expect(page.getByRole('heading', { name: 'Last Seen', level: 1 })).toBeHidden()
    await page.waitForTimeout(500)
    await page.getByRole('button', { name: 'Open Lioness' }).first().click()
    await expect(page.getByRole('heading', { name: 'Lioness', level: 1 })).toBeVisible()
  })

  test('Reduce motion: no animation, same result', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openAs(page, undefined, { transitions: true })
    await page.getByRole('button', { name: 'Open Last Seen' }).first().click()
    await expect(page.getByRole('heading', { name: 'Last Seen', level: 1 })).toBeVisible()
  })
})
