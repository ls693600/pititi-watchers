import { useEffect, useState } from 'react'
import { Icon } from './Icon'

/** The script this page is running, e.g. "assets/index-BKD_bZ4R.js". */
function runningBuild(): string | null {
  const s = document.querySelector<HTMLScriptElement>('script[type="module"][src*="assets/index-"]')
  return s ? new URL(s.src).pathname.split('/').pop()! : null
}

/** Asks the server which build is current. Null when offline or unknown. */
async function latestBuild(): Promise<string | null> {
  try {
    const res = await fetch(`./index.html?v=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return null
    return (await res.text()).match(/assets\/(index-[^"]+\.js)/)?.[1] ?? null
  } catch {
    return null
  }
}

/**
 * iPhones resume a home-screen app without reloading it, so a release can sit unseen for days.
 * Each time the app comes back to the screen it checks for a newer build and offers a one-tap update.
 */
export function UpdateBanner() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!import.meta.env.PROD) return
    const running = runningBuild()
    if (!running) return
    const check = async () => {
      if (document.visibilityState !== 'visible') return
      const latest = await latestBuild()
      if (latest && latest !== running) setReady(true)
    }
    check()
    document.addEventListener('visibilitychange', check)
    return () => document.removeEventListener('visibilitychange', check)
  }, [])

  if (!ready) return null
  return (
    <div className="update-banner" role="status">
      <Icon name="sparkle" size={18} stroke={2.2} />
      <span>A new version of Pititi is ready.</span>
      <button
        onClick={async () => {
          // Let the service worker pick up the new files too, then reload into them
          const reg = await navigator.serviceWorker?.getRegistration().catch(() => undefined)
          await reg?.update().catch(() => undefined)
          window.location.reload()
        }}
      >
        Update
      </button>
    </div>
  )
}
