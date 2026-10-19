import { useState } from 'react'

const FALLBACKS = [
  'linear-gradient(135deg,#5b6cff,#9b5de5)',
  'linear-gradient(135deg,#ff4d6d,#ff8a3d)',
  'linear-gradient(135deg,#12b886,#0ea5e9)',
  'linear-gradient(135deg,#f59f00,#ff6b3d)',
  'linear-gradient(135deg,#e64980,#9b5de5)',
]

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
}

/** Fixed-size poster (lists, detail header). */
export function Poster({ src, name, w = 48 }: { src: string | null; name: string; w?: number }) {
  const h = Math.round(w * 1.5)
  // A poster that fails to load (offline, image gone) becomes the initials tile: Safari would shrink it to nothing
  const [failed, setFailed] = useState<string | null>(null)
  if (src && failed !== src) return <img className="poster" src={src} alt="" width={w} height={h} loading="lazy" onError={() => setFailed(src)} />
  return (
    <div className="poster poster-fallback" style={{ width: w, height: h, background: FALLBACKS[name.length % FALLBACKS.length], fontSize: w / 3 }} aria-hidden="true">
      {initials(name)}
    </div>
  )
}

/** Poster that fills its container (grid cards). */
export function PosterFill({ src, name }: { src: string | null; name: string }) {
  const [failed, setFailed] = useState<string | null>(null)
  if (src && failed !== src) return <img src={src} alt="" loading="lazy" onError={() => setFailed(src)} />
  return (
    <div className="poster-fallback" style={{ background: FALLBACKS[name.length % FALLBACKS.length] }} aria-hidden="true">
      {initials(name)}
    </div>
  )
}
