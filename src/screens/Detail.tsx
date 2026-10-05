import { useEffect, useRef, useState } from 'react'
import { AvgStars, Stars } from '../components/Stars'
import { Icon } from '../components/Icon'
import { Poster } from '../components/Poster'
import { PEOPLE } from '../config'
import { coupleAverage, isPriorWatch, monthLabel, timesWatched } from '../logic'
import { getSeasons, type SeasonInfo } from '../tvmaze'
import type { PersonId, Watch } from '../types'

interface Props {
  initial: Watch
  isNew: boolean
  watches: Watch[]
  me: PersonId | null
  saving: boolean
  onSave: (w: Watch) => void
  onDelete: (w: Watch) => void
  onClose: () => void
}

export function Detail({ initial, isNew, watches, me, saving, onSave, onDelete, onClose }: Props) {
  const [w, setW] = useState<Watch>(initial)
  const [seasons, setSeasons] = useState<SeasonInfo[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Read the latest list without re-running the season fetch on every live sync
  const watchesRef = useRef(watches)
  watchesRef.current = watches

  useEffect(() => {
    let alive = true
    getSeasons(initial.showId)
      .then((s) => {
        if (!alive) return
        setSeasons(s)
        // New logs default to the latest season that has aired
        if (isNew && s.length) {
          const latest = s.filter((x) => x.aired).at(-1) ?? s[0]
          setW((cur) => applySeason(cur, latest, watchesRef.current))
        }
      })
      .catch(() => alive && setSeasons([]))
    return () => {
      alive = false
    }
  }, [initial.showId, isNew])

  const set = (patch: Partial<Watch>) => setW((cur) => ({ ...cur, ...patch }))
  const avg = coupleAverage(w)
  const times = timesWatched(watches, w.showId, w.season) + (isNew ? 1 : 0)
  const total = w.totalEpisodes

  function save() {
    if (!/^\d{4}-\d{2}$/.test(w.month)) return setError('Pick the month you watched it.')
    if (total != null && w.episodesWatched > total) return setError(`Season ${w.season} only has ${total} episodes.`)
    setError(null)
    onSave({ ...w, updatedAt: new Date().toISOString() })
  }

  return (
    <div className="screen detail">
      <div className="detail-head">
        {w.poster && <img src={w.poster} alt="" className="hero-bg" />}
        <button className="icon-btn close" aria-label="Close" onClick={onClose}>
          <Icon name="close" />
        </button>
        <div className="detail-id">
          <Poster src={w.poster} name={w.showName} w={72} />
          <div>
            <h1>{w.showName}</h1>
            <p className="muted">{[w.year, w.network, w.genres.slice(0, 2).join(', ')].filter(Boolean).join(' · ')}</p>
          </div>
        </div>
      </div>

      <section className="card">
        {PEOPLE.map((p) => (
          <div key={p.id} className="field">
            <span className="who">
              <span className={`av ${p.id}`}>{p.name[0]}</span>
              {p.name}
              {me === p.id && <span className="you">you</span>}
            </span>
            <Stars
              label={p.name}
              value={w.ratings[p.id]}
              onChange={(v) => set({ ratings: { ...w.ratings, [p.id]: v } })}
            />
          </div>
        ))}
        <div className="field average">
          <span className="who">
            Average {avg != null && <strong className="avg-num">{avg.toFixed(1)}</strong>}
          </span>
          {avg != null ? (
            <AvgStars value={avg} />
          ) : (
            <span className="muted">
              Waiting for {PEOPLE.filter((p) => w.ratings[p.id] == null).map((p) => p.name).join(' and ')}
            </span>
          )}
        </div>
      </section>

      <section className="card">
        <label className="field">
          <span>Season</span>
          {seasons && seasons.length > 0 ? (
            <select
              value={w.season}
              onChange={(e) => {
                const s = seasons.find((x) => x.number === Number(e.target.value))
                if (s) setW((cur) => applySeason(cur, s, watches))
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
          <span className="muted">Notes</span>
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
          {saving ? 'Saving…' : isNew ? 'Add to log' : 'Save changes'}
        </button>
        {!isNew && (
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

function applySeason(cur: Watch, s: SeasonInfo, all: Watch[]): Watch {
  return {
    ...cur,
    season: s.number,
    totalEpisodes: s.episodes,
    episodesWatched: cur.status === 'done' && s.episodes ? s.episodes : Math.min(cur.episodesWatched, s.episodes ?? Infinity),
    isRewatch: isPriorWatch(all, cur.showId, s.number, cur.id),
  }
}
