import { useEffect, useMemo, useState } from 'react'
import { Poster } from '../components/Poster'
import { byUpdatedDesc } from '../logic'
import { searchShows, type ShowResult } from '../tvmaze'
import type { Watch } from '../types'

interface Props {
  watches: Watch[]
  onPick: (show: ShowResult) => void
}

export function Search({ watches, onPick }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ShowResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const recent = useMemo(() => {
    const seen = new Set<number>()
    return [...watches]
      .sort(byUpdatedDesc)
      .filter((w) => !seen.has(w.showId) && seen.add(w.showId))
      .slice(0, 8)
      .map(({ showId, showName, poster, network, genres, year, runtime }): ShowResult => ({
        showId, showName, poster, network, genres, year, runtime,
      }))
  }, [watches])

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setError(null)
      return
    }
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        setResults(await searchShows(query, ctrl.signal))
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setError("Couldn't reach the show database. Check your connection and try again.")
      } finally {
        if (!ctrl.signal.aborted) setLoading(false)
      }
    }, 300)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [query])

  return (
    <div className="screen">
      <h1 className="screen-title">Log a show</h1>
      <input
        className="search-input"
        type="search"
        placeholder="Severance"
        aria-label="Search shows"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />

      {error && <p className="error" role="alert">{error}</p>}
      {loading && <p className="muted center">Searching…</p>}

      {query.trim() && !loading && !error && results.length === 0 && (
        <p className="muted center">No shows match "{query.trim()}". Check the spelling or try the original title.</p>
      )}

      {!query.trim() && recent.length > 0 && <h2 className="section">Recently logged</h2>}

      <ul className="list">
        {(query.trim() ? results : recent).map((s) => (
          <li key={s.showId} className="row">
            <button className="row-main" onClick={() => onPick(s)}>
              <Poster src={s.poster} name={s.showName} />
              <div className="row-text">
                <span className="row-title">{s.showName}</span>
                <span className="muted">{[s.year, s.network, s.genres.slice(0, 2).join(', ')].filter(Boolean).join(' · ')}</span>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
