import { useEffect, useMemo, useRef, useState } from 'react'
import { useBackClose } from '../hooks/useBackClose'
import { t } from '../i18n'
import { findMovieByImdb, getMovie, searchMovies } from '../movies'
import { parseShare, resolveShare } from '../shareIn'
import type { ShareDeps, ShareResolution, Shared } from '../shareIn'
import { getShow, getShowByImdb, searchShows } from '../tvmaze'
import type { ShowResult } from '../tvmaze'
import type { Kind, Title } from '../types'
import { Icon } from './Icon'
import { Poster } from './Poster'

const showTitle = (s: ShowResult): Title => ({
  kind: 'tv',
  extId: s.showId,
  title: s.showName,
  poster: s.poster,
  year: s.year,
  genres: s.genres,
  runtime: s.runtime,
  network: s.network,
})

// Only TVmaze and our own movie function: nothing shared goes anywhere else
const deps: ShareDeps = {
  showById: async (id) => {
    const s = await getShow(id)
    return s ? showTitle(s) : null
  },
  showByImdb: async (id) => {
    const s = await getShowByImdb(id)
    return s ? showTitle(s) : null
  },
  movieById: async (id) => {
    const m = await getMovie(id)
    return { kind: 'movie', extId: m.extId, title: m.title, poster: m.poster, year: m.year, genres: m.genres, runtime: m.runtime, network: null }
  },
  movieByImdb: (id) => findMovieByImdb(id),
  searchShows: async (q) => (await searchShows(q)).map(showTitle),
  searchMovies: (q) => searchMovies(q),
}

interface Props {
  shared: Shared
  /** Viewers can look but not add */
  readOnly: boolean
  onLog: (title: Title) => void
  onUpNext: (title: Title) => void
  /** "Not this one" / "Search instead": Search, prefilled */
  onSearch: (query: string, kind: Kind | null) => void
  onClose: () => void
}

/** "Pititi found it": what another app shared (or a pasted link), ready to log or save. */
export function ShareInSheet({ shared, readOnly, onLog, onUpNext, onSearch, onClose }: Props) {
  useBackClose(true, onClose)
  const [result, setResult] = useState<ShareResolution | null>(null)
  const [attempt, setAttempt] = useState(0)
  const lookup = useMemo(() => parseShare(shared), [shared])
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let live = true
    const run =
      typeof navigator !== 'undefined' && navigator.onLine === false
        ? Promise.resolve<ShareResolution>({ status: 'offline', query: lookup.query, kind: lookup.kind })
        : resolveShare(lookup, deps)
    run.then((r) => live && setResult(r))
    return () => {
      live = false
    }
  }, [lookup, attempt])

  // Focus moves into the sheet (no ring on phones); the answer is announced through aria-live
  useEffect(() => {
    sheetRef.current?.focus({ preventScroll: true })
  }, [])

  const found = result?.status === 'found' ? result.title : null
  const query = result?.query ?? lookup.query
  const kind = (found?.kind ?? result?.kind ?? lookup.kind) as Kind | null
  const meta = found ? [found.kind === 'movie' ? t('Movie') : t('TV show'), found.year, found.network].filter(Boolean).join(' · ') : ''

  return (
    <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label={t('Shared with Pititi')}>
      <button className="sheet-dim" aria-label={t('Close')} onClick={onClose} />
      <div className="sheet sharein" aria-busy={!result} tabIndex={-1} ref={sheetRef}>
        <div className="grabber" aria-hidden="true" />
        <div className="sharein-head">
          <p className="label-sm sharein-kicker">
            <Icon name="sparkle" size={15} stroke={2.2} />
            {!result ? t('Looking it up…') : found ? t('Pititi found it') : result.status === 'offline' ? t('No connection') : t('Hmm, not sure')}
          </p>
          <button className="icon-btn" aria-label={t('Close')} onClick={onClose}>
            <Icon name="close" size={18} />
          </button>
        </div>

        <div aria-live="polite" className="sharein-body">
          {!result ? (
            <div className="sharein-show" role="status">
              <div className="sharein-poster-skel" aria-hidden="true" />
              <div className="sharein-text">
                <span className="sharein-line w70" aria-hidden="true" />
                <span className="sharein-line w40" aria-hidden="true" />
                <span className="sr-only">{lookup.query ? t('Looking for {title}…', { title: lookup.query }) : t('Looking it up…')}</span>
              </div>
            </div>
          ) : found ? (
            <div className="sharein-show">
              <Poster src={found.poster} name={found.title} w={84} />
              <div className="sharein-text">
                <h2 className="sheet-title">{found.title}</h2>
                <p className="sheet-meta">{meta}</p>
                {found.genres.length > 0 && <p className="muted small">{found.genres.slice(0, 3).join(', ')}</p>}
              </div>
            </div>
          ) : (
            <div className="sharein-empty">
              <span className="sharein-empty-icon" aria-hidden="true">
                <Icon name={result.status === 'offline' ? 'info' : 'search'} size={26} stroke={2.2} />
              </span>
              <h2 className="empty-title">{result.status === 'offline' ? t("Couldn't look it up") : t("Pititi couldn't tell what that was")}</h2>
              <p className="muted">
                {result.status === 'offline'
                  ? t('Check your connection and try again, or search for it by name.')
                  : query
                    ? t('No show or movie matched "{q}". Try searching for it by name.', { q: query })
                    : t("That link or text didn't name a show or movie. Try searching for it by name.")}
              </p>
            </div>
          )}
        </div>

        {result && (
          <div className="sharein-actions">
            {found ? (
              <>
                {!readOnly && (
                  <>
                    <button className="btn primary block" onClick={() => onLog(found)}>
                      <Icon name="check" size={18} stroke={2.4} /> {t('Log it')}
                    </button>
                    <button className="btn block" onClick={() => onUpNext(found)}>
                      <Icon name="bookmark" size={18} stroke={2.2} /> {t('Up Next')}
                    </button>
                  </>
                )}
                <button className="btn ghost block" onClick={() => onSearch(query, kind)}>
                  {t('Not this one')}
                </button>
              </>
            ) : (
              <>
                {result.status === 'offline' && (
                  <button
                    className="btn primary block"
                    onClick={() => {
                      setResult(null)
                      setAttempt((n) => n + 1)
                    }}
                  >
                    <Icon name="repeat" size={18} stroke={2.2} /> {t('Try again')}
                  </button>
                )}
                <button className={`btn block ${result.status === 'offline' ? '' : 'primary'}`} onClick={() => onSearch(query, kind)}>
                  <Icon name="search" size={18} stroke={2.2} /> {t('Search instead')}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
