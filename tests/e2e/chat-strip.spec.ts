import { expect, test } from '@playwright/test'
import { A, L, openAs } from './family'

const at = (min: number) => new Date(Date.now() - min * 60_000).toISOString()
const msg = (id: string, personId: string, text: string, min: number, watchId: string | null = null) => ({ id, watchId, personId, text, createdAt: at(min) })
const home = (page: import('@playwright/test').Page) => page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: /^Home/ })

test.describe('Family chat strip on Home', () => {
  test('shows the last message and unread count, opens the Family chat, then clears', async ({ page }) => {
    await openAs(page, L, {
      extra: {
        'pititi.comments.v1': [
          msg('c1', 'p-fer', 'Sunday lunch here?', 30),
          msg('c2', A, 'Anyone saw the Lioness finale?', 5),
          // A show chat: not part of the Family chat strip
          msg('c3', 'p-lara', 'Loved this one', 1, 'w-103'),
        ],
      },
    })
    const strip = page.getByRole('button', { name: 'Family chat, 2 unread. Open it' })
    await expect(strip).toBeVisible()
    await expect(strip).toContainText('Ana: Anyone saw the Lioness finale?')
    await expect(strip.locator('.badge-count')).toHaveText('2')
    await expect(strip.locator('.chat-faces .av')).toHaveCount(2)

    await strip.click()
    await expect(page.locator('.chat-list').getByText('Sunday lunch here?')).toBeVisible()

    await home(page).click()
    await expect(page.getByRole('button', { name: 'Open the Family chat' })).toBeVisible()
    await expect(page.locator('.chat-strip .badge-count')).toHaveCount(0)
  })

  test('empty chat invites a first message, and your message shows after sending', async ({ page }) => {
    await openAs(page, L)
    const strip = page.getByRole('button', { name: 'Open the Family chat' })
    await expect(strip).toContainText('Everyone in the family, any topic')
    await strip.click()
    await page.getByRole('textbox', { name: 'Message' }).fill('pizza tonight?')
    await page.getByRole('button', { name: 'Send' }).click()
    await expect(page.locator('.chat-list').getByText('pizza tonight?')).toBeVisible()
    await home(page).click()
    await expect(page.locator('.chat-strip')).toContainText('Leandro: pizza tonight?')
  })

  test('Portuguese label', async ({ page }) => {
    await openAs(page, A, { lang: 'pt', extra: { 'pititi.comments.v1': [msg('c1', L, 'oi', 2)] } })
    const strip = page.getByRole('button', { name: 'Chat da família, mensagens novas: 1. Abrir' })
    await expect(strip).toContainText('Leandro: oi')
  })
})
