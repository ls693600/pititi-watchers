// Festive looks: the on/off preference and today's look, applied to <html data-festive>.
import { useEffect, useState, useSyncExternalStore } from 'react'
import { festiveById, festiveFor, type Festive } from './festive'

const PREF = 'pititi.festive'
const listeners = new Set<() => void>()

/** Dev previews only: ?festive=halloween shows a festive look on any day. */
export const PREVIEW_FESTIVE = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('festive') : null

function readPref(): boolean {
  try {
    return localStorage.getItem(PREF) !== 'off'
  } catch {
    return true
  }
}

export function setFestivePref(on: boolean) {
  try {
    localStorage.setItem(PREF, on ? 'on' : 'off')
  } catch {
    // Applies for this session anyway
  }
  listeners.forEach((fn) => fn())
}

export function useFestivePref(): boolean {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    readPref,
  )
}

/** Today's festive look (or none), applied to <html data-festive> so the colors change everywhere. */
export function useFestive(): Festive | null {
  const on = useFestivePref()
  // Re-check after midnight if the app stays open
  const [day, setDay] = useState(() => new Date().toDateString())
  useEffect(() => {
    const id = setInterval(() => setDay(new Date().toDateString()), 60_000)
    return () => clearInterval(id)
  }, [])
  const festive = on ? (PREVIEW_FESTIVE ? festiveById(PREVIEW_FESTIVE) : festiveFor(new Date(day))) : null
  useEffect(() => {
    const root = document.documentElement
    if (festive) root.dataset.festive = festive.id
    else delete root.dataset.festive
  }, [festive])
  return festive
}

