import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getLang, t } from '../i18n'
import { loadForUs, type Loved } from '../forUs'
import { useBackClose } from '../hooks/useBackClose'
import { buildPool, NIGHT_SIZE, nightState, type PoolOptions } from '../movieNight'
import { bigPoster } from '../tvmaze'
import { loadWeeklyPicks } from '../weeklyPicks'
import type { Kind, ListItem, MovieNight as Night, NightTitle, NightVote, Person, Watch, WatchList } from '../types'
import { Icon } from './Icon'
import { PosterFill } from './Poster'
import { TrailerSheet } from './TrailerSheet'

interface Props {
  /** The night to swipe in; null = set up a new one */
  night: Night | null
  votes: NightVote[]
  /** The household's people who swipe (not viewers) */
  members: Person[]
  me: string
  household: string | null
  watches: Watch[]
  lists: WatchList[]
  items: ListItem[]
  loved: Loved[]
  onStart: (titles: NightTitle[]) => Promise<Night | null>
  onVote: (night: Night, title: NightTitle, yes: boolean) => void
  onWatch: (title: NightTitle) => void
  /** No match: set up another round */
  onNewRound: () => void
  onClose: () => void
}

const nameOf = (people: Person[], id: string) => people.find((p) => p.id === id)?.name ?? t('Someone')
const label = (x: NightTitle) => (getLang() === 'pt' && x.titlePt ? x.titlePt : x.title)

/** Full screen: set up a movie night, swipe yes/no, wait for the others, and the match. */
export function MovieNight(props: Props) {
  const { night, onClose } = props
  useBackClose(true, onClose)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return createPortal(
    <div className="night" role="dialog" aria-modal="true" aria-label={t('Decide together')}>
      <button type="button" className="night-close icon-btn" aria-label={t('Close')} onClick={onClose}>
        <Icon name="close" size={20} />
      </button>
      {night ? <Swipe {...props} night={night} /> : <Setup {...props} />}
    </div>,
    document.body,
  )
}

