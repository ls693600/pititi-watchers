import { Fragment, useEffect, useRef, useState } from 'react'
import { AvgStars, Stars } from '../components/Stars'
import { Icon } from '../components/Icon'
import { Poster } from '../components/Poster'
import { Avatar } from '../components/Avatar'
import { FamilyChat } from '../components/FamilyChat'
import { Reactions } from '../components/Reactions'
import { airLabel, averageRating, canReact, isPriorWatch, rewatchPair, findDuplicate, premiereMonthFix, canEditRating, canSeeRating, capToAired, defaultSeason, monthLabel, pendingRaters, tapEpisode, timesWatchedFor, withSeason } from '../logic'
import { bigPoster, getEpisodes, getSeasons, getShowInfo, type EpisodeInfo, type SeasonInfo, type ShowInfo } from '../tvmaze'
import type { Comment, Person, Reaction, Watch } from '../types'
import { drawShowCard, shareImage } from '../share'

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
  /** Combine this log with a duplicate of the same season (keeps this one) */
  onMerge: (keep: Watch, drop: Watch) => void
  onFlash: (msg: string) => void
  /** Reactions and chat are available (migration 006 run, and the log is saved) */
  social: boolean
  reactions: Reaction[]
  comments: Comment[]
  onReact: (targetId: string, emoji: string) => void
  onComment: (text: string) => Promise<boolean>
  onRemoveComment: (c: Comment) => void
  onClose: () => void
}

