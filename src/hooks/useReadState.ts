import { useCallback, useState } from 'react'
import { threadKey } from '../logic'
import { READ_KEY } from '../lib/seen'

/** Where you last read each chat on this phone, for unread badges. */
export function useReadState() {
  const [lastRead, setLastRead] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem(READ_KEY) || '{}') as Record<string, string>
    } catch {
      return {}
    }
  })
  const markRead = useCallback((watchId: string | null) => {
    setLastRead((cur) => {
      const next = { ...cur, [threadKey(watchId)]: new Date().toISOString() }
      try {
        localStorage.setItem(READ_KEY, JSON.stringify(next))
      } catch {
        // Badges just stay a little longer
      }
      return next
    })
  }, [])
  return { lastRead, markRead }
}