function Setup({ members, me, household, watches, lists, items, loved, onStart }: Props) {
  const [opts, setOpts] = useState<PoolOptions>({ kind: 'movie', short: false, sources: { list: true, forus: true, week: true } })
  const [picks, setPicks] = useState<{ forus: NightTitle[]; week: NightTitle[] } | null>(null)
  const [starting, setStarting] = useState(false)
  useEffect(() => {
    let alive = true
    Promise.all([loadForUs(loved).catch(() => []), loadWeeklyPicks().catch(() => [])]).then(([forus, week]) => alive && setPicks({ forus, week }))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const pool = picks ? buildPool({ lists, items, household, forus: picks.forus, week: picks.week, watches }, opts) : []
  const others = members.length - 1
  const kinds: [Kind | 'both', string][] = [
    ['movie', t('Movies')],
    ['tv', t('Shows')],
    ['both', t('Both')],
  ]
  const sources: [keyof PoolOptions['sources'], string][] = [
    ['list', t('Our lists')],
    ['forus', t('For us')],
    ['week', t('Trending')],
  ]

  return (
    <div className="night-body">
      <p className="night-kicker">🍿 {t('Movie night')}</p>
      <h2 className="night-title">{t('Decide together')}</h2>
      <p className="night-sub">{t('Each of you swipes on your own phone. The first title you all like wins.')}</p>

      <div className="night-group" role="radiogroup" aria-label={t('What')}>
        <b>{t('What')}</b>
        <div className="night-chips">
          {kinds.map(([k, l]) => (
            <button key={k} type="button" role="radio" aria-checked={opts.kind === k} className={opts.kind === k ? 'on' : ''} onClick={() => setOpts({ ...opts, kind: k, short: k === 'tv' ? false : opts.short })}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="night-group">
        <b>{t('From')}</b>
        <div className="night-chips">
          {sources.map(([k, l]) => (
            <button key={k} type="button" role="switch" aria-checked={opts.sources[k]} className={opts.sources[k] ? 'on' : ''} onClick={() => setOpts({ ...opts, sources: { ...opts.sources, [k]: !opts.sources[k] } })}>
              {l}
            </button>
          ))}
        </div>
      </div>
      {opts.kind !== 'tv' && (
        <div className="night-group" role="radiogroup" aria-label={t('How long')}>
          <b>{t('How long')}</b>
          <div className="night-chips">
            <button type="button" role="radio" aria-checked={opts.short} className={opts.short ? 'on' : ''} onClick={() => setOpts({ ...opts, short: true })}>
              {t('Short (under 100 min)')}
            </button>
            <button type="button" role="radio" aria-checked={!opts.short} className={!opts.short ? 'on' : ''} onClick={() => setOpts({ ...opts, short: false })}>
              {t('Any length')}
            </button>
          </div>
        </div>
      )}

      <div className="night-spacer" />
      {picks == null ? (
        <p className="night-sub" role="status">{t('Gathering posters…')}</p>
      ) : pool.length < 2 ? (
        <p className="night-sub" role="status">{t('Not enough titles with these choices. Try Both, any length, or add a few to Up Next.')}</p>
      ) : null}
      <button
        type="button"
        className="btn primary block"
        disabled={pool.length < 2 || starting}
        onClick={async () => {
          setStarting(true)
          await onStart(pool)
          setStarting(false)
        }}
      >
        {t('Start · {n} posters', { n: Math.min(pool.length, NIGHT_SIZE) })}
      </button>
      <p className="night-note">
        {others === 1
          ? t('{name} gets a notification to join.', { name: members.find((m) => m.id !== me)?.name ?? '' })
          : t('The others in your household get a notification to join.')}
      </p>
    </div>
  )
}
function Swipe({ night, votes, members, me, onVote, onWatch, onNewRound }: Props & { night: Night }) {
  const ids = members.map((m) => m.id)
  const s = nightState(night, votes, me, ids)
  const current = s.todo[0] ?? null
  const done = night.titles.length - s.todo.length
  const [drag, setDrag] = useState(0)
  const start = useRef<number | null>(null)
  const [trailer, setTrailer] = useState(false)
  const [seenMatch, setSeenMatch] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const match = s.matches[0] ?? null

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!current || (match && seenMatch !== match.extId + match.kind)) return
      if (e.key === 'ArrowRight') onVote(night, current, true)
      if (e.key === 'ArrowLeft') onVote(night, current, false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current, match, seenMatch, night, onVote])

  // The first match ends the night (the others still show)
  if (match && seenMatch !== match.extId + match.kind) {
    return (
      <div className="night-match" role="status" aria-live="assertive">
        <p className="night-kicker">{t("It's a match")}</p>
        <div className="night-match-poster">
          <PosterFill src={bigPoster(match.poster)} name={label(match)} />
        </div>
        <h2 className="night-title">{label(match)}</h2>
        <p className="night-sub">
          {t('You all said yes')}
          {s.matches.length > 1 ? ` · ${t('{n} more matches', { n: s.matches.length - 1 })}` : ''}
        </p>
        <button type="button" className="btn block night-watch" onClick={() => onWatch(match)}>
          <Icon name="play" size={16} stroke={2.4} /> {t("We're watching it")}
        </button>
        {(s.matches.length > 1 || current) && (
          <button type="button" className="link-btn night-light" onClick={() => setSeenMatch(match.extId + match.kind)}>
            {s.matches.length > 1 ? t('See the other matches') : t('Keep swiping')}
          </button>
        )}
      </div>
    )
  }

  if (!current) {
    return (
      <div className="night-body night-center">
        <span className="night-big" aria-hidden="true">🍿</span>
        {s.matches.length > 0 ? (
          <>
            <h2 className="night-title">{t('Your matches')}</h2>
            <ul className="night-list">
              {(showAll ? s.matches : s.matches.slice(0, 5)).map((m) => (
                <li key={m.kind + m.extId}>
                  <span className="night-mini">
                    <PosterFill src={m.poster} name={label(m)} />
                  </span>
                  <b>{label(m)}</b>
                  <button type="button" className="btn sm primary" onClick={() => onWatch(m)}>
                    {t('Watch')}
                  </button>
                </li>
              ))}
            </ul>
            {!showAll && s.matches.length > 5 && (
              <button type="button" className="link-btn night-light" onClick={() => setShowAll(true)}>
                {t('Show all')}
              </button>
            )}
          </>
        ) : s.waitingOn.length ? (
          <>
            <h2 className="night-title">{t("You're done")}</h2>
            <p className="night-sub">{t('Waiting for {names}. The match shows up here the moment they finish.', { names: s.waitingOn.map((id) => nameOf(members, id)).join(', ') })}</p>
          </>
        ) : (
          <>
            <h2 className="night-title">{t('No match this time')}</h2>
            <p className="night-sub">{t('Nothing got a yes from everyone. Try another round with other choices.')}</p>
            <button type="button" className="btn primary" onClick={onNewRound}>
              {t('New round')}
            </button>
          </>
        )}
      </div>
    )
  }

  const decide = (yes: boolean) => {
    setDrag(0)
    onVote(night, current, yes)
  }
  const meta = [current.kind === 'movie' ? t('Movie') : t('Series'), current.year, current.runtime ? (current.kind === 'movie' ? `${Math.floor(current.runtime / 60)}h ${current.runtime % 60}m` : `~${current.runtime} min`) : null].filter(Boolean).join(' · ')
  const from = current.from === 'list' ? t('On your list') : current.from === 'forus' ? t('For us') : current.from === 'week' ? t('Trending') : null

  return (
    <div className="night-body">
      <div className="night-progress" role="progressbar" aria-valuemin={0} aria-valuemax={night.titles.length} aria-valuenow={done} aria-label={t('{n} of {total}', { n: done, total: night.titles.length })}>
        <i style={{ width: `${(done / night.titles.length) * 100}%` }} />
      </div>
      <p className="night-count">{t('{n} of {total}', { n: done + 1, total: night.titles.length })}</p>
      <div
        className={`night-card ${drag > 60 ? 'yes' : drag < -60 ? 'no' : ''}`}
        style={{ transform: `translateX(${drag}px) rotate(${drag / 18}deg)` }}
        onPointerDown={(e) => {
          start.current = e.clientX
          ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => start.current != null && setDrag(e.clientX - start.current)}
        onPointerUp={() => {
          start.current = null
          if (drag > 90) decide(true)
          else if (drag < -90) decide(false)
          else setDrag(0)
        }}
        onPointerCancel={() => ((start.current = null), setDrag(0))}
      >
        <PosterFill src={bigPoster(current.poster)} name={label(current)} />
        <div className="night-card-info">
          {from && (
            <span className="night-from">
              {from}
              {current.score ? ` · ★ ${current.score.toFixed(1)}` : ''}
            </span>
          )}
          <b>{label(current)}</b>
          <span>{meta}</span>
        </div>
        <span className="night-stamp yes" aria-hidden="true">{t('Yes')}</span>
        <span className="night-stamp no" aria-hidden="true">{t('No')}</span>
      </div>
      <div className="night-buttons">
        <button type="button" className="night-btn no" aria-label={t('No to {title}', { title: label(current) })} onClick={() => decide(false)}>
          <Icon name="close" size={26} stroke={2.6} />
        </button>
        <button type="button" className="night-btn trailer" aria-label={t('Watch the trailer of {title}', { title: label(current) })} onClick={() => setTrailer(true)}>
          <Icon name="play" size={20} stroke={2.4} />
        </button>
        <button type="button" className="night-btn yes" aria-label={t('Yes to {title}', { title: label(current) })} onClick={() => decide(true)}>
          <Icon name="heart" size={26} stroke={2.4} />
        </button>
      </div>
      <p className="night-note">{t('Swipe right for yes, left for no')}</p>
      {trailer && <TrailerSheet kind={current.kind} extId={current.extId} title={label(current)} year={current.year} onClose={() => setTrailer(false)} />}
    </div>
  )
}
