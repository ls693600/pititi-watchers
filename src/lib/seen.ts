// What this phone has already shown (reveals, badges, chat announcements), kept in localStorage.

export const SEEN_KEY = 'pititi.reveals.v2'
export const BADGES_KEY = 'pititi.badges.v1'
/** Family chat lines and reactions this phone has already announced */
export const CHAT_KEY = 'pititi.chatseen.v1'
export const READ_KEY = 'pititi.chatread.v1'

/** Null on first run (nothing recorded yet), so callers can avoid replaying history. */
export function readSet(key: string): Set<string> | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? new Set(JSON.parse(raw) as string[]) : null
  } catch {
    return null
  }
}

export function writeSet(key: string, set: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify([...set]))
  } catch {
    // Not fatal: worst case a celebration shows again
  }
}
