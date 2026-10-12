import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { currentMonth, monthLabel, yearReview, type YearReview as Review } from '../logic'
import { drawMonthCard, shareImage } from '../share'
import { bigPoster } from '../tvmaze'
import type { Person, Watch } from '../types'
import { Avatar } from './Avatar'
import { Icon } from './Icon'
import { PosterFill } from './Poster'
import { AvgStars } from './Stars'
import { t } from '../i18n'

const SLIDE_MS = 6500

interface Props {
  year: number
  watches: Watch[]
  people: Person[]
  onClose: () => void
  onFlash: (msg: string) => void
}

interface Slide {
  id: string
  tone: string
  body: ReactNode
}

function names(people: Person[], ids: string[]): string {
  const list = people.filter((p) => ids.includes(p.id)).map((p) => p.name)
  return list.length <= 2 ? list.join(' & ') : `${list.slice(0, -1).join(', ')} & ${list[list.length - 1]}`
}

function buildSlides(r: Review, watches: Watch[], people: Person[], soFar: boolean, share: ReactNode): Slide[] {
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? t('Someone')
  const who = names(people, r.people.map((p) => p.id)) || t('The family')
  const posters = [...new Set(watches.filter((w) => w.month.startsWith(`${r.year}-`) && w.poster).map((w) => w.poster!))].slice(0, 6)
  const maxHours = Math.max(1, ...r.people.map((p) => p.hours))
  const slides: Slide[] = [
    {
      id: 'intro',
      tone: 'sunset',
      body: (
        <>
          <div className="yr-collage" aria-hidden="true">
            {posters.map((p, i) => (
              <img key={p} src={p} alt="" style={{ ['--i' as string]: i, top: (i % 2) * 40 }} />
            ))}
          </div>
          <p className="yr-kicker">Pititi Wrapped</p>
          <h2 className="yr-huge">{r.year}</h2>
          <p className="yr-sub">{soFar ? t('So far: the year {who} spent on the couch.', { who }) : t('The year {who} spent on the couch.', { who })}</p>
        </>
      ),
    },
    {
      id: 'totals',
      tone: 'violet',
      body: (
        <>
          <p className="yr-kicker">{t('Together you watched')}</p>
          <div className="yr-stats">
            <p><b>{r.shows}</b> {r.shows === 1 ? t('show') : t('shows')}</p>
            <p><b>{r.episodes}</b> {t('episodes')}</p>
            <p><b>{r.hours}</b> {t('hours')}</p>
          </div>
          {r.days >= 1 && (
            <p className="yr-sub">
              {r.days === 1 ? t("That's a full day of TV. No regrets.") : t("That's {n} full days of TV. No regrets.", { n: r.days })}
            </p>
          )}
        </>
      ),
    },
  ]
  if (r.top) {
    const w = r.top.watch
    slides.push({
      id: 'top',
      tone: 'gold',
      body: (
        <>
          <p className="yr-kicker">{t('Show of the year')}</p>
          <div className="yr-poster">{w.poster ? <img src={bigPoster(w.poster)!} alt="" /> : <PosterFill src={null} name={w.showName} />}</div>
          <h2 className="yr-title">{w.showName}</h2>
          <div className="yr-stars">
            <AvgStars value={r.top.avg} size={26} /> <b>{r.top.avg.toFixed(1)}</b>
          </div>
          <p className="yr-sub">{w.watchedBy.length > 1 ? t('Your highest family average.') : t("{name}'s top pick.", { name: nameOf(w.watchedBy[0]) })}</p>
        </>
      ),
    })
  }
  if (r.busiest) {
    slides.push({
      id: 'busiest',
      tone: 'ocean',
      body: (
        <>
          <p className="yr-kicker">{t('Busiest month')}</p>
          <h2 className="yr-huge sm">{monthLabel(r.busiest.month, 'long').split(' ')[0]}</h2>
          <p className="yr-sub">
            {r.busiest.count === 1 ? t('1 show on the go. The remote never rested.') : t('{n} shows on the go. The remote never rested.', { n: r.busiest.count })}
          </p>
        </>
      ),
    })
  }
  if (r.people.length > 1) {
    slides.push({
      id: 'people',
      tone: 'berry',
      body: (
        <>
          <p className="yr-kicker">{t('Most time on the couch')}</p>
          <h2 className="yr-title">{nameOf(r.people[0].id)} 👑</h2>
          <ul className="yr-bars">
            {r.people.map((p) => (
              <li key={p.id}>
                <Avatar people={people} id={p.id} size={34} />
                <span className="yr-bar">
                  <i style={{ width: `${Math.max(8, (p.hours / maxHours) * 100)}%` }} />
                </span>
                <b>{p.hours}h</b>
              </li>
            ))}
          </ul>
          <p className="yr-sub">
            {t('{together} watched together · {solo} solo', { together: r.together, solo: r.solo })}
          </p>
        </>
      ),
    })
  }
  if (r.genres.length) {
    slides.push({
      id: 'genres',
      tone: 'mint',
      body: (
        <>
          <p className="yr-kicker">{t('Your kind of TV')}</p>
          <ol className="yr-genres">
            {r.genres.map((g, i) => (
              <li key={g.name} style={{ ['--i' as string]: i }}>
                <span>{i + 1}</span> {g.name}
              </li>
            ))}
          </ol>
        </>
      ),
    })
  }
  if (r.disagreement) {
    const w = r.disagreement.watch
    const ids = w.watchedBy.filter((id) => w.ratings[id] != null)
    slides.push({
      id: 'fight',
      tone: 'ember',
      body: (
        <>
          <p className="yr-kicker">{t('Biggest disagreement')}</p>
          <div className="yr-poster sm">{w.poster ? <img src={bigPoster(w.poster)!} alt="" /> : <PosterFill src={null} name={w.showName} />}</div>
          <h2 className="yr-title">{w.showName}</h2>
          <div className="yr-versus">
            {ids.map((id) => (
              <span key={id}>
                <Avatar people={people} id={id} size={30} />
                <b>{w.ratings[id]}★</b>
              </span>
            ))}
          </div>
          <p className="yr-sub">{t('{n} stars apart. Still talking to each other.', { n: r.disagreement.diff })}</p>
        </>
      ),
    })
  }
  slides.push({
    id: 'end',
    tone: 'sunset',
    body: (
      <>
        <p className="yr-kicker">{t("That's a wrap")}</p>
        <h2 className="yr-huge sm">{soFar ? t('More to come') : t('See you in {year}', { year: r.year + 1 })}</h2>
        <p className="yr-sub">{t('Send it to the family group.')}</p>
        {share}
      </>
    ),
  })
  return slides
}

