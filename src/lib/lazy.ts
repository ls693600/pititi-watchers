import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

const RELOADED = 'pititi.chunk-reload'

/**
 * A screen's code, loaded the first time it's opened. If its file is gone (a new version was published while the
 * app was open), reload once to get the new version instead of showing an error.
 */
export function lazyPart<P extends object>(load: () => Promise<ComponentType<P>>): LazyExoticComponent<ComponentType<P>> & { preload: () => void } {
  const get = () =>
    load()
      .then((component) => {
        try {
          sessionStorage.removeItem(RELOADED)
        } catch {
          // Nothing to clear
        }
        return { default: component }
      })
      .catch((e: unknown) => {
        let tried = false
        try {
          tried = sessionStorage.getItem(RELOADED) === '1'
          if (!tried) sessionStorage.setItem(RELOADED, '1')
        } catch {
          tried = true
        }
        if (tried) throw e
        window.location.reload()
        return new Promise<{ default: ComponentType<P> }>(() => {})
      })
  const Part = lazy(get) as LazyExoticComponent<ComponentType<P>> & { preload: () => void }
  Part.preload = () => void load().catch(() => undefined)
  return Part
}

/** After the first screen is up, fetch the other screens quietly (also caches them for offline use). */
export function preloadWhenIdle(parts: { preload: () => void }[]): void {
  const run = () => parts.forEach((p) => p.preload())
  if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 4000 })
  else setTimeout(run, 1500)
}
