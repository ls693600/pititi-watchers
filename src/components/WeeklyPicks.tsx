import { useEffect, useRef, useState } from 'react'
import { getLang, t } from '../i18n'
import type { ListItem, Title, Watch } from '../types'
import { loadWeeklyPicks, type WeeklyPick } from '../weeklyPicks'
import { loadForUs, MIN_FOR_US, unwatched, type ForUsPick, type Loved } from '../forUs'
import { PicksSheet } from './FestivePicks'
import { PosterFill } from './Poster'

interface Props {
  /** Your household's logs: picks you already watched get a ✓ */
  watches: Watch[]
  /** Everything on the family's lists: picks already saved say so */
  items: ListItem[]
  readOnly?: boolean
  onSave: (title: Title) => void
  /** What the household loved (8+): adds the "For us" tab */
  loved?: Loved[]
}

type Tab = 'forus' | 'week'
const TAB_KEY = 'pititi.picks.tab'

function savedTab(): Tab {
  try {
    return localStorage.getItem(TAB_KEY) === 'week' ? 'week' : 'forus'
  } catch {
    return 'forus'
  }
}

/** "Severance, The Bear and 3 more" */
function namesOf(names: string[]): string {
  if (names.length <= 2) return names.join(t(' and '))
  return t('{names} and {n} more', { names: names.slice(0, 2).join(', '), n: names.length - 2 })
}

/** Drift speed in px per second, and how long a touch holds it still. */
const SPEED = 24
const HOLD_MS = 8000

/**
 * Home's picks: the week's trending movies and series, and (once the household loved a few titles) "For us",
 * titles like the ones you rated 8 or more. They drift by; touch to stop it; tap a poster for the trailer and Save.
 */
