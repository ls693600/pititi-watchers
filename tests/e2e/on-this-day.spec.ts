import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { A, L, openAs } from './family'

// TEST_NOW is 2026-10-20: a year ago is 2025-10-20, a month ago 2026-09-20
const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
const photo = (id: string, watchId: string, personId: string, night: string) => ({ id, watchId, personId, path: pixel, url: pixel, night, createdAt: new Date(`${night}T22:00:00`).toISOString() })
const reaction = (personId: string, day: string) => ({ kind: 'tv', showId: 101, season: 2, episode: 5, personId, emoji: '🤯', createdAt: new Date(`${day}T21:30:00`).toISOString() })

const yearAgo = {
  'pititi.photos.v1': [photo('ph-1', 'w-102', A, '2025-10-20')],
  'pititi.epreactions.v1': [reaction(A, '2025-10-20')],
}

test.describe('On this day', () => {
  test('a year ago: photo first, then the reaction, under Tonight and above Currently watching', async ({ page }) => {
    await openAs(page, L, { extra: yearAgo })
    const card = page.getByRole('region', { name: 'On this day' })
    await expect(card).toContainText('On this day · 1 year ago')
    await expect(card).toContainText('1/2')
    await expect(card.getByRole('button', { name: /^1 of 2: Last Seen · Couch night photo · October 20, 2025$/ })).toBeVisible()
    await expect(card.getByRole('button', { name: /^2 of 2: Ana reacted 🤯 to S2 E5 of Lioness/ })).toBeAttached()
    // Placed right above the Currently watching shelf
    const order = await page.evaluate(() => [...document.querySelectorAll('.otd, .releases, .monthbar')].map((el) => el.className.split(' ')[0]))
    expect(order).toEqual(['otd', 'releases', 'monthbar'])
  })

  test('nothing a year or 6 months ago: falls back to a month ago', async ({ page }) => {
    await openAs(page, L, { extra: { 'pititi.epreactions.v1': [reaction(A, '2026-09-20')] } })
    const card = page.getByRole('region', { name: 'On this day' })
    await expect(card).toContainText('On this day · 1 month ago')
    await expect(card.getByRole('button', { name: /^Ana reacted 🤯 to S2 E5 of Lioness · September 20, 2026$/ })).toBeVisible()
    await expect(card).not.toContainText('1/1')
  })

  test("another household's photo never shows (no card at all)", async ({ page }) => {
    await openAs(page, L, { extra: { 'pititi.photos.v1': [photo('ph-x', 'w-103', 'p-fer', '2025-10-20')], 'pititi.epreactions.v1': [{ ...reaction('p-fer', '2025-10-20'), showId: 103, season: 4 }] } })
    await page.locator('.hero').first().waitFor()
    await expect(page.getByRole('region', { name: 'On this day' })).toHaveCount(0)
  })

  test('× hides it for the rest of the day on this phone, and it comes back tomorrow', async ({ page }) => {
    await openAs(page, L, { extra: yearAgo })
    const card = page.getByRole('region', { name: 'On this day' })
    await card.getByRole('button', { name: 'Hide On this day until tomorrow' }).click()
    await expect(card).toHaveCount(0)
    await page.reload()
    await page.locator('.hero').first().waitFor()
    await expect(card).toHaveCount(0)
    // Next day: a new anchor (Oct 21 a year ago) with its own memory
    await page.clock.setFixedTime(new Date('2026-10-21T19:00:00'))
    await page.evaluate((p) => localStorage.setItem('pititi.photos.v1', JSON.stringify([p])), photo('ph-2', 'w-102', A, '2025-10-21'))
    await page.reload()
    await expect(card).toContainText('1 year ago')
  })

  test('tapping a memory opens that show', async ({ page }) => {
    await openAs(page, L, { extra: yearAgo })
    await page.getByRole('region', { name: 'On this day' }).getByRole('button', { name: /Last Seen · Couch night photo/ }).click()
    await expect(page.getByRole('heading', { name: 'Last Seen', level: 1 })).toBeVisible()
  })

  test('Customize Home turns it off on this phone', async ({ page }) => {
    await openAs(page, L, { extra: yearAgo })
    const card = page.getByRole('region', { name: 'On this day' })
    await expect(card).toBeVisible()
    await page.getByRole('button', { name: 'Customize Home' }).click()
    const sheet = page.getByRole('dialog', { name: 'Customize Home' })
    const toggle = sheet.getByRole('switch', { name: 'On this day' })
    await expect(toggle).toHaveAttribute('aria-checked', 'true')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
    await sheet.getByRole('button', { name: 'Close' }).last().click()
    await expect(card).toHaveCount(0)
    await page.reload()
    await page.locator('.hero').first().waitFor()
    await expect(card).toHaveCount(0)
  })

  test('Portuguese', async ({ page }) => {
    await openAs(page, L, { extra: yearAgo, lang: 'pt' })
    const card = page.getByRole('region', { name: 'Neste dia' })
    await expect(card).toContainText('Neste dia · há 1 ano')
    await expect(card).toContainText('Foto da noite no sofá')
    await expect(card.getByRole('button', { name: /Ana reagiu 🤯 ao T2 E5 de Lioness/ })).toBeAttached()
  })

  for (const theme of ['light', 'dark'] as const)
    test(`accessibility with the card: ${theme}`, async ({ page }, info) => {
      test.skip(info.project.name !== 'iphone-safari')
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
      await openAs(page, L, { extra: { ...yearAgo, 'pititi.theme': theme } })
      await page.evaluate((t) => localStorage.setItem('pititi.theme', t), theme)
      await page.reload()
      await page.getByRole('region', { name: 'On this day' }).waitFor()
      await page.waitForTimeout(600)
      const r = await new AxeBuilder({ page }).include('.otd').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
      expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
    })
})
