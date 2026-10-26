// Which version is running, and getting the newest one onto the phone.
import { locale } from './i18n'

/** The script this page is running, e.g. "index-BKD_bZ4R.js". */
export function runningBuild(): string | null {
  const s = document.querySelector<HTMLScriptElement>('script[type="module"][src*="assets/index-"]')
  return s ? new URL(s.src).pathname.split('/').pop()! : null
}

/** Asks the server which build is current. Null when offline or unknown. */
export async function latestBuild(): Promise<string | null> {
  try {
    const res = await fetch(`./index.html?v=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return null
    return (await res.text()).match(/assets\/(index-[^"]+\.js)/)?.[1] ?? null
  } catch {
    return null
  }
}

/** Reloads into the newest version (the service worker picks up the new files too). */
export async function applyUpdate(): Promise<void> {
  const reg = await navigator.serviceWorker?.getRegistration().catch(() => undefined)
  await reg?.update().catch(() => undefined)
  window.location.reload()
}

/** "Oct 11, 2:40 PM", when this version was built. */
export function versionLabel(): string {
  const d = new Date(__APP_BUILT__)
  return `${d.toLocaleDateString(locale(), { month: 'short', day: 'numeric' })}, ${d.toLocaleTimeString(locale(), { hour: 'numeric', minute: '2-digit' })}`
}