/** "Pititi Wrapped": a story of the family's year. Tap right for next, left for back; hold to pause. */
export function YearReview({ year, watches, people, onClose, onFlash }: Props) {
  const r = yearReview(watches, people.map((p) => p.id), year)
  const soFar = year === Number(currentMonth().slice(0, 4))
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const [sharing, setSharing] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  async function share() {
    setSharing(true)
    try {
      const top = watches
        .filter((w) => w.month.startsWith(`${year}-`))
        .map((w) => ({ w, avg: w.watchedBy.every((id) => w.ratings[id] != null) ? w.watchedBy.reduce((s, id) => s + w.ratings[id], 0) / w.watchedBy.length : null }))
        .sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0))
      const shows = [...new Map(top.map((x) => [x.w.showId, x])).values()].slice(0, 6)
      const blob = await drawMonthCard({
        monthName: String(year),
        totals: { shows: r.shows, episodes: r.episodes, hours: r.hours },
        names: names(people, r.people.map((p) => p.id)) || t('Our family'),
        shows: shows.map(({ w, avg }) => ({ name: w.showName, poster: w.poster, stars: avg, note: w.status === 'watching' ? t('Still watching') : t('Not rated yet') })),
      })
      const result = await shareImage(blob, `pititi-${year}.png`, t('Our {month} on Pititi Watchers', { month: year }))
      if (result === 'saved') onFlash(t('Picture saved. Send it from your photos or files.'))
    } catch {
      onFlash(t("Couldn't make the picture. Check your connection and try again."))
    } finally {
      setSharing(false)
    }
  }

  const shareBtn = (
    <button
      className="yr-share"
      onClick={(e) => {
        e.stopPropagation()
        share()
      }}
      disabled={sharing}
    >
      <Icon name="share" size={18} /> {sharing ? t('Making the picture…') : t('Share our {month}', { month: year })}
    </button>
  )
  const slides = buildSlides(r, watches, people, soFar, shareBtn)
  const last = slides.length - 1

  const next = useCallback(() => setI((n) => Math.min(n + 1, last)), [last])
  const back = () => setI((n) => Math.max(n - 1, 0))

  useEffect(() => {
    clearTimeout(timer.current)
    if (!paused && i < last) timer.current = setTimeout(next, SLIDE_MS)
    return () => clearTimeout(timer.current)
  }, [i, paused, last, next])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft') back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, next])

  const slide = slides[i]
  return (
    <div className={`yr tone-${slide.tone}`} role="dialog" aria-modal="true" aria-label={t('{year} in review', { year })}>
      <div className="yr-progress" aria-hidden="true">
        {slides.map((s, n) => (
          <span key={s.id}>
            <i className={n < i || (n === i && i === last) ? 'done' : n === i ? (paused ? 'now paused' : 'now') : ''} style={n === i ? { animationDuration: `${SLIDE_MS}ms` } : undefined} />
          </span>
        ))}
      </div>
      <button className="yr-close" aria-label={t('Close')} onClick={onClose}>
        <Icon name="close" size={22} stroke={2.4} />
      </button>
      <div
        className="yr-stage"
        onPointerDown={() => setPaused(true)}
        onPointerUp={() => setPaused(false)}
        onPointerCancel={() => setPaused(false)}
        onClick={(e) => {
          const x = e.clientX / window.innerWidth
          if (x < 0.3) back()
          else next()
        }}
      >
        <div className="yr-slide" key={slide.id} aria-live="polite">
          {slide.body}
        </div>
      </div>
      <p className="yr-hint" aria-hidden="true">
        {i < last ? t('Tap for next · hold to pause') : ' '}
      </p>
    </div>
  )
}
