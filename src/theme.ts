export type ThemePref = 'auto' | 'light' | 'dark'

const KEY = 'pititi.theme'
const COLORS = { light: '#f6f3ef', dark: '#15121b' }

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'auto'
  } catch {
    return 'auto'
  }
}

/** Auto = dark in the evening (7 PM to 7 AM), when the family watches TV. */
export function resolveTheme(pref: ThemePref, now = new Date()): 'light' | 'dark' {
  if (pref !== 'auto') return pref
  const h = now.getHours()
  return h >= 19 || h < 7 ? 'dark' : 'light'
}

export function applyTheme(pref = getThemePref()) {
  const theme = resolveTheme(pref)
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COLORS[theme])
}

export function setThemePref(pref: ThemePref) {
  try {
    localStorage.setItem(KEY, pref)
  } catch {
    // Private mode: the choice lasts until the app closes
  }
  applyTheme(pref)
}

/** Keeps Auto in step with the clock while the app stays open. */
export function watchTheme() {
  applyTheme()
  setInterval(() => applyTheme(), 60_000)
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && applyTheme())
}
