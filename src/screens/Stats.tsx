import { useState } from 'react'
import { Avatar, PersonFilter } from '../components/Avatar'
import { AvgStars } from '../components/Stars'
import { Icon } from '../components/Icon'
import { PosterFill } from '../components/Poster'
import { BadgeTile, TasteCard } from '../components/Taste'
import { currentMonth, familyBadges, monthLabel, personAverages, raters, tasteMatches, watchedByPerson, yearStats } from '../logic'
import type { Person, Watch } from '../types'

interface Props {
  watches: Watch[]
  people: Person[]
  filter: string | null
  onFilter: (id: string | null) => void
  onOpen: (w: Watch) => void
  onOpenMonth: (month: string) => void
}

export function Stats({ watches, people, filter, onFilter, onOpen, onOpenMonth }: Props) {
  const thisYear = Number(currentMonth().slice(0, 4))
  const [year, setYear] = useState(thisYear)
  const s = yearStats(watchedByPerson(watches, filter), year)
  const yearLogs = watches.filter((w) => w.month.startsWith(`${year}-`))
  const averages = personAverages(yearLogs, people.map((p) => p.id))
  const who = people.find((p) => p.id === filter)
  const nowMonth = currentMonth()
  const max = Math.max(1, ...s.perMonth.map((m) => m.count))
  // Months that have happened, newest first
  const months = s.perMonth.filter((m) => m.month <= nowMonth).reverse()
  // Taste and badges use everything ever logged: more data, fairer scores
  const matches = tasteMatches(watches, people.map((p) => p.id)).filter((m) => !filter || m.a === filter || m.b === filter)
  const badges = familyBadges(watches)
  const earned = badges.filter((b) => b.earned).length

  return (
    <div className="screen">
      <header className="topbar">
        <div>
          <p className="eyebrow">Your year on the couch</p>
          <h1 className="title-xl">Stats</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="icon-btn" aria-label="Previous year" onClick={() => setYear(year - 1)}>
            <Icon name="left" size={20} />
          </button>
          <button className="icon-btn" aria-label="Next year" onClick={() => setYear(year + 1)} disabled={year >= thisYear}>
            <Icon name="right" size={20} />
          </button>
        </div>
      </header>

      <PersonFilter people={people} value={filter} onChange={onFilter} />

      <section className="wrapped" aria-label={`${year} summary`}>
        <p className="wrapped-kicker">{year}{who ? ` · ${who.name}` : ' · The family'}</p>
        <p className="wrapped-big">{s.shows}</p>
        <p className="wrapped-label">{s.shows === 1 ? 'show watched' : 'shows watched'}</p>
        <div className="wrapped-row">
          <div>
            <strong>{s.avgPerMonth.toFixed(1)}</strong>
            <span>per month</span>
          </div>
          <div>
            <strong>{s.busiest ? monthLabel(s.busiest.month, 'short') : '–'}</strong>
            <span>busiest month</span>
          </div>
          <div>
            <strong>{s.hours}h</strong>
            <span>{s.episodes} episodes</span>
          </div>
        </div>
      </section>

      <section className="card" style={{ padding: 0 }}>
        <div className="chart" aria-label={`Shows per month in ${year}`}>
          {s.perMonth.map((m) => (
            <button
              key={m.month}
              className="col"
              onClick={() => onOpenMonth(m.month)}
              disabled={m.month > nowMonth}
              aria-label={`${monthLabel(m.month)}: ${m.count} shows`}
            >
              <span className="col-n">{m.count || ''}</span>
              <div
                className={`col-bar ${m.count ? 'has' : ''} ${m.month === nowMonth || s.busiest?.month === m.month ? 'now' : ''}`}
                style={{ height: `${Math.max(4, (m.count / max) * 100)}%` }}
              />
              <span className="col-l">{monthLabel(m.month, 'short')[0]}</span>
            </button>
          ))}
        </div>
      </section>

      {matches.length > 0 && (
        <>
          <h2 className="h2">
            Taste match
            <small>all time</small>
          </h2>
          <div className="matches">
            {matches.map((m, i) => (
              <TasteCard key={`${m.a}-${m.b}`} match={m} people={people} big={i === 0} />
            ))}
          </div>
        </>
      )}

      {s.topRated.length > 0 && (
        <>
          <h2 className="h2">{who ? `${who.name}'s top ${s.topRated.length}` : `Top ${s.topRated.length} of ${year}`}</h2>
          <div className="top5">
            {s.topRated.map(({ watch, avg }, i) => (
              <button key={watch.id} onClick={() => onOpen(watch)} aria-label={`Number ${i + 1}: ${watch.showName}, ${avg.toFixed(1)} stars`}>
                <span className="rank" aria-hidden="true">{i + 1}</span>
                <span className="pcard-img">
                  <PosterFill src={watch.poster} name={watch.showName} />
                  <span className="pcard-rating"><b>★</b>{avg.toFixed(1)}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      <h2 className="h2">
        Month by month
        <small>tap to open</small>
      </h2>
      {months.length === 0 ? (
        <p className="muted">Nothing to show for {year} yet.</p>
      ) : (
        <ul className="card">
          {months.map((m) => (
            <li key={m.month}>
              <button className="mrow" onClick={() => onOpenMonth(m.month)}>
                <span className="m">{monthLabel(m.month, 'long').split(' ')[0]}</span>
                <span className="track"><i style={{ width: `${(m.count / max) * 100}%` }} /></span>
                <span className={`n ${m.count ? '' : 'zero'}`}>{m.count} {m.count === 1 ? 'show' : 'shows'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <h2 className="h2">Who rates highest</h2>
      <ul className="card">
        {[...people]
          .sort((a, b) => (averages[b.id] ?? -1) - (averages[a.id] ?? -1))
          .map((p) => (
            <li key={p.id}>
              <div className="lrow">
                <Avatar people={people} id={p.id} size={36} />
                <span className="lrow-text">
                  <span className="lrow-title">{p.name}</span>
                  <span className="muted">{averages[p.id] != null ? 'Average rating' : `No ratings in ${year}`}</span>
                </span>
                {averages[p.id] != null && (
                  <>
                    <AvgStars value={averages[p.id]!} size={14} />
                    <span className="avg-num">{averages[p.id]!.toFixed(1)}</span>
                  </>
                )}
              </div>
            </li>
          ))}
      </ul>

      <h2 className="h2">
        Family badges
        <small>{earned} of {badges.length}</small>
      </h2>
      <div className="badges">
        {[...badges].sort((a, b) => Number(b.earned) - Number(a.earned)).map((b) => (
          <BadgeTile key={b.id} badge={b} />
        ))}
      </div>

      {s.disagreements.length > 0 && (
        <>
          <h2 className="h2">
            Biggest debates
            <small>2+ stars apart</small>
          </h2>
          <ul className="card">
            {s.disagreements.map(({ watch }) => (
              <li key={watch.id}>
                <button className="lrow" onClick={() => onOpen(watch)}>
                  <span className="lrow-text">
                    <span className="lrow-title">{watch.showName}</span>
                    <span className="muted">Season {watch.season}</span>
                  </span>
                  {raters(watch).map((id) => (
                    <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700 }}>
                      <Avatar people={people} id={id} size={24} />
                      {watch.ratings[id]}
                    </span>
                  ))}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
