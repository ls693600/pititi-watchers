import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { L, openAs } from './family'

// "Share to Pititi": Android shares into ?share_title/share_text/share_url; iPhone pastes a link in Search
test.describe('Share to Pititi', () => {
  test('a shared title opens "Pititi found it"; the address is cleaned', async ({ page }) => {
    await openAs(page, L, {
      query: { share_title: 'Andor | Disney+', share_text: 'Check out Andor on Disney+ https://www.disneyplus.com/series/andor/3xsQKWG00GL5' },
    })
    const sheet = page.getByRole('dialog', { name: 'Shared with Pititi' })
    await expect(sheet.getByText('Pititi found it')).toBeVisible()
    await expect(sheet.getByRole('heading', { name: 'Andor' })).toBeVisible()
    await expect(sheet.getByText('TV show · 2022 · Disney+')).toBeVisible()
    await expect(page).not.toHaveURL(/share_/)
    // Dev previews keep acting as the same person
    await expect(page).toHaveURL(/as=local-leandro/)
    // A reload doesn't share it again
    await sheet.getByRole('button', { name: 'Close' }).last().click()
    await expect(sheet).toHaveCount(0)
    await page.reload()
    await expect(page.getByRole('button', { name: 'Add a show' })).toBeVisible()
    await expect(page.getByRole('dialog', { name: 'Shared with Pititi' })).toHaveCount(0)
  })

  test('Log it opens the log flow', async ({ page }) => {
    await openAs(page, L, { query: { share_text: 'Assista Andor no Disney+' } })
    await page.getByRole('dialog', { name: 'Shared with Pititi' }).getByRole('button', { name: 'Log it' }).click()
    const log = page.getByRole('dialog')
    await expect(log.getByRole('heading', { name: 'Andor' })).toBeVisible()
    await log.getByRole('radio', { name: /Finished it/ }).click()
    await log.getByRole('button', { name: 'Log it' }).click()
    await expect(page.getByText('Andor added to October 2026')).toBeVisible()
  })

  test('Up Next saves it with the usual list picker', async ({ page }) => {
    await openAs(page, L, { query: { share_text: "Check out 'Andor' on Disney+" } })
    await page.getByRole('dialog', { name: 'Shared with Pititi' }).getByRole('button', { name: 'Up Next' }).click()
    await page
      .getByRole('dialog', { name: 'Andor' })
      .getByRole('button', { name: /Up Next/ })
      .click()
    await expect(page.getByText('Andor saved to 📌 Up Next')).toBeVisible()
  })

  test('Not this one opens Search with the title filled in', async ({ page }) => {
    await openAs(page, L, { query: { share_text: 'Watch Andor | Disney+' } })
    await page.getByRole('dialog', { name: 'Shared with Pititi' }).getByRole('button', { name: 'Not this one' }).click()
    await expect(page.getByRole('searchbox', { name: 'Search shows' })).toHaveValue('Andor')
    await expect(page.getByRole('button', { name: 'Log Andor' })).toBeVisible()
    // The next visit to Search starts empty
    await page.getByRole('button', { name: 'Home' }).click()
    await page.getByRole('button', { name: 'Add a show' }).click()
    await expect(page.getByRole('searchbox', { name: 'Search shows' })).toHaveValue('')
  })

  test('an IMDb link resolves through the TVmaze lookup', async ({ page }) => {
    await openAs(page)
    let asked = ''
    await page.route('https://api.tvmaze.com/lookup/shows**', (route) => {
      asked = new URL(route.request().url()).searchParams.get('imdb') ?? ''
      return route.fulfill({
        json: {
          id: 44778,
          name: 'Severance',
          premiered: '2022-02-18',
          genres: ['Drama', 'Mystery'],
          averageRuntime: 50,
          image: null,
          webChannel: { name: 'Apple TV+' },
        },
      })
    })
    await page.goto(`/?as=${L}&share_url=${encodeURIComponent('https://m.imdb.com/title/tt11280740/?ref_=ext_shr_lnk')}`)
    const sheet = page.getByRole('dialog', { name: 'Shared with Pititi' })
    await expect(sheet.getByRole('heading', { name: 'Severance' })).toBeVisible()
    await expect(sheet.getByText('TV show · 2022 · Apple TV+')).toBeVisible()
    expect(asked).toBe('tt11280740')
  })

  test('garbage shows a friendly empty state with Search instead', async ({ page }) => {
    await openAs(page, L, { query: { share_text: 'zzqx blorp 🙃' } })
    const sheet = page.getByRole('dialog', { name: 'Shared with Pititi' })
    await expect(sheet.getByRole('heading', { name: "Pititi couldn't tell what that was" })).toBeVisible()
    await expect(sheet.getByText('No show or movie matched "zzqx blorp".')).toBeVisible()
    await sheet.getByRole('button', { name: 'Search instead' }).click()
    await expect(page.getByRole('searchbox', { name: 'Search shows' })).toHaveValue('zzqx blorp')
  })

  test('offline: says so, and Try again works once back', async ({ page }) => {
    await openAs(page)
    await page.route('https://api.tvmaze.com/search/**', (route) => route.abort('internetdisconnected'))
    await page.route('**/functions/v1/tmdb**', (route) => route.abort('internetdisconnected'))
    await page.goto(`/?as=${L}&share_text=Andor`)
    const sheet = page.getByRole('dialog', { name: 'Shared with Pititi' })
    await expect(sheet.getByRole('heading', { name: "Couldn't look it up" })).toBeVisible()
    await page.unroute('https://api.tvmaze.com/search/**')
    await page.unroute('**/functions/v1/tmdb**')
    await sheet.getByRole('button', { name: 'Try again' }).click()
    await expect(sheet.getByRole('heading', { name: 'Andor' })).toBeVisible()
  })

  test('iPhone: Paste link in Search reads the clipboard', async ({ page }) => {
    let clip = 'https://www.tvmaze.com/shows/401/andor'
    await page.exposeFunction('readClip', () => clip)
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { readText: () => (window as unknown as { readClip: () => Promise<string> }).readClip(), writeText: async () => undefined },
      })
    })
    await openAs(page)
    await page.route('https://api.tvmaze.com/shows/401', (route) =>
      route.fulfill({
        json: { id: 401, name: 'Andor', premiered: '2022-09-21', genres: ['Drama'], averageRuntime: 50, image: null, webChannel: { name: 'Disney+' } },
      }),
    )
    await page.getByRole('button', { name: 'Add a show' }).click()

    // Nothing copied
    clip = '   '
    await page.getByRole('button', { name: 'Paste link' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Nothing copied yet' })).toBeVisible()

    clip = 'https://www.tvmaze.com/shows/401/andor'
    await page.getByRole('button', { name: 'Paste link' }).click()
    const sheet = page.getByRole('dialog', { name: 'Shared with Pititi' })
    await expect(sheet.getByRole('heading', { name: 'Andor' })).toBeVisible()
  })

  test('Paste link: a refused clipboard says how to paste instead', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { readText: () => Promise.reject(new DOMException('denied', 'NotAllowedError')), writeText: async () => undefined },
      })
    })
    await openAs(page)
    await page.getByRole('button', { name: 'Add a show' }).click()
    await page.getByRole('button', { name: 'Paste link' }).click()
    await expect(page.getByText("Pititi couldn't read what you copied.", { exact: false })).toBeVisible()
    // Pasting the link into the search box works too
    await page.getByRole('searchbox', { name: 'Search shows' }).fill('https://www.imdb.com/title/tt11280740/')
    await expect(page.getByText('That looks like a link')).toBeVisible()
    await expect(page.getByText(/Nothing matches/)).toHaveCount(0)
  })

  test('Portuguese', async ({ page }) => {
    await openAs(page, L, { lang: 'pt', query: { share_text: 'Olha só: "Andor" no Disney+ 🔥' } })
    const sheet = page.getByRole('dialog', { name: 'Compartilhado com o Pititi' })
    await expect(sheet.getByText('O Pititi achou')).toBeVisible()
    await expect(sheet.getByRole('button', { name: 'Registrar' })).toBeVisible()
    await expect(sheet.getByRole('button', { name: 'Não é esse' })).toBeVisible()
  })

  for (const theme of ['light', 'dark'] as const)
    for (const [name, text] of [
      ['found', 'Andor | Disney+'],
      ['not found', 'zzqx blorp'],
    ] as const)
      test(`accessibility: ${theme} ${name}`, async ({ page }, info) => {
        test.skip(info.project.name !== 'iphone-safari')
        await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
        await openAs(page, L, { extra: { 'pititi.theme': theme } })
        await page.evaluate((t) => localStorage.setItem('pititi.theme', t), theme)
        await page.goto(`/?as=${L}&share_text=${encodeURIComponent(text)}`)
        await expect(
          page.getByRole('dialog', { name: 'Shared with Pititi' }).getByRole('button', { name: name === 'found' ? 'Log it' : 'Search instead' }),
        ).toBeVisible()
        await page.waitForTimeout(500)
        const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
        expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
      })
})
