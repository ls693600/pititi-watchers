import { expect, test } from '@playwright/test'
import { EMAIL, fakeSupabase } from './fake-supabase'

const month = new Date().toISOString().slice(0, 7)
const now = new Date().toISOString()
const log = {
  id: 'w-lioness', show_id: 1, show_name: 'Lioness', poster: null, network: null, genres: [], year: '2023', season: 2,
  episodes_watched: 3, total_episodes: 8, runtime: 45, month, status: 'watching', watched_by: ['p-ana'],
  episodes_by_month: { [month]: 3 }, created_by: 'p-ana', kind: 'tv', household_id: 'h1', is_rewatch: false, notes: 'Ana wrote this',
  created_at: now, updated_at: now,
}

test.describe('Saving with Supabase', () => {
  test('marking an episode sends only what changed, and never touches anyone\'s ratings', async ({ page }) => {
    const state = await fakeSupabase(page, 'old-pass-1', { tables: { watches: [log], ratings: [{ watch_id: 'w-lioness', person_id: 'p-ana', stars: 4, score: 8 } as never] } })
    await page.goto('/')
    await page.getByLabel('Email').fill(EMAIL)
    await page.getByLabel('Password', { exact: true }).fill('old-pass-1')
    await page.getByRole('button', { name: 'Sign in', exact: true }).last().click()
    await page.getByRole('button', { name: 'Watched next' }).click()
    await expect(page.getByText('Episode 4 logged')).toBeVisible()

    const saves = state.writes.filter((w) => w.table === 'watches')
    expect(saves).toHaveLength(1)
    expect(saves[0].method).toBe('PATCH')
    expect(saves[0].query).toContain('id=eq.w-lioness')
    const sent = Object.keys(saves[0].body as object)
    expect(sent).toContain('episodes_watched')
    // Fields this change didn't touch are not sent, so another phone's edits there survive
    for (const untouched of ['notes', 'watched_by', 'show_name', 'created_at', 'household_id']) expect(sent).not.toContain(untouched)
    // Ratings: nothing deleted, nothing rewritten
    expect(state.writes.filter((w) => w.table === 'ratings')).toEqual([])
  })
})
