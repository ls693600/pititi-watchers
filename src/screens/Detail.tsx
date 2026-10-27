import { Fragment, useEffect, useRef, useState } from 'react'
import { AvgStars, Stars } from '../components/Stars'
import { Icon } from '../components/Icon'
import { Poster } from '../components/Poster'
import { Avatar } from '../components/Avatar'
import { FamilyChat } from '../components/FamilyChat'
import { Reactions } from '../components/Reactions'
import { airLabel, averageRating, canReact, titleOf, logForSeason, nextSeasonDraft, newId, isPriorWatch, rewatchPair, scoreLabel, togetherWatchers, findDuplicate, premiereMonthFix, canEditRating, canSeeRating, capToAired, defaultSeason, monthLabel, moveToMonth, pendingRaters, strayWatchers, tapEpisode, timesWatchedFor, withSeason } from '../logic'
import { bigPoster, getEpisodes, getSeasons, getShowInfo, type EpisodeInfo, type SeasonInfo, type ShowInfo } from '../tvmaze'
import type { Comment, Person, Reaction, Title, Watch } from '../types'
import { drawShowCard, shareImage } from '../share'
import { getMovie, type MovieInfo } from '../movies'
import { t } from '../i18n'
import { TrailerSheet } from '../components/TrailerSheet'

interface Props {
  initial: Watch
  isNew: boolean
  watches: Watch[]
  people: Person[]
  /** Everyone incl. viewers: for chat names and reactions */
  everyone: Person[]
  /** Viewer: sees everything and chats, changes nothing */
  readOnly: boolean
  /** Another household's log: whose it is (shown instead of the viewer note) */
  owner?: string | null
  me: string | null
  /** Signed-in person; null in single-phone mode (no blind rating there) */
  viewer: string | null
  saving: boolean
  canDelete: boolean
  onSave: (w: Watch, msg?: string) => void
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
  /** Stars save the moment you tap them (an existing log), with Undo */
  onRate: (personId: string, stars: number | null) => void
  /** The show's chat was read on screen (clears the Messages badge) */
  onChatSeen: () => void
  /** Save to a list / Recommend */
  onMore?: (t: Title) => void
  /** Open another season's log (isNew: a fresh one to fill in) */
  onSwitchLog: (w: Watch, isNew: boolean) => void
  onClose: () => void
}

