import { expect, test } from '@playwright/test'
import { EMAIL, fakeSupabase } from './fake-supabase'

async function signIn(page: import('@playwright/test').Page, password: string) {
  await page.goto('/')
  await page.getByLabel('Email').fill(EMAIL)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click()
}

async function openChangePassword(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Your profile and settings' }).click()
  await page.getByRole('button', { name: 'Change password' }).click()
  return page.getByRole('dialog', { name: 'Change password' })
}

test.describe('Change and reset password', () => {
  test('change password: checks the current one, then the new one works for signing in', async ({ page }) => {
    const fake = await fakeSupabase(page)
    await signIn(page, 'old-pass-1')
    const sheet = await openChangePassword(page)

    // Wrong current password: nothing changes
    await sheet.getByLabel('Current password').fill('nope-nope')
    await sheet.getByLabel('New password', { exact: true }).fill('new-pass-2')
    await sheet.getByLabel('New password again').fill('new-pass-2')
    await sheet.getByRole('button', { name: 'Save new password' }).click()
    await expect(sheet.getByRole('alert')).toHaveText("That's not your current password.")
    expect(fake.passwordUpdates).toBe(0)

    await sheet.getByLabel('Current password').fill('old-pass-1')
    await sheet.getByRole('button', { name: 'Save new password' }).click()
    await expect(sheet).toBeHidden()
    await expect(page.getByText('Password changed. Use the new one next time you sign in.')).toBeVisible()
    expect(fake.password).toBe('new-pass-2')

    // Sign out, the old password no longer works, the new one does
    await page.getByRole('button', { name: 'Sign out' }).click()
    await page.getByLabel('Email').fill(EMAIL)
    await page.getByLabel('Password', { exact: true }).fill('old-pass-1')
    await page.getByRole('button', { name: 'Sign in', exact: true }).last().click()
    await expect(page.getByRole('alert')).toHaveText('Wrong email or password.')
    await page.getByLabel('Password', { exact: true }).fill('new-pass-2')
    await page.getByRole('button', { name: 'Sign in', exact: true }).last().click()
    await expect(page.getByRole('button', { name: 'Your profile and settings' })).toBeVisible()
  })

  test('change password: short, mismatched and same-as-old are caught before saving', async ({ page }) => {
    const fake = await fakeSupabase(page)
    await signIn(page, 'old-pass-1')
    const sheet = await openChangePassword(page)
    const save = sheet.getByRole('button', { name: 'Save new password' })

    await save.click()
    await expect(sheet.getByRole('alert')).toHaveText('Enter your current password.')
    await sheet.getByLabel('Current password').fill('old-pass-1')
    await sheet.getByLabel('New password', { exact: true }).fill('abc12')
    await sheet.getByLabel('New password again').fill('abc12')
    await save.click()
    await expect(sheet.getByRole('alert')).toHaveText('Use at least 6 characters for the password.')
    await sheet.getByLabel('New password', { exact: true }).fill('abc123')
    await sheet.getByLabel('New password again').fill('abc124')
    await save.click()
    await expect(sheet.getByRole('alert')).toHaveText("The two new passwords don't match.")
    await sheet.getByLabel('New password', { exact: true }).fill('old-pass-1')
    await sheet.getByLabel('New password again').fill('old-pass-1')
    await save.click()
    await expect(sheet.getByRole('alert')).toHaveText('Pick a password different from the old one.')
    expect(fake.passwordUpdates).toBe(0)

    // Show passwords reveals what was typed; Escape closes without saving
    await sheet.getByLabel('Show passwords').check()
    await expect(sheet.getByLabel('New password', { exact: true })).toHaveAttribute('type', 'text')
    await page.keyboard.press('Escape')
    await expect(sheet).toBeHidden()
  })

  test('forgot password: needs the email, then sends the link', async ({ page }) => {
    const fake = await fakeSupabase(page)
    await page.goto('/')
    const forgot = page.getByRole('button', { name: 'Forgot password?' })
    await forgot.click()
    await expect(page.getByRole('alert')).toContainText('Type your email above first')
    expect(fake.resets).toEqual([])

    await page.getByLabel('Email').fill(EMAIL)
    await forgot.click()
    await expect(page.getByRole('status')).toContainText(`If ${EMAIL} has an account, a link to choose a new password is on its way.`)
    expect(fake.resets).toEqual([EMAIL])

    // Only on Sign in, not Create account
    await page.getByRole('tab', { name: 'Create account' }).click()
    await expect(forgot).toBeHidden()
  })

  test('opening the reset link asks for a new password and saves it', async ({ page }) => {
    const fake = await fakeSupabase(page)
    await page.goto('/#access_token=test-token&refresh_token=test-refresh&expires_in=3600&token_type=bearer&type=recovery')
    const sheet = page.getByRole('dialog', { name: 'Choose a new password' })
    await expect(sheet).toBeVisible()
    await expect(sheet.getByLabel('Current password')).toHaveCount(0)
    await sheet.getByLabel('New password', { exact: true }).fill('fresh-pass-3')
    await sheet.getByLabel('New password again').fill('fresh-pass-3')
    await sheet.getByRole('button', { name: 'Save new password' }).click()
    await expect(sheet).toBeHidden()
    await expect(page.getByText('New password saved.', { exact: false })).toBeVisible()
    expect(fake.password).toBe('fresh-pass-3')
    // The one-time token is gone from the address bar
    expect(page.url()).not.toContain('access_token')
  })

  test('Portuguese: change password and forgot password read naturally', async ({ page }) => {
    await fakeSupabase(page)
    await page.addInitScript(() => localStorage.setItem('pititi.lang', 'pt'))
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Esqueceu a senha?' })).toBeVisible()
  })
})
