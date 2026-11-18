import { useEffect, useMemo, useRef } from 'react'
import { badgeCount, type BadgeInput } from '../badge'
import { SEEN_KEY, readSet } from '../lib/seen'

/** Where the app leaves the real count for the service worker (sw.js reads and bumps the same entry) */
export const BADGE_CACHE = 'pititi-badge'
export const BADGE_ENTRY = '/pititi-badge-count'

/** Sets the number on the installed app's icon. Unsupported (Android shows a dot, desktop, old iOS): nothing happens. */
export async function setAppBadge(n: number): Promise<void> {
  const count = Math.max(0, Math.floor(n))
  try {
    if (count > 0 && typeof navigator.setAppBadge === 'function') await navigator.setAppBadge(count)
    else if (count === 0 && typeof navigator.clearAppBadge === 'function') await navigator.clearAppBadge()
  } catch {
    // Not allowed yet (notifications off) or not supported: no badge, nothing else changes
  }
  try {
    if ('caches' in window) await (await caches.open(BADGE_CACHE)).put(BADGE_ENTRY, new Response(String(count)))
  } catch {
    // Storage blocked: the service worker just counts from 0
  }
}

type Inputs = Omit<BadgeInput, 'seen' | 'now'> & {
  /** Signed in and the first load finished (before that the count would flash to 0) */
  ready: boolean
  /** The reveal queue: when it changes, what this phone has seen changed too */
  reveals: string[]
}

/** Keeps the app icon's number in step with what's waiting, and corrects it whenever the app comes back. */
export function useAppBadge({ ready, me, household, social, comments, lastRead, parties, answers, watches, reveals }: Inputs) {
  const count = useMemo(
    () => (ready ? badgeCount({ me, household, social, comments, lastRead, parties, answers, watches, seen: readSet(SEEN_KEY) }) : null),
    // reveals: closing one writes the seen set, so read it again
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, me, household, social, comments, lastRead, parties, answers, watches, reveals],
  )
  const latest = useRef<number | null>(null)
  useEffect(() => {
    latest.current = count
    if (count != null) void setAppBadge(count)
  }, [count])
  useEffect(() => {
    // Pushes while the app was closed bumped the icon: put the real number back
    const onVisible = () => document.visibilityState === 'visible' && latest.current != null && void setAppBadge(latest.current)
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])
  return count
}
