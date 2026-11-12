import { expect, test } from '@playwright/test'
import { openAs, seed } from './family'

// The Bear (103) is on our Up Next; Fernando & Lara finished season 4 and rated it
const bear = { id: 'i-bear', listId: 'l-up', kind: 'tv', extId: 103, title: 'The Bear', poster: null, year: '2022', genres: ['Drama', 'Comedy'], runtime: 30, network: null, addedBy: 'local-ana', votes: ['local-ana'], createdAt: '2026-10-18T20:00:00.000Z' }
const items = [...(seed['pititi.listitems.v1'] as object[]), bear]

test.describe('A title in a list: tap it to see more', () => {
  test('show: facts, where to watch, synopsis, trailer, and who in the family watched it', async ({ page }) => {
    await openAs(page, undefined, { extra: { 'pititi.listitems.v1': items } })
    await page.getByRole('button', { name: 'Lists' }).click()
    await page.getByRole('button', { name: /Up Next/ }).click()
    await page.getByRole('button', { name: 'Options for The Bear' }).click()
    const sheet = page.getByRole('dialog', { name: 'The Bear' })
    await expect(sheet.getByRole('heading', { name: 'The Bear' })).toBeVisible()
    await expect(sheet.getByText('Drama · Comedy')).toBeVisible()
    await expect(sheet.getByText(/Added by Ana/)).toBeVisible()
    await expect(sheet.getByText('8.0', { exact: false }).first()).toBeVisible()
    await expect(sheet.getByText('2 seasons')).toBeVisible()
    await expect(sheet.getByText('Streams on Disney+')).toBeVisible()
    await expect(sheet.getByText('A show.')).toBeVisible()
    const family = sheet.getByRole('region', { name: 'In the family' })
    await expect(family).toContainText('Fernando & Lara')
    await expect(family).toContainText('watched up to season 4')
    await expect(family).toContainText('9.0')
    // The list actions are still there
    await expect(sheet.getByRole('button', { name: "We're watching it" })).toBeVisible()
    await sheet.getByRole('button', { name: 'Watch the trailer of The Bear' }).click()
    await expect(page.getByRole('dialog', { name: 'Trailer of The Bear' })).toBeVisible()
  })

  test('movie: runtime and where to watch', async ({ page }) => {
    const dune = { ...bear, id: 'i-dune', kind: 'movie', extId: 693134, title: 'Dune: Part Two', genres: ['Science-Fiction'], runtime: 166 }
    await openAs(page, undefined, { extra: { 'pititi.listitems.v1': [...(seed['pititi.listitems.v1'] as object[]), dune] } })
    await page.getByRole('button', { name: 'Lists' }).click()
    await page.getByRole('button', { name: /Up Next/ }).click()
    await page.getByRole('button', { name: 'Options for Dune: Part Two' }).click()
    const sheet = page.getByRole('dialog', { name: 'Dune: Part Two' })
    await expect(sheet.getByText('2h 47m')).toBeVisible()
    await expect(sheet.getByText('Apple TV Store (rent)')).toBeVisible()
    await expect(sheet.getByText('Paul joins the Fremen.')).toBeVisible()
    await expect(sheet.getByRole('region', { name: 'In the family' })).toHaveCount(0)
  })

  test('details fail to load: says so, list actions still work, Try again recovers', async ({ page }) => {
    await openAs(page, undefined, { extra: { 'pititi.listitems.v1': items } })
    let fail = true
    await page.route('https://api.tvmaze.com/shows/103**', (route) => (fail ? route.abort() : route.fallback()))
    await page.getByRole('button', { name: 'Lists' }).click()
    await page.getByRole('button', { name: /Up Next/ }).click()
    await page.getByRole('button', { name: 'Options for The Bear' }).click()
    const sheet = page.getByRole('dialog', { name: 'The Bear' })
    await expect(sheet.getByText("Couldn't load the details. Check your connection.")).toBeVisible()
    await expect(sheet.getByRole('button', { name: "We're watching it" })).toBeVisible()
    fail = false
    await sheet.getByRole('button', { name: 'Try again' }).click()
    await expect(sheet.getByText('Streams on Disney+')).toBeVisible()
  })

  test('Portuguese', async ({ page }) => {
    await openAs(page, undefined, { lang: 'pt', extra: { 'pititi.listitems.v1': items } })
    await page.getByRole('button', { name: 'Listas' }).click()
    await page.getByRole('button', { name: /Para ver/ }).first().click()
    await page.getByRole('button', { name: 'Opções para The Bear' }).click()
    const sheet = page.getByRole('dialog', { name: 'The Bear' })
    await expect(sheet.getByText('Drama · Comédia')).toBeVisible()
    await expect(sheet.getByRole('region', { name: 'Na família' })).toContainText('assistiu até a temporada 4')
  })
})
