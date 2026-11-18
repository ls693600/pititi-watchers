import { expect, test, type Page } from '@playwright/test'
import { A, L, openAs, TEST_NOW } from './family'

const at = (sec: number) => new Date(TEST_NOW.getTime() + sec * 1000)
const later = (party: Record<string, unknown>) => ({
  id: 'party-1', hostHouseholdId: 'h1', createdBy: L, kind: 'tv', extId: 101, title: 'Lioness', poster: null, season: 2, episode: 4, runtime: 45,
  startsAt: at(2 * 3600).toISOString(), state: 'planned', playAt: null, positionSec: 0, pausedBy: null,
  updatedAt: TEST_NOW.toISOString(), createdAt: TEST_NOW.toISOString(), guests: ['h2'], ...party,
})
const room = (page: Page) => page.getByRole('dialog', { name: 'Watch party' })

test.describe('Watch party', () => {
  test('plan from the show page, 3-2-1, chat, pause for everyone, end and mark the episode', async ({ page }) => {
    await openAs(page)
    await page.getByRole('button', { name: 'Open Lioness' }).first().click()
    await page.getByRole('button', { name: /Watch party/ }).click()
    const planner = room(page)
    await expect(planner.getByText('S2 E4')).toBeVisible()
    const send = planner.getByRole('button', { name: 'Send invitations' })
    await expect(send).toBeDisabled()
    await planner.getByRole('switch', { name: 'Fernando & Lara' }).click()
    await planner.getByRole('radio', { name: 'Now' }).click()
    await send.click()
    await expect(page.getByText('Invitations sent 🎉')).toBeVisible()

    // The room opens on the lobby: you're in
    await expect(room(page).getByText('Hosted by Leandro & Ana')).toBeVisible()
    await expect(room(page).getByRole('list', { name: 'Who is coming' })).toContainText('You')
    await room(page).getByRole('button', { name: 'Start the 3-2-1 for everyone' }).click()
    await expect(room(page).getByLabel('4 seconds')).toBeVisible()
    await page.clock.setFixedTime(at(2))
    await expect(room(page).getByLabel('2 seconds')).toBeVisible()
    await page.clock.setFixedTime(at(4 + 65))
    await expect(room(page).getByText('S2 E4 · 1:05 in')).toBeVisible()

    await room(page).getByLabel('Message the party').fill('NO WAY')
    await room(page).getByRole('button', { name: 'Send' }).click()
    await room(page).getByRole('button', { name: 'React 😱' }).click()
    const chat = room(page).getByRole('log', { name: 'Party chat' })
    await expect(chat).toContainText('NO WAY')
    await expect(chat).toContainText('😱')
    await expect(chat).toContainText('1:05')

    await room(page).getByRole('button', { name: 'Pause for everyone' }).click()
    await expect(room(page).getByText('You paused at 1:05')).toBeVisible()
    await room(page).getByRole('button', { name: 'Resume for everyone (3-2-1)' }).click()
    await expect(room(page).getByText('Resuming at 1:05')).toBeVisible()

    await room(page).getByRole('button', { name: 'End the party' }).click()
    await room(page).getByRole('button', { name: 'Tap again to confirm' }).click()
    await expect(room(page).getByText("That's a wrap")).toBeVisible()
    await room(page).getByRole('button', { name: /Mark S2 E4 as watched/ }).click()
    await expect(page.getByText('Episode 4 logged')).toBeVisible()
    await expect(room(page)).toHaveCount(0)

    // Back on the show's page, where the party chat stays
    await expect(page.getByRole('heading', { name: 'Lioness', level: 1 })).toBeVisible()
    await page.getByRole('button', { name: /Watch party chat/ }).click()
    await expect(page.getByText('NO WAY')).toBeVisible()
  })

  test('an invited household sees the invitation on Home, right under the Family chat, and joins', async ({ page }) => {
    await openAs(page, 'p-fer', { extra: { 'pititi.parties.v1': [later({})], 'pititi.partyanswers.v1': [{ partyId: 'party-1', personId: L, answer: 'join' }] } })
    const card = page.getByRole('region', { name: 'Watch party' })
    await expect(card).toContainText('Leandro & Ana · Lioness S2 E4')
    await expect(card).toContainText('Leandro in')
    await card.getByRole('button', { name: 'Join' }).click()
    await expect(card).toContainText('Leandro, You in')
    await card.getByRole('button', { name: 'Open' }).click()
    await expect(room(page).getByText('Hosted by Leandro & Ana')).toBeVisible()
    // A guest can start once they said Join, but can't end someone else's party
    await expect(room(page).getByRole('button', { name: 'Start the 3-2-1 for everyone' })).toBeVisible()
    await expect(room(page).getByRole('button', { name: /Cancel the party|End the party/ })).toHaveCount(0)
  })

  test("Can't make it, and a household that wasn't invited sees nothing", async ({ page }) => {
    await openAs(page, 'p-fer', { extra: { 'pititi.parties.v1': [later({})] } })
    const card = page.getByRole('region', { name: 'Watch party' })
    await card.getByRole('button', { name: "Can't make it" }).click()
    await expect(card.getByRole('button', { name: 'I can make it after all' })).toBeVisible()

    await openAs(page, 'p-edu', { extra: { 'pititi.parties.v1': [later({})] } })
    await expect(page.getByRole('heading', { name: 'Eduarda' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Watch party' })).toHaveCount(0)
  })

  test('a party that is on shows live on Home; a notification opens its room', async ({ page }) => {
    const live = later({ state: 'paused', positionSec: 1112, pausedBy: 'p-fer', startsAt: TEST_NOW.toISOString() })
    await openAs(page, A, { extra: { 'pititi.parties.v1': [live], 'pititi.partyanswers.v1': [{ partyId: 'party-1', personId: A, answer: 'join' }] }, query: { open: 'party:party-1' } })
    await expect(room(page).getByText('Fernando paused at 18:32')).toBeVisible()
    await page.getByRole('button', { name: 'Close' }).click()
    await expect(page.getByRole('region', { name: 'Watch party' })).toContainText('Watch party · on now')
  })
})
