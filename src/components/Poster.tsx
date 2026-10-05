const FALLBACKS = ['#3C3489', '#085041', '#712B13', '#0C447C', '#72243E', '#633806']

export function Poster({ src, name, w = 44 }: { src: string | null; name: string; w?: number }) {
  const h = Math.round(w * 1.45)
  if (src) {
    return <img className="poster" src={src} alt="" width={w} height={h} loading="lazy" />
  }
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
  const bg = FALLBACKS[name.length % FALLBACKS.length]
  return (
    <div className="poster poster-fallback" style={{ width: w, height: h, background: bg }} aria-hidden="true">
      {initials}
    </div>
  )
}
