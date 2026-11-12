import { expect, test } from '@playwright/test'
import { EMAIL, fakeSupabase } from './fake-supabase'

async function openSettings(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.getByLabel('Email').fill(EMAIL)
  await page.getByLabel('Password', { exact: true }).fill('old-pass-1')
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click()
  await page.getByRole('button', { name: 'Your profile and settings' }).click()
}
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString()

test.describe('App health (admin)', () => {
  test('the admin sees each job; a late one is amber', async ({ page }) => {
    await fakeSupabase(page, 'old-pass-1', { admin: true, jobRuns: [{ job: 'evening', last_ok: hoursAgo(1) }, { job: 'reminders', last_ok: hoursAgo(30) }] })
    await openSettings(page)
    const card = page.getByRole('region', { name: 'App health' })
    await expect(card).toContainText('Needs a look')
    await expect(card).toContainText('Evening reminders (hourly)')
    await expect(card).toContainText(/Late: last good run 1d ago/)
  })

  test('not the admin, or before the SQL is run: no App health section', async ({ page }) => {
    await fakeSupabase(page, 'old-pass-1', { admin: false, jobRuns: [{ job: 'evening', last_ok: hoursAgo(1) }] })
    await openSettings(page)
    await expect(page.getByRole('button', { name: 'Change password' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'App health' })).toHaveCount(0)
  })

  test('admin, SQL not run yet: hidden, no error', async ({ page }) => {
    await fakeSupabase(page, 'old-pass-1', { admin: true })
    await openSettings(page)
    await expect(page.getByRole('button', { name: 'Change password' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'App health' })).toHaveCount(0)
  })
})
