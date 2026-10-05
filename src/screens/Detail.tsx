import { useEffect, useRef, useState } from 'react'
import { AvgStars, Stars } from '../components/Stars'
import { Icon } from '../components/Icon'
import { Poster } from '../components/Poster'
import { Avatar } from '../components/Avatar'
import { averageRating, canEditRating, canSeeRating, defaultSeason, monthLabel, pendingRaters, timesWatched, withSeason } from '../logic'
import { bigPoster, getSeasons, type SeasonInfo } from '../tvmaze'
import type { Person, Watch } from '../types'

interface Props {
  initial: Watch
  isNew: boolean
  watches: Watch[]
  people: Person[]
  me: string | null
  /** Signed-in person; null in single-phone mode (no blind rating there) */
  viewer: string | null
  saving: boolean
  canDelete: boolean
  onSave: (w: Watch) => void
  onDelete: (w: Watch) => void
  onClose: () => void
}

export function Detail({ initial, isNew, watches, people, me, viewer, saving, canDelete, onSave, onDelete, onClose }: Props) {
  const [w, setW] = useState<Watch>(initial)
  const [seasons, setSeasons] = useState<SeasonInfo[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Read the latest list without re-running the season fetch on every live sync
  const watchesRef = useRef(watches)
  useEffect(() => {
    watchesRef.current = watches
  }, [watches])

  useEffect(() => {
    let alive = true
    getSeasons(initial.showId)
      .then((s) => {
        if (!alive) return
        setSeasons(s)
        // New logs default to the latest aired season, unless Quick log already picked one
        if (isNew && s.length && initial.totalEpisodes == null) {
          const latest = defaultSeason(s)!
          setW((cur) => withSeason(cur, latest, watchesRef.current))
        }
      })
      .catch(() => alive && setSeasons([]))
    return () => {
      alive = false
    }
  }, [initial.showId, initial.totalEpisodes, isNew])

  const set = (patch: Partial<Watch>) => setW((cur) => ({ ...cur, ...patch }))
  const avg = averageRating(w)
  // Blind rating follows what's saved, so tapping your stars never spoils the reveal
  const savedComplete = averageRating(initial) != null
  const blind = viewer != null && !savedComplete && w.watchedBy.length > 1
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? 'Someone'
  const watchers = people.filter((p) => w.watchedBy.includes(p.id))

  function toggleWatcher(id: string) {
    setW((cur) => {
      if (cur.watchedBy.includes(id)) {
        // Their rating goes with them
        const rest = { ...cur.ratings }
        delete rest[id]
        return { ...cur, watchedBy: cur.watchedBy.filter((x) => x !== id), ratings: rest }
      }
      return { ...cur, watchedBy: [...cur.watchedBy, id] }
    })
  }

  function rate(id: string, v: number | null) {
    setW((cur) => {
      const ratings = { ...cur.ratings }
      if (v == null) delete ratings[id]
      else ratings[id] = v
      return { ...cur, ratings }
    })
  }
  const times = timesWatched(watches, w.showId, w.season) + (isNew ? 1 : 0)
  const total = w.totalEpisodes

  function save() {
    if (!w.watchedBy.length) return setError('Pick who watched it.')
    if (!/^\d{4}-\d{2}$/.test(w.month)) return setError('Pick the month you watched it.')
    if (total != null && w.episodesWatched > total) return setError(`Season ${w.season} only has ${total} episodes.`)
    setError(null)
    onSave({ ...w, updatedAt: new Date().toISOString() })
  }

  return (
    <div className="screen detail">
      <div className="dhead">
        {w.poster && <img src={bigPoster(w.poster)!} alt="" className="dhead-bg" />}
        <button className="icon-btn glass close" aria-label="Close" onClick={onClose}>
          <Icon name="close" size={20} />
        </button>
        <div className="dhead-id">
          <Poster src={bigPoster(w.poster)} name={w.showName} w={108} />
          <div style={{ minWidth: 0, paddingBottom: 4 }}>
            {isNew && <span className="badge admin" style={{ marginBottom: 8 }}>New log</span>}
            <h1>{w.showName}</h1>
            <p className="dhead-meta">{[w.year, w.network, w.genres.slice(0, 2).join(', ')].filter(Boolean).join(' · ')}</p>
          </div>
        </div>
      </div>

      <section className="card">
        <p className="field-label">Who watched?</p>
        <div className="chips" role="group" aria-label="Watched by">
          {people.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={w.watchedBy.includes(p.id)}
              className={w.watchedBy.includes(p.id) ? 'on' : ''}
              onClick={() => toggleWatcher(p.id)}
            >
              <Avatar people={people} id={p.id} size={22} /> {p.name}
            </button>
          ))}
        </div>
        {watchers.map((p) => {
          const stars = w.ratings[p.id] ?? null
          const editable = canEditRating(p, viewer)
          const visible = editable || (savedComplete ? true : canSeeRating(w, p.id, viewer) && !blind)
          return (
            <div key={p.id} className="field">
              <span className="who">
                <Avatar people={people} id={p.id} />
                {p.name}
                {me === p.id && <span className="you">you</span>}
              </span>
              {editable ? (
                <Stars label={p.name} value={stars} onChange={(v) => rate(p.id, v)} />
              ) : visible && stars != null ? (
                <AvgStars value={stars} size={22} />
              ) : (
                <span className={`hidden-rating ${stars != null ? 'done' : ''}`}>
                  <Icon name={stars != null ? 'lock' : 'clock'} size={15} stroke={2.2} />
                  {stars != null ? 'Rated · hidden' : 'Not rated yet'}
                </span>
              )}
            </div>
          )
        })}
        {watchers.length > 0 && (
          <div className="avg-row">
            <span className="label">
              Average
              {avg != null && !blind && <span className="big grad-text">{avg.toFixed(1)}</span>}
            </span>
            {avg != null && !blind ? (
              <AvgStars value={avg} size={24} />
            ) : avg != null ? (
              <span className="save-to-reveal">
                <Icon name="sparkle" size={16} stroke={2.2} /> Save to reveal
              </span>
            ) : (
              <span className="muted" style={{ textAlign: 'right' }}>
                {viewer && watchers.length > 1 ? 'Revealed when everyone rates' : 'Waiting for'}
                <br />
                <b style={{ color: 'var(--text-2)' }}>{pendingRaters(w).map(nameOf).join(', ')}</b>
              </span>
            )}
          </div>
        )}
      </section>

      <section className="card">
        <label className="field">
          <span>Season</span>
          {seasons && seasons.length > 0 ? (
            <select
              value={w.season}
              onChange={(e) => {
                const s = seasons.find((x) => x.number === Number(e.target.value))
                if (s) setW((cur) => withSeason(cur, s, watches))
              }}
            >
              {seasons.map((s) => (
                <option key={s.number} value={s.number}>
                  Season {s.number}{s.episodes ? ` · ${s.episodes} eps` : ''}{s.aired ? '' : ' · upcoming'}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="number"
              min={1}
              inputMode="numeric"
              value={w.season}
              onChange={(e) => set({ season: Math.max(1, Number(e.target.value) || 1) })}
              aria-label="Season number"
            />
          )}
        </label>

        <div className="field">
          <span>Status</span>
          <div className="segmented" role="radiogroup" aria-label="Status">
            {(['watching', 'done'] as const).map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={w.status === s}
                className={w.status === s ? 'on' : ''}
                onClick={() => set({ status: s, episodesWatched: s === 'done' && total ? total : w.episodesWatched })}
              >
                {s === 'watching' ? 'Watching' : 'Finished'}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span>Episodes</span>
          <div className="stepper">
            <button aria-label="One episode less" onClick={() => set({ episodesWatched: Math.max(0, w.episodesWatched - 1) })}>
              <Icon name="minus" size={18} />
            </button>
            <span aria-live="polite">{w.episodesWatched}{total ? ` / ${total}` : ''}</span>
            <button
              aria-label="One episode more"
              onClick={() => {
                const n = total ? Math.min(total, w.episodesWatched + 1) : w.episodesWatched + 1
                set({ episodesWatched: n, status: total && n >= total ? 'done' : w.status })
              }}
            >
              <Icon name="plus" size={18} />
            </button>
          </div>
        </div>

        <label className="field">
          <span>Watched in</span>
          <input type="month" value={w.month} onChange={(e) => set({ month: e.target.value })} aria-label="Month watched" />
        </label>

        <div className="field">
          <span>Rewatch</span>
          <button
            type="button"
            role="switch"
            aria-checked={w.isRewatch}
            aria-label="Rewatch"
            className={`toggle ${w.isRewatch ? 'on' : ''}`}
            onClick={() => set({ isRewatch: !w.isRewatch })}
          >
            <span />
          </button>
        </div>

        <div className="field">
          <span>Times watched</span>
          <strong>{times}</strong>
        </div>
      </section>

      <section className="card">
        <label className="notes">
          <span className="field-label" style={{ paddingTop: 0 }}>Notes</span>
          <textarea
            value={w.notes}
            maxLength={1000}
            placeholder="That finale though…"
            onChange={(e) => set({ notes: e.target.value })}
          />
        </label>
      </section>

      {error && <p className="error" role="alert">{error}</p>}

      <div className="actions">
        <button className="btn primary block" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : isNew ? `Add to ${monthLabel(w.month)}` : 'Save changes'}
        </button>
        {!isNew && canDelete && (
          <button
            className="btn danger block"
            onClick={() => {
              if (confirm(`Remove ${w.showName} season ${w.season} from ${monthLabel(w.month)}? This can't be undone.`)) onDelete(w)
            }}
          >
            <Icon name="trash" size={18} /> Remove from log
          </button>
        )}
      </div>
    </div>
  )
}
