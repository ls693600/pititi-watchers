import { useState } from 'react'
import { Avatar, PersonFilter } from '../components/Avatar'
import { LongPress } from '../components/LongPress'
import { Icon } from '../components/Icon'
import { PosterFill } from '../components/Poster'
import { ReleaseCarousel } from '../components/ReleaseCarousel'
import {
  averageRating,
  currentMonth,
  currentlyWatching,
  episodesIn,
  monthLabel,
  pendingRaters,
  shiftMonth,
  summarize,
  watchedByPerson,
  watchesInMonth,
} from '../logic'
import { getLang, setLang, t } from '../i18n'
import type { Person, Watch } from '../types'
import type { Festive } from '../festive'

interface Props {
  watches: Watch[]
  people: Person[]
  me: string | null
  /** Signed-in person (null in single-phone mode) */
  viewer: string | null
  month: string
  filter: string | null
  onFilter: (id: string | null) => void
  onMonth: (m: string) => void
  onOpen: (w: Watch) => void
  onAddEpisode: (w: Watch) => void
  /** Press and hold a show: quick actions */
  onActions: (w: Watch) => void
  /** Viewer: browse only (no quick actions, no adding) */
  readOnly?: boolean
  /** The family's shows are still loading */
  loading?: boolean
  onAdd: () => void
  onProfile: () => void
  /** Everyone incl. viewers, for your own name and avatar in the header */
  everyone?: Person[]
  /** Today's festive look: greeting card at the top */
  festive?: Festive | null
}

const TIP_KEY = 'pititi.tip.hold.v1'

function tipSeen(): boolean {
  try {
    return localStorage.getItem(TIP_KEY) === '1'
  } catch {
    return true
  }
}

function greeting(now = new Date()): string {
  const h = now.getHours()
  return h < 5 ? t('Late night') : h < 12 ? t('Good morning') : h < 18 ? t('Good afternoon') : t('Good evening')
}

