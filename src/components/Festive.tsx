import { useEffect, useState } from 'react'
import type { Festive } from '../festive'
import { PREVIEW_FESTIVE } from '../useFestive'

const SEEN = 'pititi.festive.seen'

/** A handful of emoji drifting down once a day, for a few seconds. Never blocks taps; skipped with reduced motion. */
export function FestiveRain({ festive }: { festive: Festive }) {
  const [show, setShow] = useState(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false
    const key = `${festive.id}:${new Date().toDateString()}`
    try {
      if (!PREVIEW_FESTIVE && localStorage.getItem(SEEN) === key) return false
      localStorage.setItem(SEEN, key)
    } catch {
      // Show it; worst case it shows again next open
    }
    return true
  })
  useEffect(() => {
    if (!show) return
    const id = setTimeout(() => setShow(false), 7000)
    return () => clearTimeout(id)
  }, [show])
  if (!show) return null
  return (
    <div className="festive-rain" aria-hidden="true">
      {Array.from({ length: 18 }, (_, i) => (
        <span
          key={i}
          style={{
            left: `${(i * 53) % 100}%`,
            animationDelay: `${(i % 6) * 0.35 + (i % 3) * 0.2}s`,
            animationDuration: `${3.6 + (i % 5) * 0.5}s`,
            fontSize: `${20 + (i % 4) * 6}px`,
          }}
        >
          {festive.particles[i % festive.particles.length]}
        </span>
      ))}
    </div>
  )
}