export function Detail({ initial, isNew, watches, people, everyone, readOnly, owner, me, viewer, saving, canDelete, onSave, onDelete, onMerge, onFlash, social, reactions, comments, onReact, onComment, onRemoveComment, onRate, onChatSeen, onMore, onSwitchLog, onClose }: Props) {
  const [w, setW] = useState<Watch>(initial)
  // The latest saved version: instant ratings and the other phone's changes land here
  const stored = isNew ? initial : (watches.find((x) => x.id === initial.id) ?? initial)
  const [seasons, setSeasons] = useState<SeasonInfo[] | null>(null)
  const [info, setInfo] = useState<ShowInfo | null>(null)
  const [movie, setMovie] = useState<MovieInfo | null>(null)
  const isMovie = initial.kind === 'movie'
  const [episodes, setEpisodes] = useState<EpisodeInfo[] | null>(null)
  const [moreSynopsis, setMoreSynopsis] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [trailer, setTrailer] = useState(false)
  // Fixed for the life of the page; used to fade episodes that haven't aired
  const [today] = useState(() => new Date().toISOString().slice(0, 10))
  const [error, setError] = useState<string | null>(null)
  // Read the latest list without re-running the season fetch on every live sync
  const watchesRef = useRef(watches)
  useEffect(() => {
    watchesRef.current = watches
  }, [watches])

  useEffect(() => {
    if (isMovie) return
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
  }, [initial.showId, initial.totalEpisodes, isNew, isMovie])

  // Synopsis, rating and the next air date (best effort: the page works without them)
  useEffect(() => {
    let alive = true
    // Movies: description, rating and where to watch in your country (TMDB)
    if (isMovie)
      getMovie(initial.showId)
        .then((m) => alive && setMovie(m))
        .catch(() => undefined)
    else
      getShowInfo(initial.showId)
        .then((i) => alive && setInfo(i))
        .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [initial.showId, isMovie])

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
  const pair = isNew || duplicate ? null : rewatchPair(watches, stored)
  const seasonInfo = seasons?.find((x) => x.number === w.season)
  // People from another household on this log (an older merge with another family's copy pulled them in)
  const strays = isNew ? [] : strayWatchers(stored, everyone)
  const earlyMonth = premiereMonthFix(w.month, seasonInfo?.premiereDate)

  async function shareShow() {
    setSharing(true)
    try {
      const saved = stored
      const watchersList = people.filter((p) => saved.watchedBy.includes(p.id))
      const colors = ['#5b6cff', '#ff4d8d', '#12b886', '#f59f00', '#9b5de5', '#ff6b3d', '#0ea5e9', '#e64980']
      const blob = await drawShowCard({
        name: saved.showName,
        meta: [t('Season {n}', { n: saved.season }), saved.network, saved.status === 'done' ? t('finished') : t('watching now')].filter(Boolean).join(' · '),
        poster: saved.poster,
        averageLabel: saved.watchedBy.length === 1 ? t("{name}'s stars", { name: nameOf(saved.watchedBy[0]) }) : t('family average'),
        // Blind rating holds for shares too: only stars this phone is allowed to see
        ratings: watchersList.map((p) => ({
          name: p.name,
          color: colors[people.findIndex((x) => x.id === p.id) % colors.length],
          stars: canSeeRating(saved, p.id, viewer) ? (saved.ratings[p.id] ?? null) : null,
        })),
        average: averageRating(saved),
        names: watchersList.map((p) => p.name).join(' & ') || t('Our family'),
      })
      const result = await shareImage(blob, `pititi-${saved.showName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`, t('{show} on Pititi Watchers', { show: saved.showName }))
      if (result === 'saved') onFlash(t('Picture saved. Send it from your photos or files.'))
    } catch {
      onFlash(t("Couldn't make the picture. Check your connection and try again."))
    } finally {
      setSharing(false)
    }
  }

  const set = (patch: Partial<Watch>) => setW((cur) => ({ ...cur, ...patch }))
  const avg = averageRating(w)
  // Blind rating follows what's saved, so tapping your stars never spoils the reveal
  const savedComplete = averageRating(stored) != null
  const blind = viewer != null && !savedComplete && w.watchedBy.length > 1
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? t('Someone')
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
    // No "Save changes" needed for stars: closing the page can't lose them
    if (!isNew && stored.watchedBy.includes(id)) onRate(id, v)
  }
  const times = timesWatchedFor(watches, w)
  const total = w.totalEpisodes

  /** Saves the page; `patch` lets a one-tap fix (like moving the month) save straight away. */
  function save(patch?: (cur: Watch) => Watch, msg?: string) {
    saveLog(patch ? patch(w) : w, msg)
  }

  function saveLog(w: Watch, msg?: string) {
    if (!w.watchedBy.length) return setError(t('Pick who watched it.'))
    if (!/^\d{4}-\d{2}$/.test(w.month)) return setError(t('Pick the month you watched it.'))
    if (total != null && w.episodesWatched > total) return setError(t('Season {season} only has {n} episodes.', { season: w.season, n: total }))
    setError(null)
    // Stars you can't edit (other people's accounts) always come from the latest saved copy,
    // so saving notes here never wipes a rating someone just gave on their phone
    const ratings = Object.fromEntries(
      w.watchedBy.flatMap((id) => {
        const p = people.find((x) => x.id === id)
        const v = p && canEditRating(p, viewer) ? w.ratings[id] : stored.ratings[id]
        return v != null ? [[id, v]] : []
      }),
    )
    // A new log can't be filed before its season premiered: it goes to the premiere month
    const month = isNew && earlyMonth ? earlyMonth : w.month
    onSave({ ...w, month, ratings, updatedAt: new Date().toISOString() }, msg)
  }

  return (
    <div className="screen detail">
      <div className="dhead">
        {w.poster && <img src={bigPoster(w.poster)!} alt="" className="dhead-bg" />}
        <button className="icon-btn glass close" aria-label={t('Close')} onClick={onClose}>
          <Icon name="close" size={20} />
        </button>
        {!isNew && (
          <button className="icon-btn glass share" aria-label={t('Share {show}', { show: w.showName })} onClick={shareShow} disabled={sharing}>
            <Icon name="share" size={19} />
          </button>
        )}
        {!isNew && onMore && (
          <button className="icon-btn glass more" aria-label={t('Save or recommend {title}', { title: w.showName })} onClick={() => onMore(titleOf(w))}>
            <span aria-hidden="true" style={{ fontWeight: 800, letterSpacing: 1 }}>•••</span>
          </button>
        )}
        <div className="dhead-id">
          {/* The banner's poster plays the trailer */}
          <button type="button" className="poster-play" onClick={() => setTrailer(true)} aria-label={t('Watch the trailer of {title}', { title: w.showName })}>
            <Poster src={bigPoster(w.poster)} name={w.showName} w={108} />
            <span className="play-badge" aria-hidden="true">
              <Icon name="play" size={18} stroke={2.6} />
            </span>
          </button>
          <div style={{ minWidth: 0, paddingBottom: 4 }}>
            {isNew && <span className="badge admin" style={{ marginBottom: 8 }}>{t('New log')}</span>}
            <h1>{w.showName}</h1>
            <p className="dhead-meta">{[w.year, w.network, w.genres.slice(0, 2).join(', ')].filter(Boolean).join(' · ')}</p>
            <button type="button" className="trailer-pill" onClick={() => setTrailer(true)}>
              <Icon name="play" size={14} stroke={2.6} /> {t('Trailer')}
            </button>
          </div>
        </div>
      </div>

      {trailer && (
        <TrailerSheet
          kind={w.kind ?? 'tv'}
          extId={w.showId}
          title={w.showName}
          year={w.year}
          season={(w.kind ?? 'tv') === 'tv' ? w.season : 0}
          onClose={() => setTrailer(false)}
        />
      )}

      {!readOnly && duplicate && (
        <div className="health-card" role="alert">
          <Icon name="info" size={20} stroke={2.2} />
          <div>
            <b>{t('This season is logged twice')}</b>
            <p>
              {t('Another log of Season {season} ({episodes}, {month}) makes it look watched twice. Merge keeps the furthest progress, everyone who watched and all ratings.', {
                season: w.season,
                episodes: duplicate.episodesWatched === 1 ? t('{n} episode', { n: duplicate.episodesWatched }) : t('{n} episodes', { n: duplicate.episodesWatched }),
                month: monthLabel(duplicate.month),
              })}
            </p>
            <button className="btn sm dark" onClick={() => onMerge(w, duplicate)}>{t('Merge into one')}</button>
          </div>
        </div>
      )}

      {!readOnly && strays.length > 0 && (
        <div className="health-card" role="alert">
          <Icon name="users" size={20} stroke={2.2} />
          <div>
            <b>{t(strays.length === 1 ? "{names} isn't in your household" : "{names} aren't in your household", { names: strays.map((id) => everyone.find((p) => p.id === id)?.name ?? t('Someone')).join(' & ') })}</b>
            <p>{t("They were added to this log by mistake, from another family's log of the same show. Their log stays as it is.")}</p>
            <button
              className="btn sm dark"
              onClick={() => save((cur) => ({ ...cur, watchedBy: cur.watchedBy.filter((id) => !strays.includes(id)) }), t('Removed from this log'))}
            >
              {t('Remove from this log')}
            </button>
          </div>
        </div>
      )}

      {!readOnly && pair && (
        <div className="health-card" role="alert">
          <Icon name="repeat" size={20} stroke={2.2} />
          <div>
            <b>{t('Watched {n} times?', { n: timesWatchedFor(watches, w) })}</b>
            <p>
              {t('Season {season} is also logged in {month}, so it counts as a rewatch. If you only watched it once, merge them: it keeps the progress, everyone who watched and all ratings.', {
                season: w.season,
                month: monthLabel(pair.month),
              })}
            </p>
            <button className="btn sm dark" onClick={() => onMerge(w, pair)}>{t('Only once · merge')}</button>
          </div>
        </div>
      )}

      {/* Older logs could be flagged as rewatches by the duplicate bug; one tap clears it (and Undo brings it back) */}
      {!readOnly && !isNew && !duplicate && stored.isRewatch && !isPriorWatch(watches, w.showId, w.season, w.id, w.kind ?? 'tv', w.householdId ?? null) && (
        <div className="health-card" role="alert">
          <Icon name="repeat" size={20} stroke={2.2} />
          <div>
            <b>{t('Marked as a rewatch')}</b>
            <p>
              {t("There's no earlier viewing of Season {season} in your log, so it shows as watched twice. If you'd seen it before you started using Pititi, keep it.", { season: w.season })}
            </p>
            <button className="btn sm dark" onClick={() => onSave({ ...w, isRewatch: false, updatedAt: new Date().toISOString() })}>
              {t('First time watching')}
            </button>
          </div>
        </div>
      )}

      {!readOnly && earlyMonth && !isNew && (
        <div className="health-card" role="alert">
          <Icon name="calendar" size={20} stroke={2.2} />
          <div>
            <b>{t('Filed before it aired')}</b>
            <p>
              {t('This log is in {month}, but Season {season} premiered in {premiere}.', { month: monthLabel(w.month), season: w.season, premiere: monthLabel(earlyMonth) })}
            </p>
            <button className="btn sm dark" onClick={() => save((cur) => moveToMonth(cur, earlyMonth), t('Moved to {month}', { month: monthLabel(earlyMonth) }))}>
              {t('Move to {month}', { month: monthLabel(earlyMonth) })}
            </button>
          </div>
        </div>
      )}

      {movie && (
        <section className="show-info">
          <div className="meta-pills">
            <span>{t('Movie')}</span>
            {movie.rating != null && (
              <span>
                <b className="gold">★</b> {movie.rating.toFixed(1)}
              </span>
            )}
            {movie.runtime != null && <span>{Math.floor(movie.runtime / 60)}h {movie.runtime % 60}m</span>}
            {movie.year && <span>{movie.year}</span>}
          </div>
          <a className="where" href={movie.link} target="_blank" rel="noopener noreferrer">
            <span className="where-icon" aria-hidden="true">
              <Icon name="play" size={18} stroke={2.2} />
            </span>
            <span className="where-text">
              <small>{t('Where to watch')}</small>
              <b>
                {movie.providers.length
                  ? movie.providers.map((p) => (p.how === 'rent' ? `${p.name} (${t('rent')})` : p.name)).join(' · ')
                  : t('Not streaming near you right now')}
              </b>
            </span>
            <span className="where-go">
              {t('Open')} <Icon name="right" size={14} stroke={2.6} />
            </span>
          </a>
          {movie.overview && (
            <button className={`synopsis ${moreSynopsis ? 'open' : ''}`} onClick={() => setMoreSynopsis(!moreSynopsis)} aria-expanded={moreSynopsis}>
              {movie.overview}
            </button>
          )}
        </section>
      )}

      {info && (
        <section className="show-info">
          <div className="meta-pills">
            {info.rating != null && (
              <span>
                <b className="gold">★</b> {info.rating.toFixed(1)}
              </span>
            )}
            {info.status && <span>{info.status === 'Running' ? t('Still airing') : t(info.status)}</span>}
            {info.runtime != null && <span>~{info.runtime} min</span>}
            {seasons && seasons.length > 0 && (() => {
              const n = seasons.filter((x) => x.aired).length || seasons.length
              return <span>{n === 1 ? t('{n} season', { n }) : t('{n} seasons', { n })}</span>
            })()}
          </div>
          {info.home && (
            <a
              className={`where ${info.officialSite ? '' : 'static'}`}
              href={info.officialSite ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => !info.officialSite && e.preventDefault()}
            >
              <span className="where-icon" aria-hidden="true">
                <Icon name={info.home.kind === 'stream' ? 'play' : 'tv'} size={18} stroke={2.2} />
              </span>
              <span className="where-text">
                <small>{t('Where to watch')}</small>
                <b>
                  {info.home.kind === 'stream' ? t('Streams on {name}', { name: info.home.name }) : t('Airs on {name}', { name: info.home.name })}
                </b>
              </span>
              {info.officialSite && (
                <span className="where-go">
                  {t('Open')} <Icon name="right" size={14} stroke={2.6} />
                </span>
              )}
            </a>
          )}
          {info.summary && (
            <button className={`synopsis ${moreSynopsis ? 'open' : ''}`} onClick={() => setMoreSynopsis(!moreSynopsis)} aria-expanded={moreSynopsis}>
              {info.summary}
            </button>
          )}
          {info.nextEpisode && (
            <div className="next-air">
              <span className="next-air-icon"><Icon name="calendar" size={20} /></span>
              <div>
                <b>{t('Next episode: {date}', { date: airLabel(info.nextEpisode.airdate) })}</b>
                <p className="muted">
                  {t('S{season} E{episode}', { season: info.nextEpisode.season, episode: info.nextEpisode.number })}
                  {info.nextEpisode.name ? ` · ${info.nextEpisode.name}` : ''}
                </p>
              </div>
            </div>
          )}
        </section>
      )}

      <section className="card">
        {people.length > 1 && !readOnly && (
          <div className="together-row">
            <span className="field-label" style={{ padding: 0 }}>{t('Watching together?')}</span>
            <div className="segmented" role="radiogroup" aria-label={t('Watching together?')}>
              <button
                type="button"
                role="radio"
                aria-checked={w.watchedBy.length <= 1}
                className={w.watchedBy.length <= 1 ? 'on' : ''}
                onClick={() => {
                  // Solo keeps you if you watched it, otherwise whoever watched it first
                  const solo = me && w.watchedBy.includes(me) ? me : (w.watchedBy[0] ?? me)
                  setW((cur) => ({ ...cur, watchedBy: solo ? [solo] : [], ratings: solo && cur.ratings[solo] != null ? { [solo]: cur.ratings[solo] } : {} }))
                }}
              >
                {t('Solo')}
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={w.watchedBy.length > 1}
                className={w.watchedBy.length > 1 ? 'on' : ''}
                onClick={() => setW((cur) => ({ ...cur, watchedBy: togetherWatchers(me, people, true) }))}
              >
                {t('Together')}
              </button>
            </div>
          </div>
        )}
        <p className="field-label">{t('Who watched?')}</p>
        <div className="chips" role="group" aria-label={t('Watched by')}>
          {people.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={w.watchedBy.includes(p.id)}
              className={w.watchedBy.includes(p.id) ? 'on' : ''}
              disabled={readOnly}
              onClick={() => toggleWatcher(p.id)}
            >
              <Avatar people={people} id={p.id} size={22} /> {p.name}
            </button>
          ))}
        </div>
        {!isMovie && watchers.length > 0 && <p className="rate-note">{t('One rating for the whole show, out of 10. Change it anytime.')}</p>}
        {watchers.map((p) => {
          const stars = w.ratings[p.id] ?? null
          const editable = !readOnly && canEditRating(p, viewer)
          const visible = editable || (savedComplete ? true : canSeeRating(w, p.id, viewer) && !blind)
          // Reactions go on what's saved and revealed, never on stars still being edited
          const reactable = social && savedComplete && stored.ratings[p.id] != null
          return (
            <Fragment key={p.id}>
            <div className="field rate-field">
              <span className="who">
                <Avatar people={people} id={p.id} />
                {p.name}
                {me === p.id && <span className="you">{t('you')}</span>}
              </span>
              {editable ? (
                <Stars label={p.name} value={stars} onChange={(v) => rate(p.id, v)} />
              ) : visible && stars != null ? (
                <AvgStars value={stars} size={22} />
              ) : (
                <span className={`hidden-rating ${stars != null ? 'done' : ''}`}>
                  <Icon name={stars != null ? 'lock' : 'clock'} size={15} stroke={2.2} />
                  {stars != null ? t('Rated · hidden') : t('Not rated yet')}
                </span>
              )}
            </div>
            {reactable && (
              <Reactions
                watchId={initial.id}
                targetId={p.id}
                reactions={reactions}
                people={everyone}
                me={me}
                canReact={canReact(stored, p.id, me)}
                onReact={onReact}
              />
            )}
            </Fragment>
          )
        })}
        {watchers.length > 0 && (
          <div className="avg-row">
            <span className="label">
              {scoreLabel(w, nameOf)}
            </span>
            {avg != null && !blind ? (
              <AvgStars value={avg} size={30} />
            ) : avg != null ? (
              <span className="save-to-reveal">
                <Icon name="sparkle" size={16} stroke={2.2} /> {t('Save to reveal')}
              </span>
            ) : (
              <span className="muted" style={{ textAlign: 'right' }}>
                {viewer && watchers.length > 1 ? t('Revealed when everyone rates') : t('Waiting for')}
                <br />
                <b style={{ color: 'var(--text-2)' }}>{pendingRaters(w).map(nameOf).join(', ')}</b>
              </span>
            )}
          </div>
        )}
      </section>

      {social && (
        <FamilyChat
          watch={stored}
          comments={comments}
          people={everyone}
          me={me}
          onSend={onComment}
          onRemove={onRemoveComment}
          onSeen={onChatSeen}
        />
      )}

      {episodes && episodes.length > 0 && (
        <section className="card pad">
          <div className="eps-head">
            <b>{t('Season {season} · {n} of {total}', { season: w.season, n: w.episodesWatched, total: total ?? episodes.length })}</b>
            <span className="muted">{t('Tap the last one you watched')}</span>
          </div>
          {overCounted && (
            <div className="eps-warn" role="alert">
              <span>
                {t("Only {aired} of {total} episodes have aired, so this log counts {extra} that haven't happened yet.", {
                  aired: airedCount!,
                  total: total ?? episodes.length,
                  extra: w.episodesWatched - airedCount!,
                })}
              </span>
              <button className="btn sm dark" onClick={() => setW((cur) => capToAired({ ...cur, status: 'done' }, airedCount))}>
                {t('Fix: set to {n}', { n: airedCount! })}
              </button>
            </div>
          )}
          {!overCounted && airedCount != null && total != null && airedCount < total && w.episodesWatched === airedCount && (
            <p className="eps-note">{t('Caught up. {n} more episodes still to air.', { n: total - airedCount })}</p>
          )}
          <div className="eps" role="group" aria-label={t('Season {n} episodes', { n: w.season })}>
            {episodes.map((e) => {
              const watched = e.number <= w.episodesWatched
              const next = e.number === w.episodesWatched + 1
              const upcoming = e.airdate != null && e.airdate > today
              return (
                <button
                  key={e.number}
                  className={`ep ${watched ? 'w' : ''} ${next ? 'n' : ''} ${upcoming ? 'u' : ''}`}
                  aria-pressed={watched}
                  aria-label={`${t('Episode {n}', { n: e.number })}${e.name ? `: ${e.name}` : ''}${upcoming && e.airdate ? `, ${t('airs {date}', { date: airLabel(e.airdate) })}` : ''}`}
                  title={e.name}
                  disabled={readOnly || (upcoming && !watched)}
                  onClick={() => setW((cur) => tapEpisode({ ...cur, totalEpisodes: cur.totalEpisodes ?? episodes.length }, e.number, airedCount))}
                >
                  {e.number}
                </button>
              )
            })}
          </div>
        </section>
      )}

      {!readOnly && (
      <fieldset className="card plain">
        {!isMovie && (
        <label className="field">
          <span>{t('Season')}</span>
          {seasons && seasons.length > 0 ? (
            <select
              value={w.season}
              onChange={(e) => {
                const s = seasons.find((x) => x.number === Number(e.target.value))
                if (!s) return
                // A new log can still pick its season. A saved one never changes season: each season is its own log,
                // so picking another opens that season's log (or starts one) and this one stays exactly as saved.
                const existing = logForSeason(watches, stored, s.number)
                if (!existing && isNew) return setW((cur) => withSeason(cur, s, watches))
                if (existing) {
                  onSwitchLog(existing, false)
                  onFlash(existing.status === 'done' ? t('Season {n} · finished ✓', { n: s.number }) : t('Season {n} · watching', { n: s.number }))
                } else onSwitchLog(withSeason(nextSeasonDraft(stored, newId(), me), s, watches), true)
              }}
            >
              {seasons.map((s) => {
                const log = s.number === w.season ? null : logForSeason(watches, stored, s.number)
                return (
                  <option key={s.number} value={s.number}>
                    {t('Season {n}', { n: s.number })}
                    {log ? ` · ${log.status === 'done' ? t('finished ✓') : t('watching')}` : s.episodes ? ` · ${t('{n} eps', { n: s.episodes })}` : ''}
                    {s.aired ? '' : ` · ${t('upcoming')}`}
                  </option>
                )
              })}
            </select>
          ) : (
            <input
              type="number"
              min={1}
              inputMode="numeric"
              value={w.season}
              onChange={(e) => set({ season: Math.max(1, Number(e.target.value) || 1) })}
              aria-label={t('Season number')}
            />
          )}
        </label>
        )}

        {!isMovie && (
        <div className="field">
          <span>{t('Status')}</span>
          <div className="segmented" role="radiogroup" aria-label={t('Status')}>
            {(['watching', 'done'] as const).map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={w.status === s}
                className={w.status === s ? 'on' : ''}
                onClick={() => setW((cur) => capToAired({ ...cur, status: s, episodesWatched: s === 'done' && total ? total : cur.episodesWatched }, airedCount))}
              >
                {s === 'watching' ? t('Watching') : t('Finished')}
              </button>
            ))}
          </div>
        </div>
        )}

        {!isMovie && !(episodes && episodes.length > 0) && (
        <div className="field">
          <span>{t('Episodes')}</span>
          <div className="stepper">
            <button aria-label={t('One episode less')} onClick={() => set({ episodesWatched: Math.max(0, w.episodesWatched - 1) })}>
              <Icon name="minus" size={18} />
            </button>
            <span aria-live="polite">{w.episodesWatched}{total ? ` / ${total}` : ''}</span>
            <button
              aria-label={t('One episode more')}
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
          <span>{t('Watched in')}</span>
          <input type="month" value={w.month} onChange={(e) => set({ month: e.target.value })} aria-label={t('Month watched')} />
        </label>

        <div className="field">
          <span>{t('Rewatch')}</span>
          <button
            type="button"
            role="switch"
            aria-checked={w.isRewatch}
            aria-label={t('Rewatch')}
            className={`toggle ${w.isRewatch ? 'on' : ''}`}
            onClick={() => set({ isRewatch: !w.isRewatch })}
          >
            <span />
          </button>
        </div>

        <div className="field">
          <span>{t('Times watched')}</span>
          <strong>{times}</strong>
        </div>
      </fieldset>
      )}

      {readOnly ? (
        w.notes && (
          <section className="card pad">
            <p className="field-label" style={{ paddingTop: 0 }}>{t('Notes')}</p>
            <p style={{ whiteSpace: 'pre-wrap' }}>{w.notes}</p>
          </section>
        )
      ) : (
      <section className="card">
        <label className="notes">
          <span className="field-label" style={{ paddingTop: 0 }}>{t('Notes')}</span>
          <textarea
            value={w.notes}
            maxLength={1000}
            placeholder={readOnly ? t('No notes') : t('That finale though…')}
            readOnly={readOnly}
            onChange={(e) => set({ notes: e.target.value })}
          />
        </label>
      </section>
      )}

      {error && <p className="error" role="alert">{error}</p>}

      {readOnly ? (
        <p className="viewer-note">
          <Icon name="info" size={15} stroke={2.2} />{' '}
          {owner
            ? t("This is {owner}'s show: chat and react all you want, only they change it.", { owner })
            : t("You're a viewer: you can see everything and chat, but not change shows.")}
        </p>
      ) : (
      <div className="actions">
        <button className="btn primary block" onClick={() => save()} disabled={saving}>
          {saving ? t('Saving…') : isNew ? t('Add to {month}', { month: monthLabel(w.month) }) : t('Save changes')}
        </button>
        {!isNew && canDelete && (
          <button
            className="btn danger block"
            // No "are you sure?": the message after removing has Undo
            onClick={() => onDelete(w)}
          >
            <Icon name="trash" size={18} /> {t('Remove from log')}
          </button>
        )}
      </div>
      )}
    </div>
  )
}
