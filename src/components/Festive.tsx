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

/** Little flags strung across the card, in the day's colors. */
const BUNTING: Partial<Record<Festive['id'], string[]>> = {
  junina: ['#ffd166', '#06d6a0', '#ef476f', '#118ab2', '#ffffff'],
  independencia: ['#009c3b', '#ffdf00', '#002776', '#ffffff'],
  criancas: ['#ef476f', '#ffd166', '#06d6a0', '#118ab2', '#9b5de5'],
  canadaday: ['#ffffff', '#d52b1e'],
}

/** A small drawing on the festive card: cobweb, snow, bunting… (decorative). */
export function FestiveDeco({ festive }: { festive: Festive }) {
  if (festive.id === 'halloween')
    return (
      <svg className="festive-deco web" viewBox="0 0 80 80" aria-hidden="true">
        <g fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round">
          <path d="M80 0 L20 60M80 0 L48 72M80 0 L8 30M80 0 L80 80M80 0 L0 0" />
          <path d="M66 0 Q70 9 80 14M50 0 Q58 18 80 28M34 0 Q46 28 80 44M18 0 Q34 38 80 62" />
        </g>
        <path d="M44 33 v12" stroke="currentColor" strokeWidth="1" />
        <circle cx="44" cy="48" r="3.2" fill="currentColor" />
      </svg>
    )
  const flags = BUNTING[festive.id]
  if (flags)
    return (
      <svg className="festive-deco bunting" viewBox="0 0 300 26" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 4 Q150 18 300 4" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="1.2" />
        {Array.from({ length: 12 }, (_, i) => {
          const x = 8 + i * 25
          const y = 4 + Math.sin((x / 300) * Math.PI) * 7
          return <path key={i} d={`M${x} ${y} h16 l-8 13z`} fill={flags[i % flags.length]} />
        })}
      </svg>
    )
  if (festive.id === 'christmas')
    return (
      <svg className="festive-deco snowcap" viewBox="0 0 300 16" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 0 H300 V6 Q285 14 270 7 Q255 15 238 8 Q220 16 200 7 Q182 13 165 6 Q148 15 130 8 Q110 16 92 7 Q75 13 58 6 Q40 15 22 8 Q10 13 0 7 Z" fill="#fff" />
      </svg>
    )
  return null
}

type Motion = 'fly' | 'fall' | 'rise' | 'twinkle'
const AMBIENT: Partial<Record<Festive['id'], { glyphs: string[]; motion: Motion; count: number }>> = {
  halloween: { glyphs: ['🦇'], motion: 'fly', count: 4 },
  christmas: { glyphs: ['•'], motion: 'fall', count: 26 },
  newyear: { glyphs: ['✦', '✧'], motion: 'twinkle', count: 14 },
  valentines: { glyphs: ['♥'], motion: 'rise', count: 9 },
  namorados: { glyphs: ['♥'], motion: 'rise', count: 9 },
  mothers: { glyphs: ['🌸'], motion: 'fall', count: 8 },
  stpatricks: { glyphs: ['☘'], motion: 'fall', count: 8 },
  easter: { glyphs: ['🌷', '🥚'], motion: 'fall', count: 7 },
  carnaval: { glyphs: ['▮'], motion: 'fall', count: 22 },
  junina: { glyphs: ['✦'], motion: 'twinkle', count: 10 },
  fathers: { glyphs: ['✦'], motion: 'twinkle', count: 8 },
  familyday: { glyphs: ['♥'], motion: 'rise', count: 7 },
  victoria: { glyphs: ['✦', '✧'], motion: 'twinkle', count: 12 },
  canadaday: { glyphs: ['🍁'], motion: 'fall', count: 8 },
  thanksgiving: { glyphs: ['🍂', '🍁'], motion: 'fall', count: 9 },
  independencia: { glyphs: ['▮'], motion: 'fall', count: 16 },
  criancas: { glyphs: ['🎈'], motion: 'rise', count: 7 },
  consciencia: { glyphs: ['✦'], motion: 'twinkle', count: 8 },
}

/** Confetti colors for the days that rain little paper strips. */
const CONFETTI: Partial<Record<Festive['id'], string[]>> = {
  carnaval: ['#ffcc00', '#009c3b', '#ef476f', '#118ab2'],
  independencia: ['#009c3b', '#ffdf00', '#002776'],
}

/** The day's mood behind Home: night fog and bats, snow, sparkles… Quiet, behind the cards, off with reduced motion. */
export function FestiveAmbient({ festive }: { festive: Festive }) {
  const a = AMBIENT[festive.id]
  return (
    <div className={`festive-ambient amb-${festive.id}`} aria-hidden="true">
      {a &&
        Array.from({ length: a.count }, (_, i) => (
          <span
            key={i}
            className={`amb amb-${a.motion}`}
            style={{
              left: `${(i * 37 + 11) % 100}%`,
              top: a.motion === 'fly' ? `${12 + ((i * 23) % 55)}%` : a.motion === 'twinkle' ? `${(i * 29 + 7) % 90}%` : undefined,
              animationDelay: `${-((i * 1.7) % (a.motion === 'fly' ? 18 : 9))}s`,
              animationDuration: `${(a.motion === 'fly' ? 16 : a.motion === 'twinkle' ? 3 : 11) + (i % 4) * 2}s`,
              fontSize: `${(a.motion === 'fly' ? 22 : 10) + (i % 3) * 5}px`,
              color: CONFETTI[festive.id]?.[i % (CONFETTI[festive.id]?.length ?? 1)],
            }}
          >
            {a.glyphs[i % a.glyphs.length]}
          </span>
        ))}
    </div>
  )
}
