// Problem reports: crashes and unexpected errors on someone's phone go to Supabase (client_errors),
// so the admin sees them in Settings. Never sends personal content: error text, where, version, phone type.
import { CLOUD_ENABLED } from './config'

const BUFFER = 'pititi.errors.v1'
const MAX_PER_SESSION = 10
const sent = new Set<string>()
let screen = ''

/** Where the person was (tab or screen), for context in the report. */
export function setErrorScreen(name: string) {
  screen = name.slice(0, 60)
}

export interface ErrorReport {
  message: string
  stack: string
  screen: string
  version: string
  user_agent: string
  at: string
}

function toReport(error: unknown): ErrorReport {
  const e = error as { message?: string; stack?: string }
  return {
    message: String(e?.message ?? error).slice(0, 500) || 'Unknown error',
    stack: String(e?.stack ?? '').slice(0, 4000),
    screen,
    version: `${__APP_SHA__} ${__APP_BUILT__.slice(0, 10)}`,
    user_agent: navigator.userAgent.slice(0, 300),
    at: new Date().toISOString(),
  }
}

/** Noise we can't act on (browser extensions, aborted fetches, no signal). */
export function ignorable(message: string): boolean {
  return /ResizeObserver loop|AbortError|The user aborted|Failed to fetch|Load failed|NetworkError|chrome-extension|safari-extension|Script error\.?$/i.test(message)
}

function buffer(): ErrorReport[] {
  try {
    return JSON.parse(localStorage.getItem(BUFFER) || '[]') as ErrorReport[]
  } catch {
    return []
  }
}

async function send(reports: ErrorReport[]): Promise<boolean> {
  if (!CLOUD_ENABLED || !reports.length) return true
  try {
    const { supabase } = await import('./store/cloud')
    const { data } = await supabase().auth.getSession()
    // Reports need a signed-in family member; before sign-in they wait on the phone
    if (!data.session) return false
    const { error } = await supabase()
      .from('client_errors')
      .insert(reports.map(({ message, stack, screen, version, user_agent }) => ({ message, stack, screen, version, user_agent })))
    return !error
  } catch {
    return false
  }
}

/** Report once per distinct problem per session; keeps a few on the phone if it can't send right now. */
export async function reportError(error: unknown) {
  const r = toReport(error)
  if (ignorable(r.message)) return
  const key = `${r.message}|${r.stack.split('\n')[1] ?? ''}`
  if (sent.has(key) || sent.size >= MAX_PER_SESSION) return
  sent.add(key)
  if (import.meta.env.DEV) console.warn('[problem report]', r.message)
  if (!(await send([r]))) {
    try {
      localStorage.setItem(BUFFER, JSON.stringify([...buffer(), r].slice(-20)))
    } catch {
      // Phone storage full: drop it
    }
  }
}

/** Sends reports that waited (offline or before sign-in). */
export async function flushErrorReports() {
  const waiting = buffer()
  if (waiting.length && (await send(waiting))) localStorage.removeItem(BUFFER)
}

/** Catch everything that isn't handled elsewhere. */
export function watchErrors() {
  window.addEventListener('error', (e) => reportError(e.error ?? e.message))
  window.addEventListener('unhandledrejection', (e) => reportError(e.reason))
}
