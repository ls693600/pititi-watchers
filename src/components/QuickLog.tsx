import { useEffect, useRef, useState } from 'react'
import { defaultSeason, logForSeason, monthLabel, premiereMonthFix, togetherWatchers, withSeason } from '../logic'
import { getAiredCount, getSeasons, type SeasonInfo } from '../tvmaze'
import type { Person, Watch } from '../types'
import { Avatar } from './Avatar'
import { Icon } from './Icon'
import { Poster } from './Poster'
import { PosterPlay, TrailerButton } from './TrailerSheet'
import { Stars } from './Stars'
import { t } from '../i18n'

interface Props {
  draft: Watch
  watches: Watch[]
  people: Person[]
  /** Who is using this phone (rates in Quick log) */
  me: string | null
  saving: boolean
  onLog: (w: Watch) => void
  onMore: (w: Watch) => void
  /** That season is already logged: open it instead of adding a copy */
  onOpenExisting: (w: Watch) => void
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
export function QuickLog({ draft, watches, people, me, saving, onLog, onMore, onOpenExisting, onClose }: Props) {
  const [w, setW] = useState<Watch>(draft)
  const [seasons, setSeasons] = useState<SeasonInfo[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [monthNote, setMonthNote] = useState<string | null>(null)
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
        // Start as "still watching" with nothing marked: you tick episodes off as you watch them
        setW((cur) => fitMonth(withSeason({ ...cur, status: 'watching', episodesWatched: 0 }, latest, watchesRef.current), latest))
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

  /** A season can't be watched before it premiered: move the log to its premiere month and say so. */
  function fitMonth(next: Watch, s: SeasonInfo): Watch {
    const fix = premiereMonthFix(next.month, s.premiereDate)
    if (!fix) {
      setMonthNote(null)
      return next
    }
    setMonthNote(t('Filed under {month}: Season {n} premiered then.', { month: monthLabel(fix), n: s.number }))
    return { ...next, month: fix }
  }

  function setStatus(done: boolean) {
    if (airing) {
      setW((cur) => ({ ...cur, status: 'watching', episodesWatched: done ? aired! : 0 }))
      return
    }
    setW((cur) => ({
      ...cur,
      status: done ? 'done' : 'watching',
      // "Still watching" starts with nothing marked; tick episodes off as you watch them
      episodesWatched: done ? (cur.totalEpisodes ?? cur.episodesWatched) : 0,
    }))
  }

  const together = w.watchedBy.length > 1
  function setTogether(on: boolean) {
    const ids = togetherWatchers(me, people, on)
    setW((cur) => ({
      ...cur,
      watchedBy: ids,
      ratings: Object.fromEntries(Object.entries(cur.ratings).filter(([id]) => ids.includes(id))),
    }))
    setError(null)
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
    if (!w.watchedBy.length) return setError(t('Pick who watched it.'))
    onLog({ ...w, updatedAt: new Date().toISOString() })
  }

  return (
    <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label={t('Log {title}', { title: w.showName })}>
      <button className="sheet-dim" aria-label={t('Close')} onClick={onClose} />
      <div className="sheet">
        <div className="grabber" aria-hidden="true" />
        <div className="sheet-show">
          <PosterPlay kind={'tv'} extId={w.showId} title={w.showName} year={w.year} season={w.season} bare>
            <Poster src={w.poster} name={w.showName} w={64} />
          </PosterPlay>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p className="label-sm">
              {t('Quick log')} · {monthLabel(w.month, 'long').split(' ')[0]}
              {w.isRewatch && <span className="rewatch-tag"><Icon name="repeat" size={11} stroke={2.6} /> {t('Rewatch')}</span>}
            </p>
            <h2 className="sheet-title">{w.showName}</h2>
            <div className="sheet-meta">
              {seasons && seasons.length > 1 ? (
                <label className="season-pick">
                  {t('Season {n}', { n: w.season })}
                  <Icon name="right" size={13} stroke={2.6} />
                  <select
                    value={w.season}
                    aria-label={t('Season')}
                    onChange={(e) => {
                      const s = seasons.find((x) => x.number === Number(e.target.value))
                      if (!s) return
                      setW((cur) => fitMonth(withSeason(cur, s, watches), s))
                      withAired(s).then((full) => {
                        if (full === s) return
                        setSeasons((list) => list?.map((x) => (x.number === full.number ? full : x)) ?? list)
                        setW((cur) => (cur.season === full.number ? withSeason(cur, full, watchesRef.current) : cur))
                      })
                    }}
                  >
                    {seasons.map((s) => (
                      <option key={s.number} value={s.number}>
                        {t('Season {n}', { n: s.number })}{s.aired ? '' : ` (${t('upcoming')})`}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <span>{t('Season {n}', { n: w.season })}</span>
              )}
              {total ? <span> · {t('{n} episodes', { n: total })}</span> : null}
            </div>
            <TrailerButton kind={'tv'} extId={w.showId} title={w.showName} year={w.year} season={w.season} />
            {monthNote && <p className="month-note">{monthNote}</p>}
            {(() => {
              const existing = logForSeason(watches, w, w.season)
              return existing ? (
                <p className="month-note">
                  {existing.status === 'done' ? t('Season {n} is already logged as finished.', { n: w.season }) : t('Season {n} is already in progress.', { n: w.season })}{' '}
                  <button className="link-btn inline" onClick={() => onOpenExisting(existing)}>
                    {t('Open it')}
                  </button>
                </p>
              ) : null
            })()}
          </div>
          <button className="icon-btn" aria-label={t('Close')} onClick={onClose} style={{ alignSelf: 'flex-start' }}>
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="big-choice" role="radiogroup" aria-label={t('Status')}>
          <button role="radio" aria-checked={finished} className={finished ? 'on' : ''} onClick={() => setStatus(true)}>
            <Icon name="check" size={18} stroke={2.6} />
            <b>{airing ? t('Caught up') : t('Finished it')}</b>
            <small>{airing ? t('All {n} aired of {total}', { n: aired!, total: total! }) : total ? t('All {n} episodes', { n: total }) : t('The whole season')}</small>
          </button>
          <button role="radio" aria-checked={!finished} className={!finished ? 'on' : ''} onClick={() => setStatus(false)}>
            <Icon name="play" size={16} stroke={2.2} />
            <b>{t('Still watching')}</b>
            <small>{t('Mark episodes as you go')}</small>
          </button>
        </div>

        {!finished && (
          <div className="field" style={{ borderBottom: 0, minHeight: 0 }}>
            <span>{t('Watched so far')}</span>
            <div className="stepper">
              <button aria-label={t('One episode less')} onClick={() => setW((c) => ({ ...c, episodesWatched: Math.max(0, c.episodesWatched - 1) }))}>
                <Icon name="minus" size={18} />
              </button>
              <span aria-live="polite">{w.episodesWatched === 0 ? t('None yet') : `${w.episodesWatched}${total ? ` / ${total}` : ''}`}</span>
              <button
                aria-label={t('One episode more')}
                onClick={() =>
                  setW((c) => ({ ...c, episodesWatched: Math.min(airing ? aired! : total ? total - 1 : Infinity, c.episodesWatched + 1) }))
                }
              >
                <Icon name="plus" size={18} />
              </button>
            </div>
          </div>
        )}

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
                <small>{people.length === 2 ? t('Average with {name}', { name: people.find((p) => p.id !== me)?.name ?? t('the family') }) : t('Average of everyone watching')}</small>
              </button>
            </div>
            {/* Bigger families pick exactly who was on the couch */}
            {together && people.length > 2 && (
              <div className="chips" style={{ padding: '10px 0 0' }} role="group" aria-label={t('Who watched')}>
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
            )}
          </div>
        )}

        {(w.status === 'done' || airing) && finished && iWatched && (
          <div className="quick-rate">
            <p className="label-sm">{t('Your rating')}</p>
            <div className="quick-stars">
              <Stars label="Your" value={w.ratings[me!] ?? null} onChange={rate} />
            </div>
            {others.length > 0 && (
              <p className="muted">{t("{names} won't see your stars until everyone rates", { names: others.map((p) => p.name).join(` ${t('and')} `) })}</p>
            )}
          </div>
        )}

        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary block" onClick={submit} disabled={saving}>
          {saving ? t('Saving…') : t('Log it')}
        </button>
        <button className="more" onClick={() => onMore(w)}>
          {t('More options: month, rewatch, notes')}
        </button>
      </div>
    </div>
  )
}