export function WeeklyPicks({ watches, items, readOnly = false, onSave, loved = [] }: Props) {
  const [weekly, setWeekly] = useState<WeeklyPick[] | null>(null)
  const [forUs, setForUs] = useState<ForUsPick[]>([])
  const [tab, setTab] = useState<Tab>(savedTab)
  const [sheet, setSheet] = useState<{ focus: string | null } | null>(null)
  const rail = useRef<HTMLUListElement>(null)
  const still = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const pt = getLang() === 'pt'

  useEffect(() => {
    let alive = true
    loadWeeklyPicks().then((p) => alive && setWeekly(p))
    return () => {
      alive = false
    }
  }, [])

  const lovedKey = loved.map((l) => l.ref).join(',')
  useEffect(() => {
    let alive = true
    loadForUs(loved).then((p) => alive && setForUs(p))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lovedKey])

  // Anything you've since logged drops out of "For us"
  const mine = unwatched(forUs, watches)
  const hasForUs = mine.length >= MIN_FOR_US
  const hasWeek = weekly != null && weekly.length > 0
  const current: Tab = hasForUs && (tab === 'forus' || !hasWeek) ? 'forus' : 'week'
  const picks: (WeeklyPick & { because?: string[] })[] | null = current === 'forus' ? mine : weekly
  const choose = (next: Tab) => {
    setTab(next)
    rail.current?.scrollTo({ left: 0 })
    try {
      localStorage.setItem(TAB_KEY, next)
    } catch {
      // Back to the default next time
    }
  }
  const lovedName = (ref: string) => loved.find((l) => l.ref === ref)?.title ?? null
  const becauseNames = (p: { because?: string[] }) => (p.because ?? []).map(lovedName).filter((n): n is string => !!n)

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
  }, [ready, still, current])

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
  const card = (p: WeeklyPick & { because?: string[] }, rank: number, copy: boolean) => {
    const label = pt ? p.titlePt : p.title
    const seen = watched(p)
    const onList = !seen && saved(p)
    const like = current === 'forus' ? becauseNames(p)[0] : undefined
    return (
      <li key={`${copy ? 'c' : ''}${p.kind}:${p.extId}`} className="weekly-item" aria-hidden={copy || undefined} inert={copy || undefined}>
        <button
          type="button"
          className="weekly-card"
          tabIndex={copy ? -1 : undefined}
          onClick={() => setSheet({ focus: `${p.kind}:${p.extId}` })}
          aria-label={
            like
              ? t('{title}, {kind} {year}, rated {score} out of 10. Because you loved {loved}', {
                  title: label,
                  kind: p.kind === 'movie' ? t('movie') : t('series'),
                  year: p.year ?? '',
                  score: p.score.toFixed(1),
                  loved: like,
                })
              : t('Number {rank}: {title}, {kind} {year}, rated {score} out of 10', {
                  rank,
                  title: label,
                  kind: p.kind === 'movie' ? t('movie') : t('series'),
                  year: p.year ?? '',
                  score: p.score.toFixed(1),
                })
          }
        >
          <span className={`weekly-poster${seen ? ' seen' : ''}`}>
            <PosterFill src={p.poster} name={label} />
            {current === 'week' && <span className="weekly-chip rank">#{rank}</span>}
            <span className="weekly-chip score">
              <b className="gold">★</b> {p.score.toFixed(1)}
            </span>
            {seen && <span className="weekly-state">✓ {t('You watched it')}</span>}
            {onList && <span className="weekly-state">🔖 {t('On a list')}</span>}
          </span>
          <b className="weekly-title">{label}</b>
          <span className="weekly-meta">{[p.kind === 'movie' ? t('Movie') : t('Series'), p.year].filter(Boolean).join(' · ')}</span>
          {like && (
            <span className="weekly-because" aria-hidden="true">
              <span className="heart">♥</span> {like}
            </span>
          )}
        </button>
      </li>
    )
  }

  return (
    <section className="weekly" aria-labelledby="weekly-title">
      <div className="weekly-head">
        <div style={{ minWidth: 0 }}>
          <h2 className="h2" id="weekly-title">
            {hasForUs ? t('What to watch') : t('Picks of the week')}
          </h2>
          {!hasForUs && <p className="weekly-sub">{t('Trending worldwide · updated every Monday')}</p>}
        </div>
        <button type="button" className="link-btn" onClick={() => setSheet({ focus: null })}>
          {t('See all')}
        </button>
      </div>
      {hasForUs && (
        <>
          <div className="weekly-tabs" role="tablist" aria-label={t('Which picks')}>
            {(
              [
                ['forus', '♥', t('For us')],
                ['week', '🔥', t('Trending')],
              ] as const
            )
              .filter(([id]) => id === 'forus' || hasWeek)
              .map(([id, icon, label]) => (
                <button key={id} type="button" role="tab" aria-selected={current === id} className={current === id ? 'on' : ''} onClick={() => choose(id)}>
                  <span className={id === 'forus' ? 'heart' : undefined} aria-hidden="true">{icon}</span> {label}
                </button>
              ))}
          </div>
          <p className="weekly-sub tabbed">
            {current === 'forus'
              ? t('Because you loved {names}', { names: namesOf(loved.map((l) => l.title)) })
              : t('Trending worldwide · updated every Monday')}
          </p>
        </>
      )}
      <ul className="weekly-rail" ref={rail} key={current}>
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
          {...(current === 'forus'
            ? {
                emoji: '💛',
                eyebrow: t('Because you loved {names}', { names: namesOf(loved.map((l) => l.title)) }),
                title: t('For us'),
                intro: t('Movies and series like the ones you rated 8 or more, well rated by viewers too. Tap a poster to watch the trailer.'),
                noteFor: (p: { because?: string[] }) => {
                  const names = becauseNames(p)
                  return names.length ? t('Because you loved {names}', { names: namesOf(names) }) : null
                },
              }
            : {
                emoji: '🍿',
                eyebrow: t('Trending worldwide · updated every Monday'),
                title: t('Picks of the week'),
                intro: t('The most popular movies and series this week, rated 7 or more by viewers. Tap a poster to watch the trailer.'),
              })}
          picks={picks}
          focus={sheet.focus}
        />
      )}
    </section>
  )
}
