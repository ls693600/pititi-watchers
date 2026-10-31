import { expect, test } from '@playwright/test'
import { A, L, openAs } from './family'

// A real (tiny) PNG: the app shrinks it to JPEG like a phone photo
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR42mP8z8DwnwEJMDKgAhQZAMhEB/+pK8x1AAAAAElFTkSuQmCC', 'base64')
const file = { name: 'tonight.png', mimeType: 'image/png', buffer: PNG }
const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
const photo = (id: string, watchId: string, personId: string, night: string) => ({ id, watchId, personId, path: pixel, url: pixel, night, createdAt: `${night}T22:00:00.000Z` })

test.describe('Couch night photos', () => {
  test('add a photo on your show, see it big, remove it (asks twice)', async ({ page }) => {
    await openAs(page)
    await page.getByRole('button', { name: 'Open Lioness' }).first().click()
    const card = page.getByRole('region', { name: 'Couch nights' })
    await card.locator('input[type=file]').setInputFiles(file)
    await expect(page.getByText('Photo added')).toBeVisible()
    await expect(card.getByText('1 photo')).toBeVisible()
    await card.getByRole('button', { name: /^Photo from .+ by You$/ }).click()
    const viewer = page.getByRole('dialog', { name: /^Photo from .+ by You$/ })
    await expect(viewer.locator('img')).toHaveAttribute('src', /^data:image\/jpeg/)
    await viewer.getByRole('button', { name: 'Remove' }).click()
    await viewer.getByRole('button', { name: 'Tap again to remove' }).click()
    await expect(viewer).toBeHidden()
    await expect(page.getByText('Photo removed')).toBeVisible()
    await expect(card.getByRole('button', { name: 'Add a photo of tonight' })).toBeVisible()
  })

  test("another household's photos: you see them, but can't add or remove", async ({ page }) => {
    // Ana: not the admin (the admin may remove any photo)
    await openAs(page, A, { extra: { 'pititi.photos.v1': [photo('ph-1', 'w-103', 'p-fer', '2026-10-09')] } })
    await page.getByRole('button', { name: /^Family/ }).click()
    await page.getByRole('button', { name: /Finished The Bear/ }).click()
    const card = page.getByRole('region', { name: 'Couch nights' })
    await expect(card.getByRole('button', { name: 'Add a photo of tonight' })).toHaveCount(0)
    await card.getByRole('button', { name: /^Photo from .+ by Fernando$/ }).click()
    await expect(page.getByRole('dialog', { name: /by Fernando$/ }).getByRole('button', { name: 'Remove' })).toHaveCount(0)
  })

  test('Quick mark offers a photo of tonight once', async ({ page }) => {
    await openAs(page, undefined, { path: '/' })
    await page.goto('/?as=local-leandro&open=quickmark')
    const sheet = page.getByRole('dialog', { name: 'What did you watch today?' })
    await sheet.getByRole('button', { name: 'Watched episode 4 of Lioness' }).click()
    await sheet.locator('input[type=file]').setInputFiles(file)
    await expect(sheet.getByText("Tonight's photo is saved")).toBeVisible()
    // The next episode the same night doesn't ask again
    await sheet.getByRole('button', { name: 'Watched episode 5 of Lioness' }).click()
    await expect(sheet.getByText('How was E5?')).toBeVisible()
    await expect(sheet.getByText("Tonight's photo is saved")).toBeVisible()
  })

  test('the year review gets an album: one photo per night, ours only', async ({ page }) => {
    await openAs(page, L, {
      extra: {
        'pititi.photos.v1': [
          photo('ph-1', 'w-101', L, '2026-10-01'),
          photo('ph-2', 'w-101', A, '2026-10-01'),
          photo('ph-3', 'w-102', A, '2026-10-05'),
          photo('ph-4', 'w-103', 'p-fer', '2026-10-06'),
        ],
      },
    })
    await page.getByRole('button', { name: 'Stats', exact: true }).click()
    await page.getByRole('button', { name: /^Play our/ }).click()
    for (let i = 0; i < 8 && !(await page.getByText('Nights on the couch').isVisible()); i++) await page.keyboard.press('ArrowRight')
    await expect(page.getByText('2 nights saved in photos.')).toBeVisible()
    await expect(page.locator('.yr-album img')).toHaveCount(2)
  })
})