export function Home(props: Props) {
  const { watches, people, me, viewer, month, filter, onFilter, onMonth, onOpen, onAddEpisode, onActions, onAdd, onProfile, readOnly = false, loading = false, everyone = props.people, festive = null } = props
  const [showTip, setShowTip] = useState(() => !tipSeen())
  const hideTip = () => {
    setShowTip(false)
    try {
      localStorage.setItem(TIP_KEY, '1')
    } catch {
      // Fine: the tip shows again next time
    }
  }
  const actions = (w: Watch) => {
    if (readOnly) return
    hideTip()
    onActions(w)
  }
  const mine = watchedByPerson(watches, filter)
  const list = watchesInMonth(mine, month)
  // Only episodes watched this month count toward this month's numbers
  const sum = summarize(list, month)
  const isCurrent = month === currentMonth()
  const watching = currentlyWatching(mine)
  // This month: in-progress shows live on the shelf above, so the grid shows what was finished
  const grid = isCurrent ? list.filter((w) => w.status === 'done') : list
  const monthName = monthLabel(month, 'long').split(' ')[0]
  const who = people.find((p) => p.id === filter)
  const meName = everyone.find((p) => p.id === me)?.name

  return (
    <div className="screen">
      <header className="topbar">
        <div>
          <p className="eyebrow">{greeting()}{meName ? ',' : ''}</p>
          <h1 className="title-xl">{meName ?? 'Pititi Watchers'}</h1>
        </div>
        <div className="topbar-actions">
          <button
            className="lang-btn"
            onClick={() => setLang(getLang() === 'pt' ? 'en' : 'pt')}
            aria-label={getLang() === 'pt' ? 'Switch to English' : 'Mudar para português'}
            lang={getLang() === 'pt' ? 'en' : 'pt-BR'}
          >
            {getLang() === 'pt' ? 'EN' : 'PT'}
          </button>
          {me && (
            <button className="who-btn" onClick={onProfile} aria-label={t('Your profile and settings')}>
              <Avatar people={everyone} id={me} size={44} />
            </button>
          )}
        </div>
      </header>

      {festive && (
        <div className="festive-card" role="note">
          <span className="festive-emoji" aria-hidden="true">{festive.emoji}</span>
          <p>
            <b>{t(festive.name)}</b>
            {t(festive.greeting)}
          </p>
        </div>
      )}

      {isCurrent && watching.length > 0 && (
        <ReleaseCarousel watching={watching} people={people} onOpen={onOpen} onAddEpisode={onAddEpisode} onActions={actions} readOnly={readOnly} />
      )}

      <div className="monthbar">
        <button className="icon-btn" aria-label={t('Previous month')} onClick={() => onMonth(shiftMonth(month, -1))}>
          <Icon name="left" size={20} />
        </button>
        <div className="monthbar-label">
          <strong>{monthLabel(month)}</strong>
          {isCurrent ? (
            <span className="muted">{t('This month')}</span>
          ) : (
            <button className="today-btn" onClick={() => onMonth(currentMonth())}>
              {t('Back to this month')}
            </button>
          )}
        </div>
        <button className="icon-btn" aria-label={t('Next month')} onClick={() => onMonth(shiftMonth(month, 1))} disabled={isCurrent}>
          <Icon name="right" size={20} />
        </button>
      </div>

      <PersonFilter people={people} value={filter} onChange={onFilter} />

      <div className="tiles">
        <div className="tile">
          <span className="tile-icon"><Icon name="tv" size={17} /></span>
          <strong>{sum.shows}</strong>
          <span>{sum.shows === 1 ? t('show') : t('shows')}</span>
        </div>
        <div className="tile">
          <span className="tile-icon"><Icon name="play" size={15} /></span>
          <strong>{sum.episodes}</strong>
          <span>{t('episodes')}</span>
        </div>
        <div className="tile">
          <span className="tile-icon"><Icon name="clock" size={17} /></span>
          <strong>{sum.hours}h</strong>
          <span>{t('watched')}</span>
        </div>
      </div>

      {loading ? null : list.length === 0 && !(isCurrent && watching.length) ? (
        <div className="empty">
          <div className="empty-icon"><Icon name="tv" size={30} /></div>
          <p className="empty-title">
            {who ? t("{name} hasn't logged anything yet", { name: who.name }) : isCurrent ? t('Your month starts here') : t('Nothing in {month}', { month: monthLabel(month) })}
          </p>
          <p className="muted" style={{ fontSize: 15 }}>
            {isCurrent ? t('Add what you watched this month and rate it together.') : t('Add what you watched in {month} and rate it together.', { month: monthLabel(month) })}
          </p>
          {!readOnly && (
            <button className="btn primary" onClick={onAdd}>
              <Icon name="plus" size={18} stroke={2.4} /> {t('Add a show')}
            </button>
          )}
        </div>
      ) : (
        <>
          {showTip && !readOnly && (watching.length > 0 || grid.length > 0) && (
            <div className="tip" role="note">
              <span className="tip-icon" aria-hidden="true">
                <Icon name="sparkle" size={16} stroke={2.2} />
              </span>
              <p>
                <b>{t('Tip:')}</b> {t('press and hold any show to mark episodes, finish it or rate it, without opening it.')}
              </p>
              <button className="icon-btn" aria-label={t('Got it')} onClick={hideTip}>
                <Icon name="close" size={16} />
              </button>
            </div>
          )}
          <h2 className="h2">
            {isCurrent ? t('Watched this month') : t('Watched in {month}', { month: monthName })}
            <small>{isCurrent ? t('{n} finished', { n: grid.length }) : grid.length === 1 ? t('{n} show', { n: grid.length }) : t('{n} shows', { n: grid.length })}</small>
          </h2>
          {grid.length === 0 && (
            <p className="muted" style={{ fontSize: 14.5, marginTop: -8 }}>
              {t('Nothing finished yet this month. Episodes you watch from the shows above still count in the numbers.')}
            </p>
          )}
          <div className="grid">
            {grid.map((w, i) => {
              const avg = averageRating(w)
              return (
                <LongPress key={w.id} className="pcard" style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }} onLong={() => actions(w)}>
                  <div className="pcard-img">
                    <button className="pcard-hit" onClick={() => onOpen(w)} aria-label={t('Open {name}', { name: w.showName })}>
                      <PosterFill src={w.poster} name={w.showName} />
                    </button>
                    {w.isRewatch && (
                      <span className="pcard-badge" title={t('Rewatch')} aria-label={t('Rewatch')}>
                        <Icon name="repeat" size={12} stroke={2.6} />
                      </span>
                    )}
                    {w.watchedBy.length > 0 && (
                      <span className="pcard-watchers stack" aria-label={t('Watched by')}>
                        {w.watchedBy.slice(0, 3).map((id) => (
                          <Avatar key={id} people={people} id={id} size={22} />
                        ))}
                      </span>
                    )}
                    {avg != null && w.status === 'done' && (
                      <span className="pcard-rating"><b>★</b>{avg.toFixed(1)}</span>
                    )}
                    {/* +1 lives on the Currently watching shelf; past months are a record, not a remote */}
                    {w.status === 'watching' && w.totalEpisodes ? (
                      <span className="pcard-progress"><i style={{ width: `${(w.episodesWatched / w.totalEpisodes) * 100}%` }} /></span>
                    ) : null}
                  </div>
                  <button onClick={() => onOpen(w)} style={{ textAlign: 'left' }}>
                    <span className="pcard-title">{w.showName}</span>
                  </button>
                  <span className={`pcard-sub ${viewer && w.status === 'done' && w.watchedBy.includes(viewer) && w.ratings[viewer] == null ? 'turn' : ''}`}>
                    {w.status === 'watching'
                      ? isCurrent
                        ? t('S{season} · {n} eps', { season: w.season, n: `${w.episodesWatched}${w.totalEpisodes ? `/${w.totalEpisodes}` : ''}` })
                        : t('S{season} · {n} eps in {month}', { season: w.season, n: episodesIn(w, month), month: monthName })
                      : avg != null
                        ? t('S{season}', { season: w.season })
                        : viewer && w.watchedBy.includes(viewer) && w.ratings[viewer] == null
                          ? t('Your turn to rate')
                          : t('Waiting for {names}', { names: pendingRaters(w).map((id) => people.find((p) => p.id === id)?.name ?? t('someone')).join(', ') })}
                  </span>
                </LongPress>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
