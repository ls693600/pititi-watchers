import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { t } from '../i18n'
import { getTrailer, youtubeSearch, type Trailer } from '../movies'
import { Icon } from './Icon'

interface Props {
  kind: 'movie' | 'tv'
  /** TMDB id for movies, TVmaze id for shows */
  extId: number
  title: string
  year: string | null
  /** Shows: try this season's trailer first */
  season?: number
  onClose: () => void
}

type State = { s: 'loading' } | { s: 'ready'; trailer: Trailer } | { s: 'error' }

/** Pop-up that plays the trailer right in the app (YouTube's privacy-enhanced player). */
export function TrailerSheet({ kind, extId, title, year, season = 0, onClose }: Props) {
  const [state, setState] = useState<State>({ s: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    getTrailer(kind, extId, season)
      .then((trailer) => alive && setState({ s: 'ready', trailer }))
      .catch(() => alive && setState({ s: 'error' }))
    return () => {
      alive = false
    }
  }, [kind, extId, season, attempt])

  useEffect(() => {
    // Escape closes only the trailer, not the log sheet underneath
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const key = state.s === 'ready' ? state.trailer.key : null
  const label = t('Trailer of {title}', { title })

  // On the page itself, so it also opens above a log sheet
  return createPortal(
    <div className="sheet-wrap trailer-wrap" role="dialog" aria-modal="true" aria-label={label}>
      <button className="sheet-dim" aria-label={t('Close')} onClick={onClose} />
      <div className="sheet trailer-sheet">
        <div className="grabber" aria-hidden="true" />
        <div className="topbar" style={{ paddingTop: 0 }}>
          <div style={{ minWidth: 0 }}>
            <p className="label-sm">{t('Trailer')}</p>
            <h2 className="sheet-title">{title}</h2>
            {state.s === 'ready' && state.trailer.name && <p className="muted small trailer-name">{state.trailer.name}</p>}
          </div>
          <button className="icon-btn" aria-label={t('Close')} onClick={onClose}>
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="trailer-frame">
          {state.s === 'loading' && (
            <div className="trailer-msg" role="status">
              <span className="spinner" aria-hidden="true" />
              {t('Finding the trailer…')}
            </div>
          )}
          {key && (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(key)}?autoplay=1&playsinline=1&rel=0&modestbranding=1`}
              title={label}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          )}
          {state.s === 'ready' && !key && (
            <div className="trailer-msg">
              <Icon name="play" size={28} />
              <b>{t('No trailer found for this one')}</b>
              <span className="muted small">{t('YouTube may still have one.')}</span>
            </div>
          )}
          {state.s === 'error' && (
            <div className="trailer-msg" role="alert">
              <Icon name="info" size={26} />
              <b>{t("Couldn't load the trailer")}</b>
              <span className="muted small">{t('Check your connection and try again.')}</span>
              <button className="btn sm dark" onClick={() => { setState({ s: 'loading' }); setAttempt((n) => n + 1) }}>{t('Try again')}</button>
            </div>
          )}
        </div>

        {state.s !== 'loading' && (
          <a className="btn ghost block" href={key ? `https://www.youtube.com/watch?v=${encodeURIComponent(key)}` : youtubeSearch(title, year)} target="_blank" rel="noopener noreferrer">
            <Icon name="play" size={18} /> {key ? t('Open in YouTube') : t('Search on YouTube')}
          </a>
        )}
      </div>
    </div>,
    document.body,
  )
}

/** A poster that plays the trailer when tapped (log sheets and the show page). */
export function PosterPlay({ kind, extId, title, year, season, children, badge = 34, chip = false, compact = false }: Omit<Props, 'onClose'> & { children: ReactNode; badge?: number; /** A "▶ Trailer" label on the poster instead of a round button */ chip?: boolean; /** Smaller label for small posters */ compact?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className="poster-play" onClick={() => setOpen(true)} aria-label={t('Watch the trailer of {title}', { title })}>
        {children}
        {chip ? (
          <span className={compact ? 'play-chip compact' : 'play-chip'} aria-hidden="true">
            <Icon name="play" size={11} stroke={3} /> {t('Trailer')}
          </span>
        ) : (
          <span className="play-badge" aria-hidden="true" style={{ width: badge, height: badge }}>
            <Icon name="play" size={Math.round(badge * 0.42)} stroke={2.6} />
          </span>
        )}
      </button>
      {open && <TrailerSheet kind={kind} extId={extId} title={title} year={year} season={season} onClose={() => setOpen(false)} />}
    </>
  )
}
