import { expect, test, type Page } from '@playwright/test'
import { weekOf } from '../../src/weeklyPicks'
import { L, openAs, TEST_NOW } from './family'
import fs from 'node:fs'

const picks = JSON.parse(fs.readFileSync(new URL('./weekly-picks.data.json', import.meta.url), 'utf8')) as { title: string }[]

const thisWeek = { 'pititi.weekly.v1': { week: weekOf(TEST_NOW), items: picks } }
// Home's Tonight area: the Trending chip shows the week's picks
const rail = (page: Page) => page.getByRole('region', { name: 'Trending' })
const scrollX = (page: Page) => page.locator('.weekly-rail').evaluate((el) => el.scrollLeft)

test.describe('Picks of the week', () => {
  test('a ranked rail of at least 10 picks in Tonight, marking what you watched or saved', async ({ page }) => {
    await openAs(page, L, { extra: thisWeek })
    const r = rail(page)
    await expect(page.getByRole('tab', { name: /Trending/ })).toHaveAttribute('aria-selected', 'true')
    // Only the first copy is reachable; the looping copy is hidden from screen readers
    const cards = r.getByRole('button', { name: /^Number \d+:/ })
    await expect(cards).toHaveCount(picks.length)
    expect(picks.length).toBeGreaterThanOrEqual(10)
    await expect(r.getByRole('button', { name: /^Number 1: .*rated [\d.]+ out of 10/ })).toBeVisible()
    await expect(r.locator('.weekly-item:not([aria-hidden])', { hasText: 'Lioness' })).toContainText('You watched it')
    await expect(r.locator('.weekly-item:not([aria-hidden])', { hasText: 'Severance' })).toContainText('On a list')
    // A selling point: Tonight sits right under the Family chat, above Currently watching and the month
    const order = await page.evaluate(() => {
      const all = [...document.querySelectorAll('.chat-strip, .hero, .monthbar, .tonight')]
      return all.map((el) => (el.classList.contains('tonight') ? 'tonight' : el.classList.contains('monthbar') ? 'month' : el.classList.contains('chat-strip') ? 'chat' : 'watching'))
    })
    expect(order.indexOf('tonight')).toBeGreaterThan(order.indexOf('chat'))
    expect(order.indexOf('tonight')).toBeLessThan(order.indexOf('watching'))
    expect(order.indexOf('watching')).toBeLessThan(order.indexOf('month'))
  })

  test('drifts by itself, and holds still once touched', async ({ page }) => {
    await openAs(page, L, { extra: thisWeek })
    await expect(rail(page).getByRole('button', { name: /^Number 1:/ })).toBeVisible()
    // It only drifts while on screen
    await page.locator('.weekly-rail').scrollIntoViewIfNeeded()
    const a = await scrollX(page)
    await page.waitForTimeout(1500)
    const b = await scrollX(page)
    expect(b).toBeGreaterThan(a + 10)
    await page.locator('.weekly-rail').dispatchEvent('pointerdown')
    const c = await scrollX(page)
    await page.waitForTimeout(1200)
    expect(Math.abs((await scrollX(page)) - c)).toBeLessThan(2)
  })

  test('stays still with Reduce Motion, without the looping copy', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openAs(page, L, { extra: thisWeek })
    await expect(rail(page).getByRole('button', { name: /^Number 1:/ })).toBeVisible()
    await expect(page.locator('.weekly-item')).toHaveCount(picks.length)
    const a = await scrollX(page)
    await page.waitForTimeout(1200)
    expect(await scrollX(page)).toBe(a)
  })

  test('a poster opens the picks with that title highlighted; Save goes to a list', async ({ page }) => {
    // The rail drifts by itself; on slow machines a moving poster never counts as "still" for a tap (drift has its own test)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openAs(page, L, { extra: thisWeek })
    const first = picks[0]
    await rail(page).getByRole('button', { name: new RegExp(`^Number 1: ${first.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }).click()
    const sheet = page.getByRole('dialog', { name: 'Picks of the week' })
    await expect(sheet).toBeVisible()
    await expect(sheet.locator('.pick.focused')).toContainText(first.title)
    await sheet.locator('.pick.focused').getByRole('button', { name: `Save ${first.title} to a list` }).click()
    await expect(page.getByRole('dialog').filter({ hasText: first.title }).last()).toBeVisible()
  })

  test('See all lists every pick; viewers browse without Save', async ({ page }) => {
    await openAs(page, 'p-guest', { extra: thisWeek })
    await rail(page).getByRole('button', { name: 'See all' }).click()
    const sheet = page.getByRole('dialog', { name: 'Picks of the week' })
    await expect(sheet.locator('.pick')).toHaveCount(picks.length)
    await expect(sheet.getByRole('button', { name: /^Save / })).toHaveCount(0)
  })

  test('fetched once a week from the server; hidden when the server has nothing', async ({ page }) => {
    await openAs(page, L)
    // Default server answer isn't a list: no section, no error
    await expect(page.getByRole('heading', { name: 'Currently watching' })).toBeVisible()
    await expect(rail(page)).toHaveCount(0)
    await page.route('**/functions/v1/tmdb**', (route) =>
      new URL(route.request().url()).searchParams.get('trending') === 'week' ? route.fulfill({ json: picks }) : route.fallback(),
    )
    await page.reload()
    await expect(rail(page).getByRole('button', { name: /^Number \d+:/ })).toHaveCount(picks.length)
    const cached = await page.evaluate(() => JSON.parse(localStorage.getItem('pititi.weekly.v1') || 'null'))
    expect(cached.items).toHaveLength(picks.length)
  })

  test('in Portuguese, with Brazilian titles', async ({ page }) => {
    await openAs(page, L, { extra: thisWeek, lang: 'pt' })
    const r = page.getByRole('region', { name: 'Em alta' })
    await expect(r.getByText('Em alta no mundo · muda toda segunda')).toBeVisible()
    await expect(r.locator('.weekly-item:not([aria-hidden])', { hasText: 'Ruptura' })).toContainText('Numa lista')
  })
})
