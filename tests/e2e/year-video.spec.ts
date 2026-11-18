import { expect, test, type Page } from '@playwright/test'
import { A, L, openAs } from './family'

// "Share as a video" at the end of Year in Review. The tests record a 10× shorter video
// (window.__PITITI_VIDEO_SPEED__, see src/yearVideo.ts) and catch the file at the share sheet or the download.

const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
const photo = (id: string, watchId: string, night: string) => ({ id, watchId, personId: L, path: pixel, url: pixel, night, createdAt: `${night}T22:00:00.000Z` })
const extra = {
  'pititi.photos.v1': [photo('ph-1', 'w-101', '2026-10-01'), photo('ph-2', 'w-102', '2026-10-05')],
  'pititi.epreactions.v1': [
    { kind: 'tv', showId: 102, season: 1, episode: 4, personId: L, emoji: '🤯', createdAt: '2026-10-05T22:00:00.000Z' },
    { kind: 'tv', showId: 102, season: 1, episode: 4, personId: A, emoji: '😭', createdAt: '2026-10-05T22:01:00.000Z' },
  ],
}

type Shared = { name: string; type: string; size: number; title?: string }

/** A share sheet that accepts files and remembers what it got. */
async function stubShare(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __PITITI_VIDEO_SPEED__: number; __shared: Shared[] }
    w.__PITITI_VIDEO_SPEED__ = 10
    w.__shared = []
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: (d: { files?: File[] }) => !!d?.files?.length })
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (d: { files: File[]; title?: string }) => {
        w.__shared.push({ name: d.files[0].name, type: d.files[0].type, size: d.files[0].size, title: d.title })
      },
    })
  })
}

async function openEndSlide(page: Page, lang: 'en' | 'pt' = 'en') {
  await openAs(page, L, { extra, lang })
  await page.getByRole('button', { name: lang === 'pt' ? 'Números' : 'Stats', exact: true }).click()
  await page.getByRole('button', { name: lang === 'pt' ? /^Ver nosso/ : /^Play our/ }).click()
  const review = page.getByRole('dialog', { name: /in review|retrospectiva/i })
  for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowRight')
  return review
}

/** Can this test browser record a canvas? (Playwright's WebKit builds may not.) */
const canRecord = (page: Page) =>
  page.evaluate(() => {
    if (typeof MediaRecorder === 'undefined' || typeof HTMLCanvasElement.prototype.captureStream !== 'function') return false
    return ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'].some((t) => MediaRecorder.isTypeSupported(t))
  })

test.describe('Year in Review video', () => {
  test('Share as a video: makes a real video and hands it to the share sheet', async ({ page }) => {
    await stubShare(page)
    const review = await openEndSlide(page)
    test.skip(!(await canRecord(page)), 'This test browser cannot record a canvas; the fallback test covers it')
    await review.getByRole('button', { name: 'Share as a video' }).click()
    const panel = page.getByRole('dialog', { name: 'Year video' })
    await expect(panel.getByRole('status')).toContainText(/Getting the pictures ready|Making your video/)
    await expect(panel.getByRole('button', { name: 'Cancel' })).toBeVisible()
    await expect(panel.getByRole('status')).toHaveText(/Your video is ready/, { timeout: 30_000 })
    const shared = await page.evaluate(() => (window as unknown as { __shared: Shared[] }).__shared)
    expect(shared).toHaveLength(1)
    expect(shared[0].size).toBeGreaterThan(1000)
    expect(shared[0].type).toMatch(/^video\/(mp4|webm)$/)
    expect(shared[0].name).toBe(`pititi-2026.${shared[0].type === 'video/mp4' ? 'mp4' : 'webm'}`)
    expect(shared[0].title).toBe('Our 2026 on the couch')
    // The finished video plays right there; it can be shared again or saved
    await expect(panel.locator('video')).toHaveAttribute('src', /^blob:/)
    await panel.getByRole('button', { name: 'Share video' }).click()
    await expect.poll(() => page.evaluate(() => (window as unknown as { __shared: Shared[] }).__shared.length)).toBe(2)
    const download = page.waitForEvent('download')
    await panel.getByRole('button', { name: 'Save video' }).click()
    expect((await download).suggestedFilename()).toBe(shared[0].name)
    await panel.getByRole('button', { name: 'Done' }).click()
    await expect(panel).toBeHidden()
    await expect(review.getByRole('button', { name: 'Share as a video' })).toBeFocused()
  })

  test('Save video downloads the file (in Portuguese, too)', async ({ page }) => {
    await stubShare(page)
    const review = await openEndSlide(page, 'pt')
    test.skip(!(await canRecord(page)), 'This test browser cannot record a canvas; the fallback test covers it')
    const download = page.waitForEvent('download', { timeout: 30_000 })
    await review.getByRole('button', { name: 'Salvar vídeo' }).click()
    const file = await download
    expect(file.suggestedFilename()).toMatch(/^pititi-2026\.(mp4|webm)$/)
    const { size } = await import('node:fs').then((fs) => file.path().then((p) => fs.statSync(p)))
    expect(size).toBeGreaterThan(1000)
    await expect(page.getByText('Vídeo salvo. Envie pelas suas fotos ou arquivos.')).toBeVisible()
    // Saving never opens the share sheet
    expect(await page.evaluate(() => (window as unknown as { __shared: Shared[] }).__shared.length)).toBe(0)
  })

  test('Cancel stops making the video and goes back to the last slide', async ({ page }) => {
    await page.addInitScript(() => ((window as unknown as { __PITITI_VIDEO_SPEED__: number }).__PITITI_VIDEO_SPEED__ = 1))
    const review = await openEndSlide(page)
    test.skip(!(await canRecord(page)), 'This test browser cannot record a canvas; the fallback test covers it')
    await review.getByRole('button', { name: 'Share as a video' }).click()
    const panel = page.getByRole('dialog', { name: 'Year video' })
    await expect(panel.getByRole('status')).toContainText('Making your video…')
    await panel.getByRole('button', { name: 'Cancel' }).click()
    await expect(panel).toBeHidden()
    // Escape on the panel closes only the panel, not the whole review
    await review.getByRole('button', { name: 'Share as a video' }).click()
    await expect(panel).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(panel).toBeHidden()
    await expect(review).toBeVisible()
  })

  test("a browser that can't record: a friendly note and the picture instead, never a broken button", async ({ page }) => {
    await page.addInitScript(() => {
      delete (window as { MediaRecorder?: unknown }).MediaRecorder
    })
    const review = await openEndSlide(page)
    await expect(review.getByText("This browser can't make videos yet. Share a picture instead.")).toBeVisible()
    await expect(review.getByRole('button', { name: 'Share as a video' })).toHaveCount(0)
    await expect(review.getByRole('button', { name: 'Save video' })).toHaveCount(0)
    await expect(review.getByRole('button', { name: 'Share our 2026' })).toBeVisible()
  })

  test('the real engine: records where it can, otherwise shows the fallback', async ({ page }) => {
    // No stubs: what this engine really does (WebKit = iPhone Safari's engine)
    const review = await openEndSlide(page)
    if (await canRecord(page)) await expect(review.getByRole('button', { name: 'Share as a video' })).toBeVisible()
    else await expect(review.getByText("This browser can't make videos yet. Share a picture instead.")).toBeVisible()
  })
})
