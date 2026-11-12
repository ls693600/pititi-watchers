// Accessibility gate: axe (WCAG 2.1 A + AA, including color contrast) on every main screen and sheet, light and dark.
// A new violation fails the build; the message names the rule and the element.
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { openAs } from './family'

const screens: [string, (p: import('@playwright/test').Page) => Promise<void>][] = [
  ['home', async () => {}],
  ['show page', async (p) => { await p.getByRole('button', { name: 'Open Lioness' }).first().click(); await p.getByRole('heading', { name: 'Lioness', level: 1 }).waitFor() }],
  ['lists', async (p) => { await p.getByRole('button', { name: 'Lists' }).click(); await p.getByRole('button', { name: /Up Next/ }).waitFor() }],
  ['list + title card', async (p) => { await p.getByRole('button', { name: 'Lists' }).click(); await p.getByRole('button', { name: /Up Next/ }).click(); await p.getByRole('button', { name: 'Options for Severance' }).click(); await p.waitForTimeout(800) }],
  ['stats', async (p) => { await p.getByRole('button', { name: 'Stats', exact: true }).click(); await p.waitForTimeout(500) }],
  ['family', async (p) => { await p.getByRole('button', { name: /^Family/ }).click(); await p.waitForTimeout(500) }],
  ['settings', async (p) => { await p.getByRole('button', { name: 'Your profile and settings' }).click(); await p.waitForTimeout(500) }],
  ['search', async (p) => { await p.getByRole('button', { name: 'Add a show' }).click(); await p.waitForTimeout(500) }],
  ['quick mark', async (p) => { await p.goto('/?as=local-leandro&open=quickmark'); await p.waitForTimeout(800) }],
]
for (const theme of ['light', 'dark'] as const)
  for (const [name, go] of screens)
    test(`accessibility: ${theme} ${name}`, async ({ page }, info) => {
      // One engine is enough: contrast and structure don't depend on it
      test.skip(info.project.name !== 'iphone-safari')
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
      await openAs(page, undefined, { extra: { 'pititi.theme': theme } })
      await page.evaluate((t) => localStorage.setItem('pititi.theme', t), theme)
      await page.reload()
      await page.waitForTimeout(600)
      await go(page)
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
      expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
    })
