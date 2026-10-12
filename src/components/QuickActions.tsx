import { useEffect, useState } from 'react'
import { averageRating, canEditRating } from '../logic'
import { getSeasonEpisodesCached } from '../tvmaze'
import type { Person, Watch } from '../types'
import { Avatar } from './Avatar'
import { Icon } from './Icon'
import { Poster } from './Poster'
import { Stars } from './Stars'
import { t } from '../i18n'

interface Props {
  watch: Watch
  people: Person[]
  me: string | null
  onEpisode: (w: Watch) => void
  onFinish: (w: Watch, aired: number | null) => void
  onJoin: (w: Watch) => void
  onRate: (w: Watch, stars: number | null) => void
  onOpen: (w: Watch) => void
  onClose: () => void
}

/** Press-and-hold menu: the everyday things without opening the show page. Every action can be undone. */
export function QuickActions({ watch: w, people, me, onEpisode, onFinish, onJoin, onRate, onOpen, onClose }: Props) {
  // Aired episodes decide between "Finished" and "Caught up"; null until known (or offline)
  const [aired, setAired] = useState<number | null>(null)
  const meP = people.find((p) => p.id === me)
  const watching = w.status === 'watching'
  const iWatched = me != null && w.watchedBy.includes(me)
  const total = w.totalEpisodes

  useEffect(() => {
    let alive = true
    const today = new Date().toISOString().slice(0, 10)
    getSeasonEpisodesCached(w.showId, w.season)
      .then((eps) => alive && eps && setAired(eps.filter((e) => e.airdate != null && e.airdate <= today).length))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [w.showId, w.season])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const out = aired ?? total
  const nextEp = w.episodesWatched + 1
  const canNext = watching && (out == null || nextEp <= out)
  const complete = total != null && out != null && out >= total
  const caughtUp = out != null && w.episodesWatched >= out
  const act = (fn: () => void) => {
    fn()
    onClose()
  }

  return (
    <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label={t('Quick actions for {show}', { show: w.showName })}>
      <button className="sheet-dim" aria-label={t('Close')} onClick={onClose} />
      <div className="sheet qa">
        <div className="grabber" aria-hidden="true" />
        <div className="sheet-show">
          <Poster src={w.poster} name={w.showName} w={56} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="label-sm">{watching ? t('Still watching') : t('Finished')}</p>
            <h2 className="sheet-title">{w.showName}</h2>
            <p className="sheet-meta">
              {total
                ? t('Season {season} · {n} of {total} episodes', { season: w.season, n: w.episodesWatched, total })
                : t('Season {season} · {n} episodes', { season: w.season, n: w.episodesWatched })}
            </p>
          </div>
          <button className="icon-btn" aria-label={t('Close')} onClick={onClose}>
            <Icon name="close" size={18} />
          </button>
        </div>

        {watching && (
          <div className="qa-grid">
            <button className="qa-big primary" disabled={!canNext} onClick={() => act(() => onEpisode(w))}>
              <Icon name="plus" size={20} stroke={2.6} />
              <b>{canNext ? t('Watched episode {n}', { n: nextEp }) : t('All caught up')}</b>
              <span>{canNext ? t('Marks the next one') : t('No new episodes out yet')}</span>
            </button>
            <button className="qa-big" disabled={caughtUp} onClick={() => act(() => onFinish(w, aired))}>
              <Icon name="check" size={20} stroke={2.6} />
              <b>{complete || out == null ? t('Finished the season') : t('Caught up')}</b>
              <span>{out == null ? t('Marks every episode') : complete ? t('All {n} episodes', { n: total! }) : t('{n} of {total} aired so far', { n: out, total: total ?? '?' })}</span>
            </button>
          </div>
        )}

        {iWatched && meP && canEditRating(meP, me) ? (
          <div className="qa-rate">
            <span className="who">
              <Avatar people={people} id={meP.id} size={26} /> {t('Your stars')}
            </span>
            <Stars label="Your" value={w.ratings[meP.id] ?? null} onChange={(v) => onRate(w, v)} />
          </div>
        ) : me && !iWatched ? (
          <button className="qa-row" onClick={() => act(() => onJoin(w))}>
            <Icon name="users" size={20} />
            <span>
              <b>{t('I watched this too')}</b>
              <small>{t('Adds you under "Who watched?" so you can rate it')}</small>
            </span>
          </button>
        ) : null}

        {averageRating(w) != null && (
          <p className="qa-note">
            <Icon name="sparkle" size={14} stroke={2.2} /> {t('Family average {n}', { n: averageRating(w)!.toFixed(1) })}
          </p>
        )}

        <button className="qa-row" onClick={() => onOpen(w)}>
          <Icon name="tv" size={20} />
          <span>
            <b>{t('Open show page')}</b>
            <small>{t('Episodes, family chat, notes and more')}</small>
          </span>
          <Icon name="right" size={16} />
        </button>
      </div>
    </div>
  )
}
