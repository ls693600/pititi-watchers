import { useEffect } from 'react'
import { t } from '../i18n'
import { averageRating, episodesIn, monthLabel, type ShowGroup } from '../logic'
import type { Watch } from '../types'
import { Icon } from './Icon'
import { Poster } from './Poster'

interface Props {
  group: ShowGroup
  month: string
  onOpen: (w: Watch) => void
  onClose: () => void
}

/** Behind a show's poster on Home when several of its seasons were watched: one row per season. */
export function SeasonsSheet({ group, month, onOpen, onClose }: Props) {
  const { head, logs } = group
  const avg = averageRating(head)
  const monthName = monthLabel(month, 'long').split(' ')[0]

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
        </ul>
      </div>
    </div>
  )
}