export function Detail({ initial, isNew, watches, people, me, viewer, saving, canDelete, onSave, onDelete, onMerge, onFlash, social, reactions, comments, onReact, onComment, onRemoveComment, onClose }: Props) {
  const [w, setW] = useState<Watch>(initial)
  const [seasons, setSeasons] = useState<SeasonInfo[] | null>(null)
  const [info, setInfo] = useState<ShowInfo | null>(null)
  const [episodes, setEpisodes] = useState<EpisodeInfo[] | null>(null)
  const [moreSynopsis, setMoreSynopsis] = useState(false)
  const [sharing, setSharing] = useState(false)
  // Fixed for the life of the page; used to fade episodes that haven't aired
  const [today] = useState(() => new Date().toISOString().slice(0, 10))
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

  // Synopsis, rating and the next air date (best effort: the page works without them)
  useEffect(() => {
    let alive = true
    getShowInfo(initial.showId)
      .then((i) => alive && setInfo(i))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [initial.showId])

  // Episode grid for the season being logged
  const seasonId = seasons?.find((x) => x.number === w.season)?.id
  useEffect(() => {
    if (!seasonId) return
    let alive = true
    getEpisodes(seasonId)
      .then((e) => alive && setEpisodes(e))
      .catch(() => alive && setEpisodes(null))
    return () => {
      alive = false
    }
  }, [seasonId])

  // Episodes out so far; anything later is announced but can't have been watched
  const airedCount = episodes ? episodes.filter((e) => e.airdate != null && e.airdate <= today).length : null
  const overCounted = airedCount != null && w.episodesWatched > airedCount
  // Data health: a second open log of this season, or a log filed before the season premiered
  const duplicate = isNew ? null : findDuplicate(watches, w)
  const pair = isNew || duplicate ? null : rewatchPair(watches, initial)
  const seasonInfo = seasons?.find((x) => x.number === w.season)
  const earlyMonth = premiereMonthFix(w.month, seasonInfo?.premiereDate)

  async function shareShow() {
    setSharing(true)
    try {
      const saved = initial
      const watchersList = people.filter((p) => saved.watchedBy.includes(p.id))
      const colors = ['#5b6cff', '#ff4d8d', '#12b886', '#f59f00', '#9b5de5', '#ff6b3d', '#0ea5e9', '#e64980']
      const blob = await drawShowCard({
        name: saved.showName,
        meta: [`Season ${saved.season}`, saved.network, saved.status === 'done' ? 'finished' : 'watching now'].filter(Boolean).join(' · '),
        poster: saved.poster,
        // Blind rating holds for shares too: only stars this phone is allowed to see
        ratings: watchersList.map((p) => ({
          name: p.name,
          color: colors[people.findIndex((x) => x.id === p.id) % colors.length],
          stars: canSeeRating(saved, p.id, viewer) ? (saved.ratings[p.id] ?? null) : null,
        })),
        average: averageRating(saved),
        names: watchersList.map((p) => p.name).join(' & ') || 'Our family',
      })
      const result = await shareImage(blob, `pititi-${saved.showName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`, `${saved.showName} on Pititi Watchers`)
      if (result === 'saved') onFlash('Picture saved. Send it from your photos or files.')
    } catch {
      onFlash("Couldn't make the picture. Check your connection and try again.")
    } finally {
      setSharing(false)
    }
  }

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
  const times = timesWatchedFor(watches, w)
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
        {!isNew && (
          <button className="icon-btn glass share" aria-label={`Share ${w.showName}`} onClick={shareShow} disabled={sharing}>
            <Icon name="share" size={19} />
          </button>
        )}
        <div className="dhead-id">
          <Poster src={bigPoster(w.poster)} name={w.showName} w={108} />
          <div style={{ minWidth: 0, paddingBottom: 4 }}>
            {isNew && <span className="badge admin" style={{ marginBottom: 8 }}>New log</span>}
            <h1>{w.showName}</h1>
            <p className="dhead-meta">{[w.year, w.network, w.genres.slice(0, 2).join(', ')].filter(Boolean).join(' · ')}</p>
          </div>
        </div>
      </div>

      {duplicate && (
        <div className="health-card" role="alert">
          <Icon name="info" size={20} stroke={2.2} />
          <div>
            <b>This season is logged twice</b>
            <p>
              Another log of Season {w.season} ({duplicate.episodesWatched} {duplicate.episodesWatched === 1 ? 'episode' : 'episodes'},{' '}
              {monthLabel(duplicate.month)}) makes it look watched twice. Merge keeps the furthest progress, everyone who watched and all
              ratings.
            </p>
            <button className="btn sm dark" onClick={() => onMerge(w, duplicate)}>Merge into one</button>
          </div>
        </div>
      )}

      {pair && (
        <div className="health-card" role="alert">
          <Icon name="repeat" size={20} stroke={2.2} />
          <div>
            <b>Watched {timesWatchedFor(watches, w)} times?</b>
            <p>
              Season {w.season} is also logged in {monthLabel(pair.month)}, so it counts as a rewatch. If you only watched it once, merge them:
              it keeps the progress, everyone who watched and all ratings.
            </p>
            <button className="btn sm dark" onClick={() => onMerge(w, pair)}>Only once · merge</button>
          </div>
        </div>
      )}

      {/* Older logs could be flagged as rewatches by the duplicate bug; one tap clears it (and Undo brings it back) */}
      {!isNew && !duplicate && initial.isRewatch && !isPriorWatch(watches, w.showId, w.season, w.id) && (
        <div className="health-card" role="alert">
          <Icon name="repeat" size={20} stroke={2.2} />
          <div>
            <b>Marked as a rewatch</b>
            <p>
              There's no earlier viewing of Season {w.season} in your log, so it shows as watched twice. If you'd seen it before you started
              using Pititi, keep it.
            </p>
            <button className="btn sm dark" onClick={() => onSave({ ...w, isRewatch: false, updatedAt: new Date().toISOString() })}>
              First time watching
            </button>
          </div>
        </div>
      )}

      {earlyMonth && !isNew && (
        <div className="health-card" role="alert">
          <Icon name="calendar" size={20} stroke={2.2} />
          <div>
            <b>Filed before it aired</b>
            <p>
              This log is in {monthLabel(w.month)}, but Season {w.season} premiered in {monthLabel(earlyMonth)}.
            </p>
            <button className="btn sm dark" onClick={() => setW((cur) => ({ ...cur, month: earlyMonth }))}>
              Move to {monthLabel(earlyMonth)}
            </button>
          </div>
        </div>
      )}

      {info && (
        <section className="show-info">
          <div className="meta-pills">
            {info.rating != null && (
              <span>
                <b className="gold">★</b> {info.rating.toFixed(1)}
              </span>
            )}
            {info.status && <span>{info.status === 'Running' ? 'Still airing' : info.status === 'Ended' ? 'Ended' : info.status}</span>}
            {info.runtime != null && <span>~{info.runtime} min</span>}
            {seasons && seasons.length > 0 && (() => {
              const n = seasons.filter((x) => x.aired).length || seasons.length
              return <span>{n} {n === 1 ? 'season' : 'seasons'}</span>
            })()}
          </div>
          {info.summary && (
            <button className={`synopsis ${moreSynopsis ? 'open' : ''}`} onClick={() => setMoreSynopsis(!moreSynopsis)} aria-expanded={moreSynopsis}>
              {info.summary}
            </button>
          )}
          {info.nextEpisode && (
            <div className="next-air">
              <span className="next-air-icon"><Icon name="calendar" size={20} /></span>
              <div>
                <b>Next episode: {airLabel(info.nextEpisode.airdate)}</b>
                <p className="muted">
                  S{info.nextEpisode.season} E{info.nextEpisode.number}
                  {info.nextEpisode.name ? ` · ${info.nextEpisode.name}` : ''}
                </p>
              </div>
            </div>
          )}
        </section>
      )}

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
          // Reactions go on what's saved and revealed, never on stars still being edited
          const reactable = social && savedComplete && initial.ratings[p.id] != null
          return (
            <Fragment key={p.id}>
            <div className="field">
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
            {reactable && (
              <Reactions
                watchId={initial.id}
                targetId={p.id}
                reactions={reactions}
                people={people}
                me={me}
                canReact={canReact(initial, p.id, me)}
                onReact={onReact}
              />
            )}
            </Fragment>
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

      {social && (
        <FamilyChat
          watch={initial}
          comments={comments}
          people={people}
          me={me}
          onSend={onComment}
          onRemove={onRemoveComment}
        />
      )}

      {episodes && episodes.length > 0 && (
        <section className="card pad">
          <div className="eps-head">
            <b>Season {w.season} · {w.episodesWatched} of {total ?? episodes.length}</b>
            <span className="muted">Tap the last one you watched</span>
          </div>
          {overCounted && (
            <div className="eps-warn" role="alert">
              <span>
                Only {airedCount} of {total ?? episodes.length} episodes have aired, so this log counts {w.episodesWatched - airedCount!} that
                haven't happened yet.
              </span>
              <button className="btn sm dark" onClick={() => setW((cur) => capToAired({ ...cur, status: 'done' }, airedCount))}>
                Fix: set to {airedCount}
              </button>
            </div>
          )}
          {!overCounted && airedCount != null && total != null && airedCount < total && w.episodesWatched === airedCount && (
            <p className="eps-note">Caught up. {total - airedCount} more episodes still to air.</p>
          )}
          <div className="eps" role="group" aria-label={`Season ${w.season} episodes`}>
            {episodes.map((e) => {
              const watched = e.number <= w.episodesWatched
              const next = e.number === w.episodesWatched + 1
              const upcoming = e.airdate != null && e.airdate > today
              return (
                <button
                  key={e.number}
                  className={`ep ${watched ? 'w' : ''} ${next ? 'n' : ''} ${upcoming ? 'u' : ''}`}
                  aria-pressed={watched}
                  aria-label={`Episode ${e.number}${e.name ? `: ${e.name}` : ''}${upcoming && e.airdate ? `, airs ${airLabel(e.airdate)}` : ''}`}
                  title={e.name}
                  disabled={upcoming && !watched}
                  onClick={() => setW((cur) => tapEpisode({ ...cur, totalEpisodes: cur.totalEpisodes ?? episodes.length }, e.number, airedCount))}
                >
                  {e.number}
                </button>
              )
            })}
          </div>
        </section>
      )}

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
                onClick={() => setW((cur) => capToAired({ ...cur, status: s, episodesWatched: s === 'done' && total ? total : cur.episodesWatched }, airedCount))}
              >
                {s === 'watching' ? 'Watching' : 'Finished'}
              </button>
            ))}
          </div>
        </div>

        {!(episodes && episodes.length > 0) && (
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
        )}

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
            // No "are you sure?": the message after removing has Undo
            onClick={() => onDelete(w)}
          >
            <Icon name="trash" size={18} /> Remove from log
          </button>
        )}
      </div>
    </div>
  )
}
