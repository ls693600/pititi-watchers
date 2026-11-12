import { useEffect, useState } from 'react'
import { getLang } from '../i18n'
import { getStoryPt } from '../movies'
import type { Kind } from '../types'

/**
 * The story text to show: for a series in Portuguese, TMDB's Brazilian synopsis when it has one;
 * otherwise (English, movies already in your language, or nothing found) the text we already have.
 */
export function useStory(kind: Kind, id: number, fallback: string | null): string | null {
  const pt = getLang() === 'pt' && kind === 'tv'
  const [found, setFound] = useState<{ id: number; text: string | null } | null>(null)
  useEffect(() => {
    if (!pt) return
    let alive = true
    getStoryPt(id)
      .then((text) => alive && setFound({ id, text }))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [pt, id])
  return pt && found?.id === id && found.text ? found.text : fallback
}
