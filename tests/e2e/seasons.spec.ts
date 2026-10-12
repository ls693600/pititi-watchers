import { expect, test } from '@playwright/test'
import { openAs } from './family'

// Bug from Ana (Oct 12): finishing a season, moving to the next one on the show page, then going back
// showed the finished season as "Watching" (the dropdown rewrote the same log into the new season).
test.describe('Seasons are separate logs', () => {
  test('moving to the next season keeps the finished one finished', async ({ page }) => {
    await openAs(page)
    await page.getByRole('button', { name: 'Open Last Seen' }).first().click()
    const season = page.getByRole('combobox').first()
    await expect(season).toHaveValue('1')
    await expect(page.getByRole('radio', { name: 'Finished' })).toHaveAttribute('aria-checked', 'true')

    // Next season: a fresh log, nothing marked, not finished
    await season.selectOption('2')
    await expect(page.getByRole('combobox').first()).toHaveValue('2')
    await expect(page.getByRole('radio', { name: 'Watching' })).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByRole('combobox').first().locator('option[value="1"]')).toHaveText(/finished ✓/)

    // Back to Season 1: still the finished log, untouched
    await page.getByRole('combobox').first().selectOption('1')
    await expect(page.getByText('Season 1 · finished ✓')).toBeVisible()
    await expect(page.getByRole('radio', { name: 'Finished' })).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByText('Season 1 · 6 of 6')).toBeVisible()
  })

  test('saving the new season adds it next to the finished one', async ({ page }) => {
    await openAs(page)
    await page.getByRole('button', { name: 'Open Last Seen' }).first().click()
    await page.getByRole('combobox').first().selectOption('2')
    await page.getByRole('button', { name: /Add to October 2026/ }).click()
    await expect(page.getByText('Last Seen added to October 2026')).toBeVisible()
    const logs = await page.evaluate(() =>
      (JSON.parse(localStorage.getItem('pititi.watches.v2') || '[]') as { showName: string; season: number; status: string }[])
        .filter((w) => w.showName === 'Last Seen')
        .map((w) => `${w.season}:${w.status}`)
        .sort(),
    )
    expect(logs).toEqual(['1:done', '2:watching'])
  })
})
