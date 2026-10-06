import { useEffect, useRef, useState } from 'react'
import { airLabel, episodeOutlook, outlookOrder, type Outlook } from '../logic'
import { bigPoster, getShowInfoCached } from '../tvmaze'
import type { Person, Watch } from '../types'
import { Avatar } from './Avatar'
import { Icon } from './Icon'
import { PosterFill } from './Poster'

interface Props {
  watching: Watch[]
  people: Person[]
  onOpen: (w: Watch) => void
  onAddEpisode: (w: Watch) => void
}

/** Next-episode info for the shows being watched (cached, refreshed every few hours). */
function useOutlooks(watching: Watch[]): Record<string, Outlook> {
  const [map, setMap] = useState<Record<string, Outlook>>({})
  const key = watching.map((w) => `${w.id}:${w.season}:${w.episodesWatched}`).join('|')
  useEffect(() => {
    let alive = true
    watching.forEach((w) => {
      getShowInfoCached(w.showId)
        .then((info) => {
          if (alive) setMap((m) => ({ ...m, [w.id]: episodeOutlook(w, info.nextEpisode) }))
        })
        .catch(() => undefined)
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return map
}

function kicker(o: Outlook | undefined): { text: string; tone: 'ready' | 'soon' | 'plain' } {
  if (o?.ready) return { text: o.ready === 1 ? '1 new episode' : `${o.ready} new episodes`, tone: 'ready' }
  if (o?.next) return { text: `Next ep · ${airLabel(o.next.date)}`, tone: 'soon' }
  return { text: 'Continue watching', tone: 'plain' }
}

/** Swipeable banner of every show in progress (dots show where you are), then a "Coming up" TV guide. */
export function ReleaseCarousel({ watching, people, onOpen, onAddEpisode }: Props) {
  const outlooks = useOutlooks(watching)
  const cards = [...watching].sort((a, b) => outlookOrder(outlooks[a.id], outlooks[b.id]))
  const track = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  // "Coming up" looks a month ahead; fixed while the screen is open
  const [horizon] = useState(() => new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10))

  const coming = cards
    .flatMap((w) => (outlooks[w.id]?.next ? [{ w, next: outlooks[w.id].next! }] : []))
    .filter(({ next }) => next.date <= horizon)
    .sort((a, b) => a.next.date.localeCompare(b.next.date))

  function goTo(i: number) {
    const el = track.current
    if (!el) return
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }

  return (
    <section aria-label="Currently watching" className="releases">
      <h2 className="h2" style={{ marginBottom: 10 }}>
        Currently watching
        <small>{watching.length} {watching.length === 1 ? 'show' : 'shows'}</small>
      </h2>

      <div
        className="carousel"
        ref={track}
        onScroll={(e) => {
          const el = e.currentTarget
          const i = Math.round(el.scrollLeft / el.clientWidth)
          if (i !== index) setIndex(i)
        }}
      >
        {cards.map((w, i) => {
          const k = kicker(outlooks[w.id])
          return (
            <div key={w.id} className="slide" role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${cards.length}: ${w.showName}`}>
              <div className="hero">
                {w.poster && <img src={bigPoster(w.poster)!} alt="" className="hero-bg" />}
                <button onClick={() => onOpen(w)} aria-label={`Open ${w.showName}`} style={{ flex: 'none' }}>
                  <span className="hero-poster" style={{ display: 'block', overflow: 'hidden' }}>
                    <PosterFill src={w.poster} name={w.showName} />
                  </span>
                </button>
                <div className="hero-body">
                  <span className={`kicker-pill ${k.tone}`}>
                    <Icon name={k.tone === 'ready' ? 'play' : k.tone === 'soon' ? 'calendar' : 'play'} size={12} stroke={2.6} /> {k.text}
                  </span>
                  <button className="hero-title" style={{ textAlign: 'left' }} onClick={() => onOpen(w)}>
                    {w.showName}
                  </button>
                  <span className="hero-sub">
                    Season {w.season} · {w.totalEpisodes ? `${w.episodesWatched} of ${w.totalEpisodes}` : `${w.episodesWatched} eps`}
                  </span>
                  {w.totalEpisodes ? (
                    <div className="bar">
                      <i style={{ width: `${(w.episodesWatched / w.totalEpisodes) * 100}%` }} />
                    </div>
                  ) : (
                    <div style={{ height: 8 }} />
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button className="hero-plus" onClick={() => onAddEpisode(w)}>
                      <Icon name="plus" size={16} stroke={2.6} /> Watched next
                    </button>
                    <span className="stack">
                      {w.watchedBy.slice(0, 3).map((id) => (
                        <Avatar key={id} people={people} id={id} size={22} />
                      ))}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {cards.length > 1 && (
        <div className="dots" role="tablist" aria-label="Shows">
          {cards.map((w, i) => (
            <button
              key={w.id}
              role="tab"
              aria-selected={i === index}
              aria-label={w.showName}
              className={i === index ? 'on' : ''}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
      )}

      {coming.length > 0 && (
        <>
          <h2 className="h2" style={{ margin: '18px 0 10px' }}>
            Coming up
            <small>new episodes</small>
          </h2>
          <div className="guide">
            {coming.map(({ w, next }) => {
              const [y, m, d] = next.date.split('-').map(Number)
              const day = new Date(y, m - 1, d)
              const label = airLabel(next.date)
              const soon = label === 'Today' || label === 'Tomorrow'
              return (
                <button key={w.id} className={`guide-tile ${soon ? 'soon' : ''}`} onClick={() => onOpen(w)} aria-label={`${w.showName}, season ${next.season} episode ${next.number}, ${label}`}>
                  <span className="guide-dow">{soon ? label : day.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                  <span className="guide-day">{d}</span>
                  <span className="guide-mon">{day.toLocaleDateString('en-US', { month: 'short' })}</span>
                  <span className="guide-show">{w.showName}</span>
                  <span className="guide-ep">S{next.season} · E{next.number}</span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </section>
  )
}
