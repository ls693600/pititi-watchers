// Offline saving: when a change can't reach the server (no signal), it waits here and syncs by itself later.
// Only changes that are safe to send twice are queued (saves, removals, messages...). Votes toggle, so
// replaying one late could flip it back: those still say "offline" instead of queueing.
import type { Store } from './store'
import { isLogGone } from './diff'

const KEY = 'pititi.outbox.v1'

type Queued = 'save' | 'remove' | 'addComment' | 'removeComment' | 'setReaction' | 'setEpisodeReaction' | 'addItem' | 'removeItem' | 'saveList' | 'removeList' | 'recommend' | 'answerRecommendation' | 'setMute'
const QUEUED: Queued[] = ['save', 'remove', 'addComment', 'removeComment', 'setReaction', 'setEpisodeReaction', 'addItem', 'removeItem', 'saveList', 'removeList', 'recommend', 'answerRecommendation', 'setMute']

export interface Pending {
  id: string
  op: Queued
  args: unknown[]
  at: string
}

/** No signal (as opposed to "not allowed" or a bad request, which must not be retried). */
export function isNetworkError(e: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  const msg = String((e as { message?: string })?.message ?? e)
  return /failed to fetch|load failed|networkerror|network request failed|fetch failed/i.test(msg)
}

/** Worth trying again later: no signal, an expired sign-in (renews itself), or the server having a bad moment. */
export function isRetryable(e: unknown): boolean {
  if (isNetworkError(e)) return true
  const err = e as { message?: string; code?: string; status?: number }
  if (typeof err?.status === 'number' && (err.status === 401 || err.status >= 500)) return true
  return err?.code === 'PGRST301' || /jwt expired|invalid jwt|timeout|timed out|bad gateway|service unavailable|gateway timeout|internal server error/i.test(String(err?.message ?? ''))
}

/** Already there (sent twice): counts as done. */
const isDuplicate = (e: unknown) => (e as { code?: string })?.code === '23505' || /duplicate key|already/i.test(String((e as { message?: string })?.message ?? ''))

export function readOutbox(): Pending[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]') as Pending[]
  } catch {
    return []
  }
}

function writeOutbox(list: Pending[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // Storage full: the change stays on screen until the app restarts
  }
}

/** Signing out: changes waiting on this phone belong to the person leaving, never to whoever signs in next. */
export function clearOutbox() {
  writeOutbox([])
  notify()
}

const listeners = new Set<(n: number) => void>()
/** Number of changes waiting, for the "will sync" banner. */
export function onOutbox(fn: (n: number) => void): () => void {
  listeners.add(fn)
  fn(readOutbox().length)
  return () => listeners.delete(fn)
}
const notify = () => listeners.forEach((fn) => fn(readOutbox().length))

/**
 * Wraps the cloud store: queued changes resolve right away when offline (the screen already shows them),
 * and `mirror` applies them to this phone's offline copy so they survive closing the app.
 */
export function withOutbox(store: Store, mirror: Pick<Store, Queued>): Store & { flush: () => Promise<{ sent: number; dropped: number }> } {
  const wrapped = { ...store } as Store & { flush: () => Promise<{ sent: number; dropped: number }> }
  for (const op of QUEUED) {
    const original = store[op] as (...a: unknown[]) => Promise<unknown>
    ;(wrapped as unknown as Record<string, unknown>)[op] = async (...args: unknown[]) => {
      try {
        return await original(...args)
      } catch (e) {
        if (!isNetworkError(e)) throw e
        writeOutbox([...readOutbox(), { id: crypto.randomUUID?.() ?? String(Date.now() + Math.random()), op, args, at: new Date().toISOString() }])
        await (mirror[op] as (...a: unknown[]) => Promise<unknown>)(...args).catch(() => undefined)
        notify()
        return undefined
      }
    }
  }

  let flushing: Promise<{ sent: number; dropped: number }> | null = null
  /** Sends what's waiting, oldest first. Stops at the first "try later"; drops changes the server refuses. */
  wrapped.flush = () => {
    if (flushing) return flushing
    flushing = (async () => {
      let sent = 0
      let dropped = 0
      for (const item of readOutbox()) {
        try {
          await (store[item.op] as (...a: unknown[]) => Promise<unknown>)(...item.args)
          sent++
        } catch (e) {
          if (isRetryable(e)) break
          // Already there, or the log was removed meanwhile (a late change must never bring it back): done
          if (isDuplicate(e) || isLogGone(e)) sent++
          else {
            dropped++
            console.warn('Dropped an offline change the server refused:', item.op, (e as Error).message)
          }
        }
        writeOutbox(readOutbox().filter((x) => x.id !== item.id))
      }
      notify()
      return { sent, dropped }
    })().finally(() => {
      flushing = null
    })
    return flushing
  }
  return wrapped
}
