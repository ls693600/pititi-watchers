import { expect, test } from '@playwright/test'
import { openAs } from './family'

test.describe('Quick mark and evening reminder', () => {
  test('the reminder link opens "what did you watch today?" and marks with one tap', async ({ page }) => {
    await openAs(page, undefined, { path: '/' })
    await page.goto('/?as=local-leandro&open=quickmark')
    const sheet = page.getByRole('dialog', { name: 'What did you watch today?' })
    await expect(sheet).toBeVisible()
    await sheet.getByRole('button', { name: 'Watched episode 4 of Lioness' }).click()
    await expect(page.getByText('Episode 4 logged')).toBeVisible()
    // Stays open for the next one, already one ahead
    await expect(sheet.getByRole('button', { name: 'Watched episode 5 of Lioness' })).toBeVisible()
    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(sheet.getByRole('button', { name: 'Watched episode 4 of Lioness' })).toBeVisible()
  })

  test('pick your evening reminder time in Settings', async ({ page }) => {
    await openAs(page)
    await page.getByRole('button', { name: 'Your profile and settings' }).click()
    const reminder = page.getByRole('combobox', { name: 'Evening reminder' })
    await expect(reminder).toHaveValue('')
    await reminder.selectOption('22')
    await expect(page.getByText(/Evening reminder at 10 PM/)).toBeVisible()
    await reminder.selectOption('')
    await expect(page.getByText('Evening reminder off')).toBeVisible()
  })
})
