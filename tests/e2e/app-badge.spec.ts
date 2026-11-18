import { expect, test, type Page } from '@playwright/test'
import { A, L, openAs, TEST_NOW } from './family'

type Call = ['set', number] | ['clear']
const ago = (min: number) => new Date(TEST_NOW.getTime() - min * 60_000).toISOString()
const at = (sec: number) => new Date(TEST_NOW.getTime() + sec * 1000).toISOString()

// Fernando & Lara invited Leandro & Ana; Leandro hasn't answered yet
const invite = {
  id: 'party-1', hostHouseholdId: 'h2', createdBy: 'p-fer', kind: 'tv', extId: 103, title: 'The Bear', poster: null, season: 4, episode: 1, runtime: 30,
  startsAt: at(2 * 3600), state: 'planned', playAt: null, positionSec: 0, pausedBy: null,
  updatedAt: TEST_NOW.toISOString(), createdAt: TEST_NOW.toISOString(), guests: ['h1'],
}
const waiting = {
  'pititi.comments.v1': [{ id: 'c1', watchId: null, personId: A, text: 'Pizza tonight?', createdAt: ago(10) }],
  'pititi.parties.v1': [invite],
  'pititi.partyanswers.v1': [{ partyId: 'party-1', personId: 'p-fer', answer: 'join' }],
}

/** Records what the app asks the phone to show on its icon */
async function recordBadge(page: Page) {
  await page.addInitScript(() => {
    const calls: unknown[] = []
    Object.assign(window, { __badge: calls })
    Object.defineProperty(navigator, 'setAppBadge', { configurable: true, value: async (n?: number) => void calls.push(['set', n]) })
    Object.defineProperty(navigator, 'clearAppBadge', { configurable: true, value: async () => void calls.push(['clear']) })
  })
}
const calls = (page: Page) => page.evaluate(() => (window as unknown as { __badge: Call[] }).__badge)
const last = async (page: Page) => (await calls(page)).at(-1)
const stored = (page: Page) => page.evaluate(async () => (await (await caches.open('pititi-badge')).match('/pititi-badge-count'))?.text() ?? null)

test.describe('Badge on the app icon', () => {
  test('counts unread chat + an unanswered invitation, and goes down as you deal with them', async ({ page }) => {
    await recordBadge(page)
    await openAs(page, L, { extra: waiting })
    await expect.poll(() => last(page)).toEqual(['set', 2])
    // The service worker counts on from the real number
    await expect.poll(() => stored(page)).toBe('2')
    // Pushes while the app was closed bumped it; coming back puts the real number back
    await page.evaluate(async () => {
      await (await caches.open('pititi-badge')).put('/pititi-badge-count', new Response('7'))
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await expect.poll(() => stored(page)).toBe('2')

    // Reading the Family chat
    await page.getByRole('button', { name: 'Family chat, 1 unread. Open it' }).click()
    await expect(page.locator('.chat-list').getByText('Pizza tonight?')).toBeVisible()
    await expect.poll(() => last(page)).toEqual(['set', 1])

    // Answering the invitation clears the icon
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: /^Home/ }).click()
    await page.getByRole('region', { name: 'Watch party' }).getByRole('button', { name: 'Join' }).click()
    await expect.poll(() => last(page)).toEqual(['clear'])
    await expect.poll(() => stored(page)).toBe('0')
    // Never a number the person didn't have
    expect((await calls(page)).filter((c) => c[0] === 'set').map((c) => c[1])).toEqual([2, 2, 1])
  })

  test("another household's party, and one already answered, don't count", async ({ page }) => {
    await recordBadge(page)
    await openAs(page, L, {
      extra: {
        'pititi.parties.v1': [invite, { ...invite, id: 'party-2', hostHouseholdId: 'h3', guests: ['h4'] }],
        'pititi.partyanswers.v1': [{ partyId: 'party-1', personId: L, answer: 'no' }],
      },
    })
    await expect.poll(() => last(page)).toEqual(['clear'])
    expect((await calls(page)).some((c) => c[0] === 'set')).toBe(false)
  })

  test('a phone without icon badges (Android, older iPhones) works as before', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.addInitScript(() => {
      for (const k of ['setAppBadge', 'clearAppBadge']) delete (Navigator.prototype as unknown as Record<string, unknown>)[k]
    })
    await openAs(page, L, { extra: waiting })
    await expect(page.getByRole('button', { name: 'Family chat, 1 unread. Open it' })).toBeVisible()
    expect(await page.evaluate(() => 'setAppBadge' in navigator)).toBe(false)
    // The count is still kept for the service worker
    await expect.poll(() => stored(page)).toBe('2')
    expect(errors).toEqual([])
  })
})
