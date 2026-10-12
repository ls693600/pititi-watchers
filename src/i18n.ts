// English is the app's language; Portuguese (Brazil) is one tap away (Settings, or the EN/PT button).
// t('English text', { vars }) looks up the Portuguese version and falls back to English.
import { useSyncExternalStore } from 'react'
import { PT } from './i18n.pt'

export type Lang = 'en' | 'pt'
const KEY = 'pititi.lang'
const listeners = new Set<() => void>()

function readLang(): Lang {
  try {
    return localStorage.getItem(KEY) === 'pt' ? 'pt' : 'en'
  } catch {
    return 'en'
  }
}

let current: Lang = readLang()
// Screen readers and spell-check follow the saved language from the first paint
if (typeof document !== 'undefined') document.documentElement.lang = current === 'pt' ? 'pt-BR' : 'en'

export function getLang(): Lang {
  return current
}

export function setLang(lang: Lang) {
  current = lang
  try {
    localStorage.setItem(KEY, lang)
  } catch {
    // Still switches for this session
  }
  document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en'
  listeners.forEach((fn) => fn())
}

/** Re-renders a component when the language changes. App calls it once at the top. */
export function useLang(): Lang {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    () => current,
  )
}

/** Translate. Vars fill {name}-style slots in either language. */
export function t(en: string, vars?: Record<string, string | number>): string {
  const text = current === 'pt' ? (PT[en] ?? en) : en
  return vars ? text.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`)) : text
}

/** Dates and months in the current language. */
export function locale(): string {
  return current === 'pt' ? 'pt-BR' : 'en-US'
}
