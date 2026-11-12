import { useEffect, useRef } from 'react'

// The phone's Back (Android button, browser back, edge swipe where the browser supports it) closes whatever is on
// top (a sheet, the show page, a sub-screen) instead of leaving the app.
//
// One spare history entry stays "armed" while anything is open. Back consumes it: we close the top layer and, if
// more layers are open, arm a new one. Closing a layer with its own button leaves the entry in place for the next
// layer (we never call history.back() mid-flow, which is what makes back-stacks flaky when screens swap quickly).
// If Back lands on that spare entry with nothing open, we finish the job and leave, as the person asked.

interface Layer {
  close: () => void
}

const stack: Layer[] = []
let armed = false
let listening = false

function arm() {
  if (armed) return
  window.history.pushState({ pititi: true }, '')
  armed = true
}

function listen() {
  if (listening || typeof window === 'undefined') return
  listening = true
  window.addEventListener('popstate', () => {
    armed = false
    const top = stack.pop()
    if (!top) {
      // Only the spare entry was left: this Back was meant for leaving
      window.history.back()
      return
    }
    top.close()
    if (stack.length) arm()
  })
}

/**
 * While `active`, Back calls `onClose`.
 * `key`: a layer that stays open but changes what it shows (switching tabs) re-registers without stacking more.
 */
export function useBackClose(active: boolean, onClose: () => void, key?: string): void {
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  })
  useEffect(() => {
    if (!active) return
    listen()
    const layer: Layer = { close: () => close.current() }
    stack.push(layer)
    arm()
    return () => {
      const i = stack.indexOf(layer)
      if (i !== -1) stack.splice(i, 1)
    }
  }, [active, key])
}
