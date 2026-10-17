import type { Page } from '@playwright/test'

// A pretend Supabase for the sign-in screens: answers auth and data calls in the browser,
// so the real supabase-js code runs end to end without touching the family's data.
export const FAKE_URL = 'http://supabase.test'
export const EMAIL = 'ana@example.com'

export interface FakeState {
  password: string
  resets: string[]
  passwordUpdates: number
}

const user = { id: 'u2', aud: 'authenticated', role: 'authenticated', email: EMAIL, app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
const person = { id: 'p-ana', name: 'Ana', user_id: 'u2', is_admin: false, is_viewer: false, household_id: 'h1', created_at: '2026-01-01T00:00:00Z' }
const session = () => ({ access_token: 'test-token', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'test-refresh', user })

export async function fakeSupabase(page: Page, password = 'old-pass-1'): Promise<FakeState> {
  const state: FakeState = { password, resets: [], passwordUpdates: 0 }
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return
    sessionStorage.setItem('seeded', '1')
    localStorage.clear()
    localStorage.setItem('pititi.theme', 'light')
    localStorage.setItem('pititi.lang', 'en')
    localStorage.setItem('pititi.tip.hold.v1', '1')
  })
  await page.route('https://api.tvmaze.com/**', (r) => r.fulfill({ json: [] }))
  await page.route(`${FAKE_URL}/**`, async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const path = url.pathname
    const body = (() => {
      try {
        return req.postDataJSON() ?? {}
      } catch {
        return {}
      }
    })()
    if (path === '/auth/v1/token') {
      if (url.searchParams.get('grant_type') === 'refresh_token') return route.fulfill({ json: session() })
      if (body.email === EMAIL && body.password === state.password) return route.fulfill({ json: session() })
      return route.fulfill({ status: 400, json: { code: 'invalid_credentials', error_code: 'invalid_credentials', msg: 'Invalid login credentials' } })
    }
    if (path === '/auth/v1/user' && req.method() === 'GET') return route.fulfill({ json: user })
    if (path === '/auth/v1/user' && req.method() === 'PUT') {
      if (body.password === state.password)
        return route.fulfill({ status: 422, json: { code: 'same_password', error_code: 'same_password', msg: 'New password should be different from the old password.' } })
      state.password = body.password
      state.passwordUpdates++
      return route.fulfill({ json: user })
    }
    if (path === '/auth/v1/recover') {
      state.resets.push(body.email)
      return route.fulfill({ json: {} })
    }
    if (path === '/auth/v1/logout') return route.fulfill({ status: 204, body: '' })
    if (path === '/rest/v1/people') {
      const single = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object')
      return route.fulfill({ json: single ? person : [person] })
    }
    if (path.startsWith('/rest/v1/rpc/')) return route.fulfill({ json: null })
    if (path.startsWith('/rest/v1/')) return route.fulfill(req.method() === 'GET' ? { json: [] } : { status: 201, json: [] })
    return route.fulfill({ json: {} })
  })
  return state
}
