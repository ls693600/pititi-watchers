import { useEffect, useRef, useState } from 'react'
import { defaultSeason, monthLabel, withSeason } from '../logic'
import { getAiredCount, getSeasons, type SeasonInfo } from '../tvmaze'
import type { Person, Watch } from '../types'
import { Avatar } from './Avatar'
import { Icon } from './Icon'
import { Poster } from './Poster'
import { Stars } from './Stars'

interface Props {
  draft: Watch
  watches: Watch[]
  people: Person[]
  /** Who is using this phone (rates in Quick log) */
  me: string | null
  saving: boolean
  onLog: (w: Watch) => void
  onMore: (w: Watch) => void
  onClose: () => void
}

/** Adds the aired-episode count to a season that's still airing (no-op otherwise). */
async function withAired(s: SeasonInfo): Promise<SeasonInfo> {
  if (!s.inProgress || !s.id || s.airedEpisodes != null) return s
  try {
    return { ...s, airedEpisodes: await getAiredCount(s.id) }
  } catch {
    return s
  }
}

/** Bottom sheet: log a show in three taps. Month, rewatch and notes live under More options. */
export function QuickLog({ draft, watches, people, me, saving, onLog, onMore, onClose }: Props) {
  const [w, setW] = useState<Watch>(draft)
  const [seasons, setSeasons] = useState<SeasonInfo[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const watchesRef = useRef(watches)
  useEffect(() => {
    watchesRef.current = watches
  }, [watches])

  useEffect(() => {
    let alive = true
    getSeasons(draft.showId)
      .then((s) => {
        if (!alive) return
        setSeasons(s)
        const latest = defaultSeason(s)
        if (!latest) return
        setW((cur) => withSeason({ ...cur, status: 'done' }, latest, watchesRef.current))
        // Still airing: find out how many episodes are actually out before "finished" counts them
        withAired(latest).then((full) => {
          if (!alive || full === latest) return
          setSeasons((list) => list?.map((x) => (x.number === full.number ? full : x)) ?? list)
          setW((cur) => (cur.season === full.number ? withSeason(cur, full, watchesRef.current) : cur))
        })
      })
      .catch(() => alive && setSeasons([]))
    return () => {
      alive = false
    }
  }, [draft.showId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const total = w.totalEpisodes
  const season = seasons?.find((x) => x.number === w.season)
  const aired = season?.airedEpisodes ?? null
  const airing = aired != null && total != null && aired < total
  // On a season that's still airing, "Finished it" means caught up with everything out so far
  const finished = airing ? w.episodesWatched >= aired : w.status === 'done'
  const iWatched = me != null && w.watchedBy.includes(me)
  const others = people.filter((p) => p.id !== me && w.watchedBy.includes(p.id) && p.userId)

  function setStatus(done: boolean) {
    if (airing) {
      setW((cur) => ({ ...cur, status: 'watching', episodesWatched: done ? aired! : Math.min(1, aired!) }))
      return
    }
    setW((cur) => ({
      ...cur,
      status: done ? 'done' : 'watching',
      // Switching to "still watching" starts at episode 1; the stepper adjusts from there
      episodesWatched: done ? (cur.totalEpisodes ?? cur.episodesWatched) : Math.min(1, Math.max(0, (cur.totalEpisodes ?? 2) - 1)),
    }))
  }

  function toggleWatcher(id: string) {
    setW((cur) => {
      if (!cur.watchedBy.includes(id)) return { ...cur, watchedBy: [...cur.watchedBy, id] }
      const ratings = { ...cur.ratings }
      delete ratings[id]
      return { ...cur, watchedBy: cur.watchedBy.filter((x) => x !== id), ratings }
    })
    setError(null)
  }

  function rate(v: number | null) {
    if (!me) return
    setW((cur) => {
      const ratings = { ...cur.ratings }
      if (v == null) delete ratings[me]
      else ratings[me] = v
      return { ...cur, ratings }
    })
  }

  function submit() {
    if (!w.watchedBy.length) return setError('Pick who watched it.')
    onLog({ ...w, updatedAt: new Date().toISOString() })
  }

  return (
    <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label={`Log ${w.showName}`}>
      <button className="sheet-dim" aria-label="Close" onClick={onClose} />
      <div className="sheet">
        <div className="grabber" aria-hidden="true" />
        <div className="sheet-show">
          <Poster src={w.poster} name={w.showName} w={64} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <p className="label-sm">
              Quick log · {monthLabel(w.month, 'long').split(' ')[0]}
              {w.isRewatch && <span className="rewatch-tag"><Icon name="repeat" size={11} stroke={2.6} /> Rewatch</span>}
            </p>
            <h2 className="sheet-title">{w.showName}</h2>
            <div className="sheet-meta">
              {seasons && seasons.length > 1 ? (
                <label className="season-pick">
                  Season {w.season}
                  <Icon name="right" size={13} stroke={2.6} />
                  <select
                    value={w.season}
                    aria-label="Season"
                    onChange={(e) => {
                      const s = seasons.find((x) => x.number === Number(e.target.value))
                      if (!s) return
                      setW((cur) => withSeason(cur, s, watches))
                      withAired(s).then((full) => {
                        if (full === s) return
                        setSeasons((list) => list?.map((x) => (x.number === full.number ? full : x)) ?? list)
                        setW((cur) => (cur.season === full.number ? withSeason(cur, full, watchesRef.current) : cur))
                      })
                    }}
                  >
                    {seasons.map((s) => (
                      <option key={s.number} value={s.number}>
                        Season {s.number}{s.aired ? '' : ' (upcoming)'}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <span>Season {w.season}</span>
              )}
              {total ? <span> · {total} episodes</span> : null}
            </div>
          </div>
          <button className="icon-btn" aria-label="Close" onClick={onClose} style={{ alignSelf: 'flex-start' }}>
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="big-choice" role="radiogroup" aria-label="Status">
          <button role="radio" aria-checked={finished} className={finished ? 'on' : ''} onClick={() => setStatus(true)}>
            <Icon name="check" size={18} stroke={2.6} />
            <b>{airing ? 'Caught up' : 'Finished it'}</b>
            <small>{airing ? `All ${aired} aired of ${total}` : total ? `All ${total} episodes` : 'The whole season'}</small>
          </button>
          <button role="radio" aria-checked={!finished} className={!finished ? 'on' : ''} onClick={() => setStatus(false)}>
            <Icon name="play" size={16} stroke={2.2} />
            <b>Still watching</b>
            <small>Track episodes</small>
          </button>
        </div>

        {!finished && (
          <div className="field" style={{ borderBottom: 0, minHeight: 0 }}>
            <span>On episode</span>
            <div className="stepper">
              <button aria-label="One episode less" onClick={() => setW((c) => ({ ...c, episodesWatched: Math.max(0, c.episodesWatched - 1) }))}>
                <Icon name="minus" size={18} />
              </button>
              <span aria-live="polite">{w.episodesWatched}{total ? ` / ${total}` : ''}</span>
              <button
                aria-label="One episode more"
                onClick={() =>
                  setW((c) => ({ ...c, episodesWatched: Math.min(airing ? aired! : total ? total - 1 : Infinity, c.episodesWatched + 1) }))
                }
              >
                <Icon name="plus" size={18} />
              </button>
            </div>
          </div>
        )}

        <div>
          <p className="label-sm" style={{ marginBottom: 8 }}>Who watched?</p>
          <div className="chips" style={{ padding: 0 }} role="group" aria-label="Who watched">
            {people.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={w.watchedBy.includes(p.id)}
                className={w.watchedBy.includes(p.id) ? 'on' : ''}
                onClick={() => toggleWatcher(p.id)}
              >
                <Avatar people={people} id={p.id} size={24} /> {p.name}
              </button>
            ))}
          </div>
        </div>

        {(w.status === 'done' || airing) && finished && iWatched && (
          <div className="quick-rate">
            <p className="label-sm">Your rating</p>
            <div className="quick-stars">
              <Stars label="Your" value={w.ratings[me!] ?? null} onChange={rate} />
            </div>
            {others.length > 0 && (
              <p className="muted">{others.map((p) => p.name).join(' and ')} won't see your stars until everyone rates</p>
            )}
          </div>
        )}

        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary block" onClick={submit} disabled={saving}>
          {saving ? 'Saving…' : 'Log it'}
        </button>
        <button className="more" onClick={() => onMore(w)}>
          More options: month, rewatch, notes
        </button>
      </div>
    </div>
  )
}
