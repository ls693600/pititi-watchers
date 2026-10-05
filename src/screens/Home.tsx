import { Avatar, PersonFilter } from '../components/Avatar'
import { AvgStars } from '../components/Stars'
import { Icon } from '../components/Icon'
import { Poster } from '../components/Poster'
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
  month: string
  filter: string | null
  onFilter: (id: string | null) => void
  onMonth: (m: string) => void
  onOpen: (w: Watch) => void
  onAddEpisode: (w: Watch) => void
  onAdd: () => void
}

function progress(w: Watch): string {
  if (w.status === 'done') return `S${w.season} · finished`
  return w.totalEpisodes ? `S${w.season} · ${w.episodesWatched}/${w.totalEpisodes} eps` : `S${w.season} · ${w.episodesWatched} eps`
}

export function Home({ watches, people, month, filter, onFilter, onMonth, onOpen, onAddEpisode, onAdd }: Props) {
  const mine = watchedByPerson(watches, filter)
  const list = watchesInMonth(mine, month)
  const sum = summarize(list)
  const hero = mine.filter((w) => w.status === 'watching').sort(byUpdatedDesc)[0]
  const isCurrent = month === currentMonth()
  const who = people.find((p) => p.id === filter)

  return (
    <div className="screen">
      {hero && (
        <button className="hero" onClick={() => onOpen(hero)}>
          {hero.poster && <img src={hero.poster} alt="" className="hero-bg" />}
          <div className="hero-body">
            <span className="muted">Continue watching</span>
            <strong className="hero-title">{hero.showName}</strong>
            <span className="muted">{progress(hero)}</span>
            {hero.totalEpisodes ? (
              <div className="bar">
                <i style={{ width: `${(hero.episodesWatched / hero.totalEpisodes) * 100}%` }} />
              </div>
            ) : null}
          </div>
        </button>
      )}

      <div className="month-nav">
        <button className="icon-btn" aria-label="Previous month" onClick={() => onMonth(shiftMonth(month, -1))}>
          <Icon name="left" />
        </button>
        <h1>{monthLabel(month)}</h1>
        <button className="icon-btn" aria-label="Next month" onClick={() => onMonth(shiftMonth(month, 1))} disabled={isCurrent}>
          <Icon name="right" />
        </button>
      </div>

      <PersonFilter people={people} value={filter} onChange={onFilter} />

      <div className="summary">
        <div><strong>{sum.shows}</strong><span>shows</span></div>
        <div><strong>{sum.episodes}</strong><span>episodes</span></div>
        <div><strong>{sum.hours}h</strong><span>watched</span></div>
        <div><strong>{sum.rewatches}</strong><span>rewatch</span></div>
      </div>

      {list.length === 0 ? (
        <div className="empty">
          <p className="empty-title">
            {who ? `${who.name} hasn't logged anything in ${monthLabel(month)}` : isCurrent ? 'Nothing logged this month' : `Nothing logged in ${monthLabel(month)}`}
          </p>
          <p className="muted">Search for a show to add it to {isCurrent ? 'this month' : monthLabel(month)}.</p>
          <button className="btn primary" onClick={onAdd}>
            <Icon name="plus" size={18} /> Log a show
          </button>
        </div>
      ) : (
        <ul className="list">
          {list.map((w) => {
            const avg = averageRating(w)
            return (
              <li key={w.id} className="row">
                <button className="row-main" onClick={() => onOpen(w)}>
                  <Poster src={w.poster} name={w.showName} />
                  <div className="row-text">
                    <span className="row-title">{w.showName}</span>
                    <span className="muted">
                      {progress(w)}
                      {w.isRewatch && <span className="chip">Rewatch</span>}
                    </span>
                    {w.status === 'watching' && w.totalEpisodes ? (
                      <div className="bar">
                        <i style={{ width: `${(w.episodesWatched / w.totalEpisodes) * 100}%` }} />
                      </div>
                    ) : null}
                    <span className="row-ratings">
                      <span className="watchers" aria-label="Watched by">
                        {w.watchedBy.map((id) => (
                          <Avatar key={id} people={people} id={id} />
                        ))}
                      </span>
                      {avg != null ? (
                        <>
                          <AvgStars value={avg} size={14} /> <span className="avg-num">{avg.toFixed(1)}</span>
                        </>
                      ) : (
                        <span className="muted">Not rated yet</span>
                      )}
                    </span>
                  </div>
                </button>
                {w.status === 'watching' && (
                  <button className="ep-btn" onClick={() => onAddEpisode(w)} aria-label={`Mark next episode of ${w.showName} watched`}>
                    +1 ep
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
