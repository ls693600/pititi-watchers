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
    document.addEventListener('visibilitychange', check)
    return () => document.removeEventListener('visibilitychange', check)
  }, [])

  if (!ready) return null
  return (
    <div className="update-banner" role="status">
      <Icon name="sparkle" size={18} stroke={2.2} />
      <span>{t('A new version of Pititi is ready.')}</span>
      <button onClick={applyUpdate}>{t('Update')}</button>
    </div>
  )
}
