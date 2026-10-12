import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import { Poster } from '../components/Poster'
import { byUpdatedDesc, currentMonth, kindOf, monthLabel, titleOf } from '../logic'
import { MoviesNotReady, searchMovies } from '../movies'
import { searchShows } from '../tvmaze'
import { t } from '../i18n'
import type { Kind, Title, Watch, WatchList } from '../types'

interface Props {
  watches: Watch[]
  /** Month new logs go into (the month open on Home) */
  month: string
  onMonth: (month: string) => void
  /** Adding to a list instead of logging (from a list's "Add a show or movie") */
  target: WatchList | null
  onCancelTarget: () => void
  /** Titles already on the target list */
  onTarget: Set<string>
  onPick: (t: Title) => void
  onAddToList: (t: Title) => void
  /** Save to a list / Recommend */
  onMore: (t: Title) => void
  readOnly?: boolean
}

const key = (x: Pick<Title, 'kind' | 'extId'>) => `${x.kind}:${x.extId}`

/** Find a TV show or a movie: tap to log it, ••• to save it to a list or recommend it. */
export function Search({ watches, month, onMonth, target, onCancelTarget, onTarget, onPick, onAddToList, onMore, readOnly = false }: Props) {
  const [kind, setKind] = useState<Kind>('tv')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Title[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notReady, setNotReady] = useState(false)

  const recent = useMemo(() => {
    const seen = new Set<string>()
    return [...watches]
      .sort(byUpdatedDesc)
      .filter((w) => kindOf(w) === kind)
      .map(titleOf)
      .filter((x) => !seen.has(key(x)) && seen.add(key(x)))
      .slice(0, 8)
  }, [watches, kind])

  useEffect(() => {
    if (!query.trim()) return
    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true)
      setError(null)
      setNotReady(false)
      try {
        if (kind === 'movie') setResults(await searchMovies(query, ctrl.signal))
        else
          setResults(
            (await searchShows(query, ctrl.signal)).map((s) => ({
              kind: 'tv' as const,
              extId: s.showId,
              title: s.showName,
              poster: s.poster,
              year: s.year,
              genres: s.genres,
              runtime: s.runtime,
              network: s.network,
            })),
          )
      } catch (e) {
        if (e instanceof MoviesNotReady) setNotReady(true)
        else if ((e as Error).name !== 'AbortError') setError(t("Couldn't reach the database. Check your connection and try again."))
      } finally {
        if (!ctrl.signal.aborted) setLoading(false)
      }
    }, 300)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [query, kind])

  const shown = query.trim() ? results : recent
  return (
    <div className="screen">
      <header>
        <p className="eyebrow">{target ? t('Add to a list') : t('What did you watch?')}</p>
        <h1 className="title-xl">{target ? `${target.emoji} ${t(target.name)}` : kind === 'movie' ? t('Add a movie') : t('Add a show')}</h1>
      </header>

      <div className="segmented wide" role="tablist" aria-label={t('TV or movie')}>
        <button role="tab" aria-selected={kind === 'tv'} className={kind === 'tv' ? 'on' : ''} onClick={() => setKind('tv')}>
          <Icon name="tv" size={16} /> {t('TV shows')}
        </button>
        <button role="tab" aria-selected={kind === 'movie'} className={kind === 'movie' ? 'on' : ''} onClick={() => setKind('movie')}>
          <Icon name="play" size={14} /> {t('Movies')}
        </button>
      </div>

      {target ? (
        <button className="month-chip" onClick={onCancelTarget}>
          <Icon name="close" size={14} /> {t('Adding to {list}. Tap to log instead.', { list: t(target.name) })}
        </button>
      ) : (
        !readOnly && (
          <label className={`month-chip ${month === currentMonth() ? '' : 'past'}`}>
            <Icon name="calendar" size={15} /> {t('Adding to {month}', { month: monthLabel(month) })}
            <span className="month-chip-change">{t('Change')}</span>
            <input
              type="month"
              value={month}
              max={currentMonth()}
              aria-label={t('Month you watched it')}
              onChange={(e) => e.target.value && onMonth(e.target.value > currentMonth() ? currentMonth() : e.target.value)}
            />
          </label>
        )
      )}

      <div className="searchbox">
        <Icon name="search" size={20} />
        <input
          type="search"
          placeholder={kind === 'movie' ? t('Search any movie') : t('Search any TV show')}
          aria-label={kind === 'movie' ? t('Search movies') : t('Search shows')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>
      {!target && !readOnly && (
        <p className="muted" style={{ marginTop: -8 }}>
          {t('Tap to log it. ••• to save it to a list or recommend it.')}
        </p>
      )}

      {query.trim() && notReady && (
        <div className="tip" role="note">
          <span className="tip-icon" aria-hidden="true">
            <Icon name="play" size={16} stroke={2.2} />
          </span>
          <p>{t('Movies are almost ready: Leandro needs to finish a quick setup. TV shows work now.')}</p>
        </div>
      )}
      {query.trim() && error && <p className="error" role="alert">{error}</p>}
      {query.trim() && loading && <p className="muted center">{t('Searching…')}</p>}
      {query.trim() && !loading && !error && !notReady && results.length === 0 && (
        <p className="muted center">{t('Nothing matches "{q}". Check the spelling or try the original title.', { q: query.trim() })}</p>
      )}

      {!query.trim() && recent.length > 0 && <h2 className="h2">{t('Recently logged')}</h2>}

      {shown.length > 0 && (
        <ul className="card">
          {shown.map((s) => {
            const added = target && onTarget.has(key(s))
            return (
              <li key={key(s)} className="qrow">
                <button
                  className="qrow-main"
                  disabled={Boolean(added) || (readOnly && !target)}
                  onClick={() => (target ? onAddToList(s) : onPick(s))}
                  aria-label={target ? t('Add {title} to {list}', { title: s.title, list: t(target.name) }) : t('Log {title}', { title: s.title })}
                >
                  <Poster src={s.poster} name={s.title} w={46} />
                  <span className="lrow-text">
                    <span className="lrow-title">{s.title}</span>
                    <span className="muted">{[s.year, s.network, s.genres.slice(0, 2).join(', ')].filter(Boolean).join(' · ')}</span>
                  </span>
                </button>
                {target ? (
                  <span className={`queue-btn ${added ? 'on' : ''}`} aria-hidden="true">
                    <Icon name={added ? 'check' : 'plus'} size={18} stroke={2.4} />
                  </span>
                ) : (
                  <button className="queue-btn" aria-label={t('More for {title}', { title: s.title })} onClick={() => onMore(s)}>
                    <span aria-hidden="true" style={{ fontWeight: 800, letterSpacing: 1 }}>•••</span>
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
