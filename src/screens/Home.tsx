import { useState } from 'react'
import { Avatar, PersonFilter } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { PosterFill } from '../components/Poster'
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
import type { Person, Watch } from '../types'

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
  onAdd: () => void
  onProfile: () => void
}

function greeting(now = new Date()): string {
  const h = now.getHours()
  return h < 5 ? 'Late night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export function Home(props: Props) {
  const { watches, people, me, viewer, month, filter, onFilter, onMonth, onOpen, onAddEpisode, onAdd, onProfile } = props
  const mine = watchedByPerson(watches, filter)
  const list = watchesInMonth(mine, month)
  // Only episodes watched this month count toward this month's numbers
  const sum = summarize(list, month)
  const isCurrent = month === currentMonth()
  const watching = currentlyWatching(mine)
  // This month: in-progress shows live on the shelf above, so the grid shows what was finished
  const grid = isCurrent ? list.filter((w) => w.status === 'done') : list
  const [showAll, setShowAll] = useState(false)
  const shelf = showAll ? watching : watching.slice(0, 4)
  const monthName = monthLabel(month, 'long').split(' ')[0]
  const who = people.find((p) => p.id === filter)
  const meName = people.find((p) => p.id === me)?.name

  return (
    <div className="screen">
      <header className="topbar">
        <div>
          <p className="eyebrow">{greeting()}{meName ? ',' : ''}</p>
          <h1 className="title-xl">{meName ?? 'Pititi Watchers'}</h1>
        </div>
        {me && (
          <button className="who-btn" onClick={onProfile} aria-label="Your profile and settings">
            <Avatar people={people} id={me} size={44} />
          </button>
        )}
      </header>

      {isCurrent && watching.length > 0 && (
        <section aria-label="Currently watching">
          <h2 className="h2" style={{ marginBottom: 10 }}>
            Currently watching
            <small>{watching.length} {watching.length === 1 ? 'show' : 'shows'}</small>
          </h2>
          <ul className="card shelf">
            {shelf.map((w) => {
              const thisMonth = episodesIn(w, month)
              return (
                <li key={w.id} className="shelf-row">
                  <button className="shelf-main" onClick={() => onOpen(w)} aria-label={`Open ${w.showName}`}>
                    <span className="shelf-poster">
                      <PosterFill src={w.poster} name={w.showName} />
                    </span>
                    <span className="lrow-text">
                      <span className="lrow-title">{w.showName}</span>
                      <span className="muted">
                        S{w.season} · {w.totalEpisodes ? `${w.episodesWatched} of ${w.totalEpisodes}` : `${w.episodesWatched} eps`}
                        {thisMonth > 0 ? ` · ${thisMonth} this month` : ''}
                      </span>
                      {w.totalEpisodes ? (
                        <span className="bar" style={{ marginTop: 4 }}>
                          <i style={{ width: `${(w.episodesWatched / w.totalEpisodes) * 100}%` }} />
                        </span>
                      ) : null}
                      {w.watchedBy.length > 0 && (
                        <span className="stack" style={{ marginTop: 4 }}>
                          {w.watchedBy.map((id) => (
                            <Avatar key={id} people={people} id={id} size={18} />
                          ))}
                        </span>
                      )}
                    </span>
                  </button>
                  <button className="ep-plus" onClick={() => onAddEpisode(w)} aria-label={`Mark next episode of ${w.showName} watched`}>
                    <Icon name="plus" size={14} stroke={2.8} /> 1 ep
                  </button>
                </li>
              )
            })}
          </ul>
          {watching.length > 4 && (
            <button className="help-link" style={{ marginTop: 10 }} onClick={() => setShowAll(!showAll)}>
              {showAll ? 'Show fewer' : `Show all ${watching.length}`}
            </button>
          )}
        </section>
      )}

      <div className="monthbar">
        <button className="icon-btn" aria-label="Previous month" onClick={() => onMonth(shiftMonth(month, -1))}>
          <Icon name="left" size={20} />
        </button>
        <div className="monthbar-label">
          <strong>{monthLabel(month)}</strong>
          {isCurrent ? (
            <span className="muted">This month</span>
          ) : (
            <button className="today-btn" onClick={() => onMonth(currentMonth())}>
              Back to this month
            </button>
          )}
        </div>
        <button className="icon-btn" aria-label="Next month" onClick={() => onMonth(shiftMonth(month, 1))} disabled={isCurrent}>
          <Icon name="right" size={20} />
        </button>
      </div>

      <PersonFilter people={people} value={filter} onChange={onFilter} />

      <div className="tiles">
        <div className="tile">
          <span className="tile-icon"><Icon name="tv" size={17} /></span>
          <strong>{sum.shows}</strong>
          <span>{sum.shows === 1 ? 'show' : 'shows'}</span>
        </div>
        <div className="tile">
          <span className="tile-icon"><Icon name="play" size={15} /></span>
          <strong>{sum.episodes}</strong>
          <span>episodes</span>
        </div>
        <div className="tile">
          <span className="tile-icon"><Icon name="clock" size={17} /></span>
          <strong>{sum.hours}h</strong>
          <span>watched</span>
        </div>
      </div>

      {list.length === 0 && !(isCurrent && watching.length) ? (
        <div className="empty">
          <div className="empty-icon"><Icon name="tv" size={30} /></div>
          <p className="empty-title">
            {who ? `${who.name} hasn't logged anything yet` : isCurrent ? 'Your month starts here' : `Nothing in ${monthLabel(month)}`}
          </p>
          <p className="muted" style={{ fontSize: 15 }}>
            Add what you watched {isCurrent ? 'this month' : `in ${monthLabel(month)}`} and rate it together.
          </p>
          <button className="btn primary" onClick={onAdd}>
            <Icon name="plus" size={18} stroke={2.4} /> Add a show
          </button>
        </div>
      ) : (
        <>
          <h2 className="h2">
            {isCurrent ? 'Watched this month' : `Watched in ${monthName}`}
            <small>{isCurrent ? `${grid.length} finished` : `${grid.length} ${grid.length === 1 ? 'show' : 'shows'}`}</small>
          </h2>
          {grid.length === 0 && (
            <p className="muted" style={{ fontSize: 14.5, marginTop: -8 }}>
              Nothing finished yet this month. Episodes you watch from the shows above still count in the numbers.
            </p>
          )}
          <div className="grid">
            {grid.map((w, i) => {
              const avg = averageRating(w)
              return (
                <div key={w.id} className="pcard" style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}>
                  <div className="pcard-img">
                    <button className="pcard-hit" onClick={() => onOpen(w)} aria-label={`Open ${w.showName}`}>
                      <PosterFill src={w.poster} name={w.showName} />
                    </button>
                    {w.isRewatch && (
                      <span className="pcard-badge" title="Rewatch" aria-label="Rewatch">
                        <Icon name="repeat" size={12} stroke={2.6} />
                      </span>
                    )}
                    {w.watchedBy.length > 0 && (
                      <span className="pcard-watchers stack" aria-label="Watched by">
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
                        ? `S${w.season} · ${w.episodesWatched}${w.totalEpisodes ? `/${w.totalEpisodes}` : ''} eps`
                        : `S${w.season} · ${episodesIn(w, month)} eps in ${monthName}`
                      : avg != null
                        ? `S${w.season}`
                        : viewer && w.watchedBy.includes(viewer) && w.ratings[viewer] == null
                          ? 'Your turn to rate'
                          : `Waiting for ${pendingRaters(w).map((id) => people.find((p) => p.id === id)?.name ?? 'someone').join(', ')}`}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
