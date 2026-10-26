import { useEffect, useState } from 'react'
import { Icon } from './Icon'
import { applyUpdate, latestBuild, runningBuild } from '../updates'
import { t } from '../i18n'

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
    // Coming back to the app, and every 15 minutes while it stays open
    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
    window.addEventListener('pageshow', check)
    const timer = setInterval(check, 15 * 60_000)
    return () => {
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('focus', check)
      window.removeEventListener('pageshow', check)
      clearInterval(timer)
    }
  }, [])

  if (!ready) return null
  return (
    <div className="update-banner" role="status">
      <Icon name="sparkle" size={18} stroke={2.2} />
      <span>
        <b>{t('New version of Pititi')}</b>
        {t('Tap Update to get the latest fixes.')}
      </span>
      <button onClick={applyUpdate}>{t('Update')}</button>
    </div>
  )
}
