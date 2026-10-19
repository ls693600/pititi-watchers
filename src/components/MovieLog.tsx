import { useEffect, useState } from 'react'
import { getMovie } from '../movies'
import { isPriorWatch, monthLabel, movieWatch, togetherWatchers } from '../logic'
import { t } from '../i18n'
import type { Person, Watch } from '../types'
import { Icon } from './Icon'
import { Poster } from './Poster'
import { PosterPlay } from './TrailerSheet'
import { Stars } from './Stars'

interface Props {
  draft: Watch
  watches: Watch[]
  /** Your household (who can be "watching together") */
  people: Person[]
  me: string | null
  saving: boolean
  onLog: (w: Watch) => void
  /** Didn't watch it yet: save it for later instead */
  onSaveForLater: (w: Watch) => void
  onClose: () => void
}

/** Log a movie: one sitting, so it's just together-or-not and your stars. */
export function MovieLog({ draft, watches, people, me, saving, onLog, onSaveForLater, onClose }: Props) {
  const [w, setW] = useState<Watch>(() =>
    movieWatch({ ...draft, status: 'done', isRewatch: isPriorWatch(watches, draft.showId, 1, draft.id, 'movie') }),
  )

  // Runtime and genres come with the details (search results don't have runtime)
  useEffect(() => {
    let alive = true
    getMovie(draft.showId)
      .then((m) => alive && setW((cur) => ({ ...cur, runtime: m.runtime ?? cur.runtime, genres: m.genres.length ? m.genres : cur.genres })))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [draft.showId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const together = w.watchedBy.length > 1
  const other = people.find((p) => p.id !== me)
  function setTogether(on: boolean) {
    const ids = togetherWatchers(me, people, on)
    setW((cur) => ({ ...cur, watchedBy: ids, ratings: Object.fromEntries(Object.entries(cur.ratings).filter(([id]) => ids.includes(id))) }))
  }

  return (
    <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label={t('Log {title}', { title: w.showName })}>
      <button className="sheet-dim" aria-label={t('Close')} onClick={onClose} />
      <div className="sheet">
        <div className="grabber" aria-hidden="true" />
        <div className="sheet-show">
          <PosterPlay kind={'movie'} extId={w.showId} title={w.showName} year={w.year} season={0} chip compact>
            <Poster src={w.poster} name={w.showName} w={72} />
          </PosterPlay>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="label-sm">
              {t('Movie')} · {monthLabel(w.month, 'long').split(' ')[0]}
              {w.isRewatch && (
                <span className="rewatch-tag">
                  <Icon name="repeat" size={11} stroke={2.6} /> {t('Rewatch')}
                </span>
              )}
            </p>
            <h2 className="sheet-title">{w.showName}</h2>
            <p className="sheet-meta">{[w.year, w.runtime ? `${Math.floor(w.runtime / 60)}h ${w.runtime % 60}m` : null, w.genres.slice(0, 2).join(', ')].filter(Boolean).join(' · ')}</p>
          </div>
          <button className="icon-btn" aria-label={t('Close')} onClick={onClose} style={{ alignSelf: 'flex-start' }}>
            <Icon name="close" size={18} />
          </button>
        </div>

        {people.length > 1 && (
          <div>
            <p className="label-sm" style={{ marginBottom: 8 }}>{t('Watching together?')}</p>
            <div className="big-choice together" role="radiogroup" aria-label={t('Watching together?')}>
              <button type="button" role="radio" aria-checked={!together} className={!together ? 'on' : ''} onClick={() => setTogether(false)}>
                <Icon name="tv" size={16} stroke={2.2} />
                <b>{t('Just me')}</b>
                <small>{t('Only your stars count')}</small>
              </button>
              <button type="button" role="radio" aria-checked={together} className={together ? 'on' : ''} onClick={() => setTogether(true)}>
                <Icon name="users" size={16} stroke={2.2} />
                <b>{t('Together')}</b>
                <small>{people.length === 2 && other ? t('Average with {name}', { name: other.name }) : t('Average of everyone watching')}</small>
              </button>
            </div>
          </div>
        )}

        {me && (
          <div className="quick-rate">
            <p className="label-sm">{t('Your rating')}</p>
            <div className="quick-stars">
              <Stars
                label="Your"
                value={w.ratings[me] ?? null}
                onChange={(v) =>
                  setW((cur) => {
                    const ratings = { ...cur.ratings }
                    if (v == null) delete ratings[me]
                    else ratings[me] = v
                    return { ...cur, ratings }
                  })
                }
              />
            </div>
          </div>
        )}

        <button className="btn primary block" onClick={() => onLog({ ...w, updatedAt: new Date().toISOString() })} disabled={saving}>
          {saving ? t('Saving…') : t('We watched it')}
        </button>
        <button className="link-btn" onClick={() => onSaveForLater(w)}>
          {t("Haven't watched it yet? Save to Up Next")}
        </button>
      </div>
    </div>
  )
}
