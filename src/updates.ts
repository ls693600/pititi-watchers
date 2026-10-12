// Which version is running, and getting the newest one onto the phone.

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

/** "Check for updates": installs right away when there's something new. */
export async function checkForUpdate(): Promise<'updating' | 'latest' | 'offline'> {
  const running = runningBuild()
  const latest = await latestBuild()
  if (!latest) return 'offline'
  // Dev previews have no built script to compare: treat as up to date
  if (!running || latest === running) return 'latest'
  await applyUpdate()
  return 'updating'
}

/** "Oct 11, 2:40 PM", when this version was built. */
export function versionLabel(): string {
  const d = new Date(__APP_BUILT__)
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
}

