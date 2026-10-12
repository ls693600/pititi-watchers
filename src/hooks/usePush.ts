import { useEffect, useState } from 'react'
import { CLOUD_ENABLED } from '../config'
import { t } from '../i18n'
import { disablePush, enablePush, pushState, type PushState } from '../push'
import type { Store } from '../store/store'
import type { Flash } from './useToast'

/** Phone notifications on this device: current state, and turning them on or off. */
export function usePush(store: Store, ready: boolean, flash: Flash) {
  const [push, setPush] = useState<PushState>('off')
  useEffect(() => {
    if (!ready || !CLOUD_ENABLED) return
    pushState()
      .then(setPush)
      .catch(() => setPush('unsupported'))
  }, [ready])

  async function turnOn() {
    try {
      await store.savePush(await enablePush())
      setPush('on')
      flash(t("Notifications on. You'll hear about messages, @mentions and new episodes."))
    } catch (e) {
      const why = (e as Error).message
      setPush(why === 'denied' ? 'denied' : 'off')
      flash(
        why === 'denied'
          ? t('Notifications are blocked. Turn them on in your phone settings.')
          : why === 'dismissed'
            ? t('Maybe later, then.')
            : t("Couldn't turn on notifications. Try again."),
      )
    }
  }

  async function turnOff() {
    try {
      const endpoint = await disablePush()
      if (endpoint) await store.removePush(endpoint)
      setPush('off')
      flash(t('Notifications off on this phone'))
    } catch {
      flash(t("Couldn't turn them off. Try again."))
    }
  }

  return { push, turnOn, turnOff }
}
