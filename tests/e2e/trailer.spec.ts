import { expect, test } from '@playwright/test'
import { openAs } from './family'

const player = (page: import('@playwright/test').Page) => page.getByRole('dialog', { name: /^Trailer of / }).locator('iframe')

test.describe('Trailers', () => {
  test('Currently watching → show page: the banner poster plays your season\'s trailer', async ({ page }) => {
    await openAs(page)
    await page.getByRole('button', { name: 'Open Lioness' }).first().click()
    await page.getByRole('button', { name: 'Watch the trailer of Lioness' }).click()
    const sheet = page.getByRole('dialog', { name: 'Trailer of Lioness' })
    await expect(sheet.getByText('Official Trailer · Season 2')).toBeVisible()
    await expect(player(page)).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/yt-tv-101-s2\?autoplay=1&playsinline=1/)
    await expect(sheet.getByRole('link', { name: 'Open in YouTube' })).toHaveAttribute('href', 'https://www.youtube.com/watch?v=yt-tv-101-s2')
    await sheet.getByRole('button', { name: 'Close' }).last().click()
    await expect(sheet).toBeHidden()
    // The Trailer button under the title does the same
    await page.getByRole('button', { name: 'Trailer', exact: true }).click()
    await expect(player(page)).toBeVisible()
  })

  test('no trailer on file: says so and offers a YouTube search', async ({ page }) => {
    await openAs(page)
    await page.getByRole('button', { name: 'Open Last Seen' }).first().click()
    await page.getByRole('button', { name: 'Watch the trailer of Last Seen' }).click()
    const sheet = page.getByRole('dialog', { name: 'Trailer of Last Seen' })
    await expect(sheet.getByText('No trailer found for this one')).toBeVisible()
    await expect(sheet.locator('iframe')).toHaveCount(0)
    await expect(sheet.getByRole('link', { name: 'Search on YouTube' })).toHaveAttribute('href', /youtube\.com\/results\?search_query=Last%20Seen%202024%20trailer/)
  })

  test('connection problem: shows an error, Try again recovers', async ({ page }) => {
    await openAs(page)
    let fail = true
    await page.route('**/functions/v1/tmdb**', (route) =>
      fail && new URL(route.request().url()).searchParams.get('trailer') ? route.fulfill({ status: 502, json: { error: 'upstream' } }) : route.fallback(),
    )
    await page.getByRole('button', { name: 'Open Lioness' }).first().click()
    await page.getByRole('button', { name: 'Watch the trailer of Lioness' }).click()
    const sheet = page.getByRole('dialog', { name: 'Trailer of Lioness' })
    await expect(sheet.getByRole('alert')).toContainText("Couldn't load the trailer")
    fail = false
    await sheet.getByRole('button', { name: 'Try again' }).click()
    await expect(player(page)).toBeVisible()
  })

  test('Add a movie: the poster in the log sheet plays the trailer; Escape closes only the trailer', async ({ page }) => {
    await openAs(page)
    await page.getByRole('button', { name: 'Add a show' }).click()
    await page.getByRole('tab', { name: 'Movies' }).click()
    await page.getByRole('searchbox', { name: 'Search movies' }).fill('dune')
    await page.getByRole('button', { name: 'Log Dune: Part Two' }).click()
    const log = page.getByRole('dialog', { name: 'Log Dune: Part Two' })
    await log.getByRole('button', { name: 'Watch the trailer of Dune: Part Two' }).click()
    await expect(player(page)).toHaveAttribute('src', /embed\/yt-movie-693134\?/)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Trailer of Dune: Part Two' })).toBeHidden()
    await expect(log).toBeVisible()
  })

  test('Add a show: the poster in the log sheet plays the trailer', async ({ page }) => {
    await openAs(page)
    await page.getByRole('button', { name: 'Add a show' }).click()
    await page.getByRole('searchbox', { name: 'Search shows' }).fill('andor')
    await page.getByRole('button', { name: 'Log Andor' }).click()
    await page.getByRole('dialog', { name: 'Log Andor' }).getByRole('button', { name: 'Watch the trailer of Andor' }).click()
    await expect(player(page)).toHaveAttribute('src', /embed\/yt-tv-\d+-s\d+\?/)
  })

  test('Portuguese', async ({ page }) => {
    await openAs(page, undefined, { lang: 'pt' })
    await page.getByRole('button', { name: 'Abrir Lioness' }).first().click()
    await page.getByRole('button', { name: 'Ver o trailer de Lioness' }).click()
    await expect(page.getByRole('dialog', { name: 'Trailer de Lioness' }).getByRole('link', { name: 'Abrir no YouTube' })).toBeVisible()
  })
})
