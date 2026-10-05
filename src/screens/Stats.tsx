import { useState } from 'react'
import { AvgStars } from '../components/Stars'
import { Icon } from '../components/Icon'
import { PEOPLE } from '../config'
import { currentMonth, monthLabel, yearStats } from '../logic'
import type { Watch } from '../types'

interface Props {
  watches: Watch[]
  onOpen: (w: Watch) => void
  onOpenMonth: (month: string) => void
}

export function Stats({ watches, onOpen, onOpenMonth }: Props) {
  const thisYear = Number(currentMonth().slice(0, 4))
  const [year, setYear] = useState(thisYear)
  const s = yearStats(watches, year)
  const max = Math.max(1, ...s.perMonth.map((m) => m.count))
  const nowMonth = currentMonth()
  // Months that have happened, newest first
  const months = s.perMonth.filter((m) => m.month <= nowMonth).reverse()

  return (
    <div className="screen">
      <div className="month-nav">
        <button className="icon-btn" aria-label="Previous year" onClick={() => setYear(year - 1)}>
          <Icon name="left" />
        </button>
        <h1>{year} recap</h1>
        <button className="icon-btn" aria-label="Next year" onClick={() => setYear(year + 1)} disabled={year >= thisYear}>
          <Icon name="right" />
        </button>
      </div>

      <div className="year-total">
        <div>
          <strong>{s.shows}</strong>
          <span>{s.shows === 1 ? 'show' : 'shows'} in {year}</span>
        </div>
        <div>
          <strong>{s.avgPerMonth.toFixed(1)}</strong>
          <span>per month</span>
        </div>
        <div>
          <strong>{s.busiest ? monthLabel(s.busiest.month, 'short') : '–'}</strong>
          <span>busiest month</span>
        </div>
      </div>

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
            <div className={`col-bar ${m.month === nowMonth ? 'now' : ''}`} style={{ height: `${(m.count / max) * 100}%` }} />
            <span className="col-l">{monthLabel(m.month, 'short')[0]}</span>
          </button>
        ))}
      </div>

      <h2 className="section">Month by month</h2>
      {months.length === 0 ? (
        <p className="muted">Nothing to show for {year} yet.</p>
      ) : (
        <ol className="rank months">
          {months.map((m) => (
            <li key={m.month}>
              <button onClick={() => onOpenMonth(m.month)}>
                <span className="row-title">{monthLabel(m.month, 'long').split(' ')[0]}</span>
                <span className={m.count ? 'month-count' : 'muted'}>
                  {m.count} {m.count === 1 ? 'show' : 'shows'}
                </span>
                <Icon name="right" size={16} />
              </button>
            </li>
          ))}
        </ol>
      )}

      <div className="summary three">
        <div><strong>{s.episodes}</strong><span>episodes</span></div>
        <div><strong>{s.hours}h</strong><span>together</span></div>
        <div><strong>{s.rewatches}</strong><span>rewatch</span></div>
      </div>

      <div className="summary two">
        {PEOPLE.map((p) => (
          <div key={p.id}>
            <strong>{s.personAverages[p.id]?.toFixed(1) ?? '–'}</strong>
            <span><span className={`av ${p.id}`}>{p.name[0]}</span>{p.name}'s avg rating</span>
          </div>
        ))}
      </div>

      <h2 className="section">Top rated together</h2>
      {s.topRated.length === 0 ? (
        <p className="muted">Shows appear here once you've both rated them.</p>
      ) : (
        <ol className="rank">
          {s.topRated.map(({ watch, avg }, i) => (
            <li key={watch.id}>
              <button onClick={() => onOpen(watch)}>
                <span className="rank-n">{i + 1}</span>
                <span className="row-title">{watch.showName} <span className="muted">S{watch.season}</span></span>
                <AvgStars value={avg} size={13} />
                <span className="avg-num">{avg.toFixed(1)}</span>
              </button>
            </li>
          ))}
        </ol>
      )}

      <h2 className="section">Biggest disagreements</h2>
      {s.disagreements.length === 0 ? (
        <p className="muted">No big splits yet. Shows where you're 2+ stars apart land here.</p>
      ) : (
        <ol className="rank">
          {s.disagreements.map(({ watch }) => (
            <li key={watch.id}>
              <button onClick={() => onOpen(watch)}>
                <span className="row-title">{watch.showName} <span className="muted">S{watch.season}</span></span>
                {PEOPLE.map((p) => (
                  <span key={p.id} className="muted">
                    <span className={`av ${p.id}`}>{p.name[0]}</span>
                    {watch.ratings[p.id]}
                  </span>
                ))}
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
