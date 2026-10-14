import { useEffect } from 'react'
import { t } from '../i18n'
import type { Watch } from '../types'
import { Icon } from './Icon'
import { Poster } from './Poster'

interface Props {
  /** Shows you're in the middle of (your household), newest first */
  watching: Watch[]
  onNext: (w: Watch) => void
  onOther: () => void
  onClose: () => void
}

/** "What did you watch today?": one tap per show marks the next episode (each with Undo). */
export function QuickMark({ watching, onNext, onOther, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label={t('What did you watch today?')}>
      <button className="sheet-dim" aria-label={t('Close')} onClick={onClose} />
      <div className="sheet">
        <div className="grabber" aria-hidden="true" />
        <div className="topbar" style={{ paddingTop: 0 }}>
          <div>
            <p className="label-sm">{t('Quick mark')}</p>
            <h2 className="sheet-title">{t('What did you watch today?')}</h2>
          </div>
          <button className="icon-btn" aria-label={t('Close')} onClick={onClose}>
            <Icon name="close" size={18} />
          </button>
        </div>

        {watching.length === 0 ? (
          <p className="muted">{t("You're not in the middle of any show. Add one to start.")}</p>
        ) : (
          <ul className="quickmark">
            {watching.map((w) => {
              const next = w.episodesWatched + 1
              const done = w.totalEpisodes != null && w.episodesWatched >= w.totalEpisodes
              return (
                <li key={w.id}>
                  <Poster src={w.poster} name={w.showName} w={46} />
                  <span className="lrow-text">
                    <span className="lrow-title">{w.showName}</span>
                    <span className="muted">
                      {t('S{season}', { season: w.season })} · {w.totalEpisodes ? t('{n} of {total}', { n: w.episodesWatched, total: w.totalEpisodes }) : t('{n} eps', { n: w.episodesWatched })}
                    </span>
                  </span>
                  <button className="qm-btn" disabled={done} onClick={() => onNext(w)} aria-label={t('Watched episode {n} of {title}', { n: next, title: w.showName })}>
                    <Icon name="plus" size={16} stroke={2.6} /> {t('E{n}', { n: next })}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        <button className="btn ghost block" onClick={onOther}>
          <Icon name="search" size={18} /> {t('Something else')}
        </button>
      </div>
    </div>
  )
}
