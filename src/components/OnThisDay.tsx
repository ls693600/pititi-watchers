import { useMemo, useState } from 'react'
import { memoriesFor, type Anchor, type Memory } from '../onThisDay'
import type { CouchPhoto, EpisodeReaction, Person, Watch } from '../types'
import { localDay } from '../lib/dates'
import { locale, t } from '../i18n'
import { Avatar } from './Avatar'
import { Icon } from './Icon'
import { PosterFill } from './Poster'

/** The day this phone hid the card (YYYY-MM-DD): it stays hidden until tomorrow. */
const HIDE_KEY = 'pititi.onthisday.v1'

function hiddenOn(): string | null {
  try {
    return localStorage.getItem(HIDE_KEY)
  } catch {
    return null
  }
}

interface Props {
  /** Your household's logs */
  watches: Watch[]
  photos: CouchPhoto[]
  episodeReactions: EpisodeReaction[]
  /** Everyone (names and avatars) */
  people: Person[]
  household: string | null
  onOpen: (w: Watch) => void
}

function anchorLabel(a: Anchor): string {
  return a === '1y' ? t('1 year ago') : a === '6m' ? t('6 months ago') : t('1 month ago')
}

function headline(m: Memory, people: Person[]): string {
  const { watch: w } = m
  const tv = (w.kind ?? 'tv') === 'tv'
  if (m.kind === 'photo') return w.showName
  if (m.kind === 'finished') return tv ? t('Finished {show} S{season}', { show: w.showName, season: w.season }) : t('Watched {show}', { show: w.showName })
  if (m.kind === 'started') return tv && w.season > 1 ? t('Started {show} S{season}', { show: w.showName, season: w.season }) : t('Started {show}', { show: w.showName })
  const r = m.reaction!
  const name = people.find((p) => p.id === r.personId)?.name ?? t('someone')
  return r.kind === 'movie'
    ? t('{name} reacted {emoji} to {show}', { name, emoji: r.emoji, show: w.showName })
    : t('{name} reacted {emoji} to S{season} E{episode} of {show}', { name, emoji: r.emoji, season: r.season, episode: r.episode, show: w.showName })
}

/** "On this day": your household's memories from a year ago (or 6 months, or a month), swipeable. */
export function OnThisDay({ watches, photos, episodeReactions, people, household, onOpen }: Props) {
  // Fixed while Home is open: the card doesn't change under your thumb at midnight
  const [today] = useState(() => localDay())
  const [hidden, setHidden] = useState(() => hiddenOn() === today)
  const [index, setIndex] = useState(0)
  const memories = useMemo(() => memoriesFor({ watches, photos, episodeReactions, people, household, today }), [watches, photos, episodeReactions, people, household, today])
  // A photo whose link expired or failed: its poster takes its place
  const [broken, setBroken] = useState<Set<string>>(() => new Set())
  if (hidden || !memories) return null

  const { items } = memories
  const date = new Date(`${memories.date}T12:00:00`).toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' })
  const hide = () => {
    setHidden(true)
    try {
      localStorage.setItem(HIDE_KEY, today)
    } catch {
      // Hidden until the app restarts
    }
  }

  return (
    <section className="otd" aria-label={t('On this day')}>
      <div className="otd-head">
        <p className="otd-kicker">
          <span aria-hidden="true">🕰️</span> {t('On this day')} · {anchorLabel(memories.anchor)}
        </p>
        {items.length > 1 && (
          <span className="otd-count" aria-hidden="true">
            {Math.min(index, items.length - 1) + 1}/{items.length}
          </span>
        )}
        <button type="button" className="otd-close" aria-label={t('Hide On this day until tomorrow')} onClick={hide}>
          <Icon name="close" size={15} stroke={2.4} />
        </button>
      </div>
      <ul
        className="otd-track"
        onScroll={(e) => {
          const el = e.currentTarget
          const i = Math.round(el.scrollLeft / el.clientWidth)
          if (i !== index) setIndex(i)
        }}
      >
        {items.map((m, i) => {
          const title = headline(m, people)
          const photo = m.photo && !broken.has(m.photo.id) ? m.photo : null
          const who = m.kind === 'reaction' ? [m.reaction!.personId] : m.watch.watchedBy
          return (
            <li key={`${m.kind}-${m.watch.id}`} className="otd-slide">
              <button
                type="button"
                className="otd-item"
                onClick={() => onOpen(m.watch)}
                onFocus={(e) => e.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' })}
                aria-label={`${items.length > 1 ? `${t('{n} of {total}', { n: i + 1, total: items.length })}: ` : ''}${title} · ${m.kind === 'photo' ? `${t('Couch night photo')} · ` : ''}${date}`}
              >
                <span className={`otd-thumb ${photo ? 'is-photo' : ''}`}>
                  {photo ? (
                    <img src={photo.url} alt="" loading="lazy" onError={() => setBroken((b) => new Set(b).add(photo.id))} />
                  ) : (
                    <PosterFill src={m.watch.poster} name={m.watch.showName} />
                  )}
                  {m.kind === 'photo' && (
                    <span className="otd-badge" aria-hidden="true">📸</span>
                  )}
                </span>
                <span className="otd-text" aria-hidden="true">
                  <b>{title}</b>
                  <span className="otd-meta">
                    {m.kind === 'photo' && <span className="otd-tag">{t('Couch night photo')}</span>}
                    <span className="otd-date">{date}</span>
                  </span>
                  {who.length > 0 && (
                    <span className="otd-who stack">
                      {who.slice(0, 4).map((id) => (
                        <Avatar key={id} people={people} id={id} size={20} />
                      ))}
                    </span>
                  )}
                </span>
                <span className="otd-chev" aria-hidden="true">
                  <Icon name="right" size={16} stroke={2.4} />
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
