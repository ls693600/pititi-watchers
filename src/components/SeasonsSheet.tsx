import { useBackClose } from '../hooks/useBackClose'
import { useEffect, useState } from 'react'
import { t } from '../i18n'
import { averageRating, episodesIn, kindOf, logForSeason, monthLabel, laterSeasons, airLabel, type ShowGroup } from '../logic'
import { getSeasonsCached, type SeasonInfo } from '../tvmaze'
import type { Watch } from '../types'
import { Icon } from './Icon'
import { Poster } from './Poster'

interface Props {
  group: ShowGroup
  month: string
  onOpen: (w: Watch) => void
  /** Every log of your household (the next season may be logged in another month) */
  all?: Watch[]
  /** Start the next season's log (absent for viewers) */
  onStartSeason?: (head: Watch, season: SeasonInfo) => void
  onClose: () => void
}

/** Behind a show's poster on Home when several of its seasons were watched: one row per season. */
export function SeasonsSheet({ group, month, onOpen, all = [], onStartSeason, onClose }: Props) {
  // The phone's Back closes it
  useBackClose(true, onClose)
  const { head, logs } = group
  const avg = averageRating(head)
  const monthName = monthLabel(month, 'long').split(' ')[0]
  // The next season: start it here (rewatching a show season by season, or a new season you just reached)
  const [seasons, setSeasons] = useState<SeasonInfo[] | null>(null)
  useEffect(() => {
    if (kindOf(head) === 'movie') return
    let alive = true
    getSeasonsCached(head.showId)
      .then((list) => alive && setSeasons(list))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [head])
  const later = seasons ? laterSeasons(logs, seasons) : { aired: [], upcoming: null }
  const last = logs[logs.length - 1]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label={head.showName}>
      <button className="sheet-dim" aria-label={t('Close')} onClick={onClose} />
      <div className="sheet">
        <div className="grabber" aria-hidden="true" />
        <div className="topbar" style={{ paddingTop: 0 }}>
          <div className="seasons-head">
            <Poster src={head.poster} name={head.showName} w={52} />
            <div style={{ minWidth: 0 }}>
              <p className="label-sm">{t('{n} seasons in {month}', { n: logs.length, month: monthName })}</p>
              <h2 className="sheet-title">{head.showName}</h2>
              {avg != null && (
                <p className="seasons-avg">
                  <b>★</b> {avg.toFixed(1)}
                  <small>/10 · {t('one rating for the show')}</small>
                </p>
              )}
            </div>
          </div>
          <button className="icon-btn" aria-label={t('Close')} onClick={onClose}>
            <Icon name="close" size={18} />
          </button>
        </div>

        <ul className="watched-list">
          {logs.map((w) => (
            <li key={w.id}>
              <button onClick={() => onOpen(w)} aria-label={t('Open {name} season {n}', { name: w.showName, n: w.season })}>
                <span className="season-num" aria-hidden="true">{w.season}</span>
                <span className="lrow-text">
                  <span className="lrow-title">{t('Season {n}', { n: w.season })}</span>
                  <span className="muted small">
                    {w.status === 'done' ? t('Finished') : t('Watching')}
                    {w.totalEpisodes ? ` · ${t('{a} of {b} eps', { a: w.episodesWatched, b: w.totalEpisodes })}` : ''}
                    {w.isRewatch ? ` · ${t('Rewatch')}` : ''}
                  </span>
                </span>
                <span className="watched-nums">
                  <b>{episodesIn(w, month) === 1 ? t('1 ep') : t('{n} eps', { n: episodesIn(w, month) })}</b>
                  <span className="muted small">{t('in {month}', { month: monthName })}</span>
                </span>
                <Icon name="right" size={18} />
              </button>
            </li>
          ))}
          {later.aired.map((s) => {
            // Logged in another month: open it. Not logged yet: start it (viewers only see the logged ones)
            const log = logForSeason(all, last, s.number)
            if (log)
              return (
                <li key={s.number}>
                  <button onClick={() => onOpen(log)} aria-label={t('Open {name} season {n}', { name: head.showName, n: s.number })}>
                    <span className="season-num" aria-hidden="true">{s.number}</span>
                    <span className="lrow-text">
                      <span className="lrow-title">{t('Season {n}', { n: s.number })}</span>
                      <span className="muted small">
                        {log.status === 'done' ? t('Finished') : t('Watching')} · {monthLabel(log.month)}
                      </span>
                    </span>
                    <Icon name="right" size={18} />
                  </button>
                </li>
              )
            if (!onStartSeason) return null
            return (
              <li key={s.number}>
                <button className="season-start" onClick={() => onStartSeason(last, s)}>
                  <span className="season-num start" aria-hidden="true">
                    <Icon name="plus" size={18} stroke={2.6} />
                  </span>
                  <span className="lrow-text">
                    <span className="lrow-title">{t('Start Season {n}', { n: s.number })}</span>
                    <span className="muted small">{s.episodes ? t('{n} episodes', { n: s.episodes }) : t('Next season')}</span>
                  </span>
                  <Icon name="right" size={18} />
                </button>
              </li>
            )
          })}
          {later.upcoming && (
            <li className="season-upcoming">
              <span className="season-num" aria-hidden="true">{later.upcoming.number}</span>
              <span className="lrow-text">
                <span className="lrow-title">{t('Season {n}', { n: later.upcoming.number })}</span>
                <span className="muted small">
                  {later.upcoming.premiereDate ? t('Comes out {date}', { date: airLabel(later.upcoming.premiereDate) }) : t('Coming later')}
                </span>
              </span>
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}
