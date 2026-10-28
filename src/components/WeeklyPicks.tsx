import { useEffect, useRef, useState } from 'react'
import { getLang, t } from '../i18n'
import type { ListItem, Title, Watch } from '../types'
import { loadWeeklyPicks, type WeeklyPick } from '../weeklyPicks'
import { PicksSheet } from './FestivePicks'
import { PosterFill } from './Poster'

interface Props {
  /** Your household's logs: picks you already watched get a ✓ */
  watches: Watch[]
  /** Everything on the family's lists: picks already saved say so */
  items: ListItem[]
  readOnly?: boolean
  onSave: (title: Title) => void
}

/** Drift speed in px per second, and how long a touch holds it still. */
const SPEED = 24
const HOLD_MS = 8000

/** Home's "Picks of the week": the week's trending movies and series drifting by. Touch to stop it; tap a poster for the trailer and Save. */
export function WeeklyPicks({ watches, items, readOnly = false, onSave }: Props) {
  const [picks, setPicks] = useState<WeeklyPick[] | null>(null)
  const [sheet, setSheet] = useState<{ focus: string | null } | null>(null)
  const rail = useRef<HTMLUListElement>(null)
  const still = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const pt = getLang() === 'pt'

  useEffect(() => {
    let alive = true
    loadWeeklyPicks().then((p) => alive && setPicks(p))
    return () => {
      alive = false
    }
  }, [])

  const ready = picks != null && picks.length > 0
  useEffect(() => {
    const el = rail.current
    if (!ready || still || !el) return
    let raf = 0
    let last = 0
    let pos = el.scrollLeft
    let holdUntil = 0
    let onScreen = true
    const hold = () => {
      holdUntil = performance.now() + HOLD_MS
    }
    // While held, follow where the finger (or momentum) leaves it; any scroll then keeps it held
    const onScroll = () => {
      if (performance.now() < holdUntil) {
        pos = el.scrollLeft
        hold()
      }
    }
    const io = new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting
    })
    io.observe(el)
    const tick = (now: number) => {
      const dt = last ? Math.min(now - last, 64) : 0
      last = now
      if (onScreen && !document.hidden && now >= holdUntil) {
        pos += (SPEED * dt) / 1000
        // The list is there twice: past the first copy, jump back by one copy (looks seamless)
        const half = el.scrollWidth / 2
        if (half > 0 && pos >= half) pos -= half
        el.scrollLeft = pos
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    const events = ['pointerdown', 'touchstart', 'wheel', 'focusin'] as const
    events.forEach((e) => el.addEventListener(e, hold, { passive: true }))
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      events.forEach((e) => el.removeEventListener(e, hold))
      el.removeEventListener('scroll', onScroll)
    }
  }, [ready, still])

  if (picks == null)
    return (
      <section className="weekly" aria-busy="true" aria-label={t('Picks of the week')}>
        <div className="weekly-head">
          <div>
            <h2 className="h2">{t('Picks of the week')}</h2>
          </div>
        </div>
        <div className="weekly-rail" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="weekly-card skeleton" />
          ))}
        </div>
      </section>
    )
  // Nothing worth showing (offline on the first visit, or the server is down): no section, no error
  if (!ready) return null

  const watched = (p: WeeklyPick) => watches.some((w) => (w.kind ?? 'tv') === p.kind && w.showId === p.extId)
  const saved = (p: WeeklyPick) => items.some((i) => (i.kind ?? 'tv') === p.kind && i.extId === p.extId)
  const card = (p: WeeklyPick, rank: number, copy: boolean) => {
    const label = pt ? p.titlePt : p.title
    const seen = watched(p)
    const onList = !seen && saved(p)
    return (
      <li key={`${copy ? 'c' : ''}${p.kind}:${p.extId}`} className="weekly-item" aria-hidden={copy || undefined} inert={copy || undefined}>
        <button
          type="button"
          className="weekly-card"
          tabIndex={copy ? -1 : undefined}
          onClick={() => setSheet({ focus: `${p.kind}:${p.extId}` })}
          aria-label={t('Number {rank}: {title}, {kind} {year}, rated {score} out of 10', {
            rank,
            title: label,
            kind: p.kind === 'movie' ? t('movie') : t('series'),
            year: p.year ?? '',
            score: p.score.toFixed(1),
          })}
        >
          <span className={`weekly-poster${seen ? ' seen' : ''}`}>
            <PosterFill src={p.poster} name={label} />
            <span className="weekly-chip rank">#{rank}</span>
            <span className="weekly-chip score">
              <b className="gold">★</b> {p.score.toFixed(1)}
            </span>
            {seen && <span className="weekly-state">✓ {t('You watched it')}</span>}
            {onList && <span className="weekly-state">🔖 {t('On a list')}</span>}
          </span>
          <b className="weekly-title">{label}</b>
          <span className="weekly-meta">{[p.kind === 'movie' ? t('Movie') : t('Series'), p.year].filter(Boolean).join(' · ')}</span>
        </button>
      </li>
    )
  }

  return (
    <section className="weekly" aria-labelledby="weekly-title">
      <div className="weekly-head">
        <div style={{ minWidth: 0 }}>
          <h2 className="h2" id="weekly-title">
            {t('Picks of the week')}
          </h2>
          <p className="weekly-sub">{t('Trending worldwide · updated every Monday')}</p>
        </div>
        <button type="button" className="link-btn" onClick={() => setSheet({ focus: null })}>
          {t('See all')}
        </button>
      </div>
      <ul className="weekly-rail" ref={rail}>
        {picks.map((p, i) => card(p, i + 1, false))}
        {/* A second copy so the drift loops without a jump; hidden from screen readers and the keyboard */}
        {!still && picks.map((p, i) => card(p, i + 1, true))}
      </ul>
      {sheet && (
        <PicksSheet
          watches={watches}
          items={items}
          readOnly={readOnly}
          onSave={onSave}
          onClose={() => setSheet(null)}
          emoji="🍿"
          eyebrow={t('Trending worldwide · updated every Monday')}
          title={t('Picks of the week')}
          intro={t('The most popular movies and series this week, rated 7 or more by viewers. Tap a poster to watch the trailer.')}
          picks={picks}
          focus={sheet.focus}
        />
      )}
    </section>
  )
}
