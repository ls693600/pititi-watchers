import { useEffect, useState } from 'react'
import { comebackFor, comebackOrder, finishedShows, getShowNews, markComebackSeen, seenComebacks, type Comeback } from '../comebacks'
import { locale, t } from '../i18n'
import { airLabel } from '../logic'
import type { SeasonInfo } from '../tvmaze'
import type { Watch } from '../types'
import { Icon } from './Icon'
import { PosterFill } from './Poster'

interface Props {
  /** Your household's logs */
  watches: Watch[]
  onOpen: (w: Watch) => void
  /** Start the new season from the show's latest log */
  onStart: (head: Watch, season: SeasonInfo) => void
  readOnly?: boolean
}

/** Shown before "See all" */
const VISIBLE = 3
/** TVmaze lookups at a time (it allows about 20 every 10 seconds) */
const PARALLEL = 4

const localToday = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Days from today to a date (negative: in the past). */
function daysTo(date: string, today: string): number {
  return Math.round((Date.parse(date) - Date.parse(today)) / 86_400_000)
}

function longDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(locale(), { month: 'short', day: 'numeric', year: y === new Date().getFullYear() ? undefined : 'numeric' })
}

/** The news about each finished show, checked once a day on this phone. */
function useComebacks(watches: Watch[]): Comeback[] {
  const [list, setList] = useState<Comeback[]>([])
  const shows = finishedShows(watches)
  const key = shows.map((w) => `${w.showId}:${w.season}`).join('|')
  useEffect(() => {
    let alive = true
    const today = localToday()
    const queue = [...shows]
    const found: Comeback[] = []
    const worker = async () => {
      for (let w = queue.shift(); w && alive; w = queue.shift()) {
        try {
          const c = comebackFor(w, await getShowNews(w.showId), today)
          if (c && alive) {
            found.push(c)
            setList([...found].sort(comebackOrder))
          }
        } catch {
          // TVmaze hiccup: no news for that show this time
        }
      }
    }
    setList([])
    Promise.all(Array.from({ length: PARALLEL }, worker))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return list
}

/** Home's "It's back": a new season out, a premiere date, a renewal or the end, for shows you finished. */
export function ItsBack({ watches, onOpen, onStart, readOnly = false }: Props) {
  const all = useComebacks(watches)
  const [seen, setSeen] = useState(seenComebacks)
  const [more, setMore] = useState(false)
  const news = all.filter((c) => !seen.has(c.key))
  if (!news.length) return null
  const today = localToday()
  const shown = more ? news : news.slice(0, VISIBLE)
  const dismiss = (c: Comeback) => {
    markComebackSeen(c.key)
    setSeen((s) => new Set(s).add(c.key))
  }

  const line = (c: Comeback): { what: string; when: string } => {
    const n = c.season
    if (c.type === 'out') {
      const ago = -daysTo(c.date!, today)
      return {
        what: t('Season {n} is out', { n }),
        when: [ago <= 0 ? t('Premiered today') : ago === 1 ? t('Premiered yesterday') : t('Premiered {date}', { date: longDate(c.date!) }), c.info?.episodes ? t('{n} episodes', { n: c.info.episodes }) : null]
          .filter(Boolean)
          .join(' · '),
      }
    }
    if (c.type === 'dated') {
      const left = daysTo(c.date!, today)
      return { what: t('Season {n} · {date}', { n, date: airLabel(c.date!) }), when: left === 1 ? t('Tomorrow') : t('In {n} days', { n: left }) }
    }
    if (c.type === 'renewed') return { what: t('Renewed for season {n}', { n }), when: t('Date not announced yet') }
    return { what: t('That was the final season'), when: t('The show ended {date}', { date: longDate(c.date!) }) }
  }
  const icon: Record<Comeback['type'], string> = { out: '🎉', dated: '⏳', renewed: '✅', ended: '🏁' }

  return (
    <section className="back" aria-labelledby="back-title">
      <h2 className="h2" id="back-title">
        {t("It's back")}
        <small>{t('news on shows you finished')}</small>
      </h2>
      <ul className="back-list">
        {shown.map((c) => {
          const { what, when } = line(c)
          const start = c.type === 'out' && c.info && !readOnly ? c.info : null
          return (
            <li key={c.key} className={`back-row ${c.type}`}>
              <button type="button" className="back-open" onClick={() => onOpen(c.head)} aria-label={`${c.head.showName}: ${what}. ${when}`}>
                <span className="back-poster">
                  <PosterFill src={c.head.poster} name={c.head.showName} />
                </span>
                <span className="back-text" aria-hidden="true">
                  <b className="back-show">{c.head.showName}</b>
                  <span className="back-what">
                    <span className="back-icon">{icon[c.type]}</span> {what}
                  </span>
                  <span className="back-when">{when}</span>
                </span>
              </button>
              {start && (
                <button
                  type="button"
                  className="btn sm primary back-start"
                  onClick={() => {
                    dismiss(c)
                    onStart(c.head, start)
                  }}
                  aria-label={t('Start season {n} of {show}', { n: start.number, show: c.head.showName })}
                >
                  {t('Start S{n}', { n: start.number })}
                </button>
              )}
              <button type="button" className="icon-btn back-x" onClick={() => dismiss(c)} aria-label={t('Hide this news about {show}', { show: c.head.showName })}>
                <Icon name="close" size={15} />
              </button>
            </li>
          )
        })}
      </ul>
      {news.length > VISIBLE && (
        <button type="button" className="link-btn back-more" onClick={() => setMore((m) => !m)} aria-expanded={more}>
          {more ? t('Show less') : t('See {n} more', { n: news.length - VISIBLE })}
        </button>
      )}
    </section>
  )
}
