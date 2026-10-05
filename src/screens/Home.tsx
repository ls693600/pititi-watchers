import { Avatar, PersonFilter } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { PosterFill } from '../components/Poster'
import { bigPoster } from '../tvmaze'
import {
  averageRating,
  byUpdatedDesc,
  currentMonth,
  monthLabel,
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

function progressText(w: Watch): string {
  if (w.status === 'done') return `Season ${w.season} · finished`
  return w.totalEpisodes ? `Season ${w.season} · ${w.episodesWatched} of ${w.totalEpisodes}` : `Season ${w.season} · ${w.episodesWatched} eps`
}

export function Home(props: Props) {
  const { watches, people, me, month, filter, onFilter, onMonth, onOpen, onAddEpisode, onAdd, onProfile } = props
  const mine = watchedByPerson(watches, filter)
  const list = watchesInMonth(mine, month)
  const sum = summarize(list)
  const hero = mine.filter((w) => w.status === 'watching').sort(byUpdatedDesc)[0]
  const isCurrent = month === currentMonth()
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

      {hero && (
        <div className="hero" role="group" aria-label={`Continue watching ${hero.showName}`}>
          {hero.poster && <img src={bigPoster(hero.poster)!} alt="" className="hero-bg" />}
          <button onClick={() => onOpen(hero)} aria-label={`Open ${hero.showName}`} style={{ flex: 'none' }}>
            {hero.poster ? (
              <img src={hero.poster} alt="" className="hero-poster" />
            ) : (
              <div className="hero-poster" style={{ width: 96, height: 140 }}>
                <PosterFill src={null} name={hero.showName} />
              </div>
            )}
          </button>
          <div className="hero-body">
            <span className="hero-kicker">
              <Icon name="play" size={12} stroke={2.6} /> Continue watching
            </span>
            <button className="hero-title" style={{ textAlign: 'left' }} onClick={() => onOpen(hero)}>
              {hero.showName}
            </button>
            <span className="hero-sub">{progressText(hero)}</span>
            {hero.totalEpisodes ? (
              <div className="bar">
                <i style={{ width: `${(hero.episodesWatched / hero.totalEpisodes) * 100}%` }} />
              </div>
            ) : (
              <div style={{ height: 8 }} />
            )}
            <button className="hero-plus" onClick={() => onAddEpisode(hero)}>
              <Icon name="plus" size={16} stroke={2.6} /> Watched next episode
            </button>
          </div>
        </div>
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

      {list.length === 0 ? (
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
            Watched {isCurrent ? 'this month' : `in ${monthLabel(month, 'long').split(' ')[0]}`}
            <small>{list.length} {list.length === 1 ? 'log' : 'logs'}</small>
          </h2>
          <div className="grid">
            {list.map((w, i) => {
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
                    {w.status === 'watching' && (
                      <button className="pcard-plus" onClick={() => onAddEpisode(w)} aria-label={`Mark next episode of ${w.showName} watched`}>
                        +1 ep
                      </button>
                    )}
                    {w.status === 'watching' && w.totalEpisodes ? (
                      <span className="pcard-progress"><i style={{ width: `${(w.episodesWatched / w.totalEpisodes) * 100}%` }} /></span>
                    ) : null}
                  </div>
                  <button onClick={() => onOpen(w)} style={{ textAlign: 'left' }}>
                    <span className="pcard-title">{w.showName}</span>
                  </button>
                  <span className="pcard-sub">
                    {w.status === 'watching'
                      ? `S${w.season} · ${w.episodesWatched}${w.totalEpisodes ? `/${w.totalEpisodes}` : ''} eps`
                      : avg == null
                        ? 'Needs rating'
                        : `S${w.season}`}
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
