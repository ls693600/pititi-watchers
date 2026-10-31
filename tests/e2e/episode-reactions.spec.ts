import { expect, test } from '@playwright/test'
import { A, L, openAs } from './family'

const at = '2026-10-10T20:00:00.000Z'
const ep = (personId: string, episode: number, emoji: string) => ({ kind: 'tv', showId: 101, season: 2, episode, personId, emoji, createdAt: at })

test.describe('Episode reactions', () => {
  test('Quick mark asks how the last episode was; Undo takes the question back', async ({ page }) => {
    await openAs(page, undefined, { path: '/' })
    await page.goto('/?as=local-leandro&open=quickmark')
    const sheet = page.getByRole('dialog', { name: 'What did you watch today?' })
    await sheet.getByRole('button', { name: 'Watched episode 4 of Lioness' }).click()
    const ask = sheet.getByRole('group', { name: 'How was episode 4?' })
    await expect(sheet.getByText('How was E4?')).toBeVisible()
    await ask.getByRole('button', { name: 'Funny' }).click()
    await expect(ask.getByRole('button', { name: 'Funny' })).toHaveAttribute('aria-pressed', 'true')
    // Only the last one marked asks
    await sheet.getByRole('button', { name: 'Watched episode 5 of Lioness' }).click()
    await expect(sheet.getByText('How was E5?')).toBeVisible()
    await expect(sheet.getByText('How was E4?')).toBeHidden()
    // Undo the episode: no question about an episode that isn't marked any more
    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(sheet.getByText('How was E5?')).toBeHidden()
    // E4's emoji stuck: it's on the show page
    await sheet.getByRole('button', { name: 'Close' }).first().click()
    await page.getByRole('button', { name: 'Open Lioness' }).first().click()
    await expect(page.getByRole('button', { name: /^Episode 4: Ep 4\. 1 reaction: Funny$/ })).toBeVisible()
  })

  test('show page: the family\'s emojis per episode, the best one, and adding yours', async ({ page }) => {
    await openAs(page, L, { extra: { 'pititi.epreactions.v1': [ep('p-fer', 2, '🤯'), ep(A, 2, '😍'), ep(A, 1, '🥱'), ep('p-fer', 9, '😭')] } })
    await page.getByRole('button', { name: 'Open Lioness' }).first().click()
    const card = page.getByRole('region', { name: 'How was each episode?' })
    await expect(card.getByText('Best so far: E2')).toBeVisible()
    // Watched 3 here; E9 shows because Fernando reacted, but you can't react to it yet
    await expect(card.getByRole('button', { name: /^Episode \d+/ })).toHaveCount(9)
    await card.getByRole('button', { name: /^Episode 2: Ep 2\. 2 reactions/ }).click()
    await expect(card.getByText('Fernando')).toBeVisible()
    await expect(card.getByText('Ana')).toBeVisible()
    await card.getByRole('button', { name: /^Episode 3: Ep 3\. No reactions yet/ }).click()
    await card.getByRole('group', { name: 'How was episode 3?' }).getByRole('button', { name: 'Mind-blowing' }).click()
    await expect(card.getByRole('button', { name: /^Episode 3: Ep 3\. 1 reaction: Mind-blowing/ })).toBeVisible()
    await expect(card.getByRole('listitem').filter({ hasText: 'You' })).toContainText('🤯')
    // Same emoji again takes it back
    await card.getByRole('group', { name: 'How was episode 3?' }).getByRole('button', { name: 'Mind-blowing' }).click()
    await expect(card.getByRole('button', { name: /^Episode 3: Ep 3\. No reactions yet/ })).toBeVisible()
    await card.getByRole('button', { name: /^Episode 9/ }).click()
    await expect(card.getByRole('group', { name: 'How was episode 9?' })).toHaveCount(0)
  })

  test('Portuguese', async ({ page }) => {
    await openAs(page, undefined, { path: '/', lang: 'pt' })
    await page.goto('/?as=local-leandro&open=quickmark')
    await page.getByRole('button', { name: 'Vi o episódio 4 de Lioness' }).click()
    await expect(page.getByText('Como foi o E4?')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Engraçado' })).toBeVisible()
  })
})
