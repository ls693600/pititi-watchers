import { useState } from 'react'
import { Avatar, PersonFilter } from '../components/Avatar'
import { AvgStars } from '../components/Stars'
import { Icon } from '../components/Icon'
import { PosterFill } from '../components/Poster'
import { BadgeTile, TasteCard } from '../components/Taste'
import { MonthSheet } from '../components/MonthSheet'
import { YearReview } from '../components/YearReview'
import { currentMonth, familyBadges, personalTop, monthLabel, personAverages, raters, tasteMatches, watchedByPerson, yearStats } from '../logic'
import { t } from '../i18n'
import type { Person, Watch } from '../types'

interface Props {
  watches: Watch[]
  people: Person[]
  filter: string | null
  onFilter: (id: string | null) => void
  onOpen: (w: Watch) => void
  onHelp: (topic: string) => void
  onFlash: (msg: string) => void
}

export function Stats({ watches, people, filter, onFilter, onOpen, onHelp, onFlash }: Props) {
  const thisYear = Number(currentMonth().slice(0, 4))
  const [year, setYear] = useState(thisYear)
  const mine = watchedByPerson(watches, filter)
  const s = yearStats(mine, year)
  const [openMonth, setOpenMonth] = useState<string | null>(null)
  const [review, setReview] = useState(false)
  const yearLogs = watches.filter((w) => w.month.startsWith(`${year}-`))
  const averages = personAverages(yearLogs, people.map((p) => p.id))
  const who = people.find((p) => p.id === filter)
  // With a person picked, rank by their own stars; otherwise by the family average
  const top = filter
    ? personalTop(mine.filter((w) => w.month.startsWith(`${year}-`) || Object.keys(w.episodesByMonth ?? {}).some((m) => m.startsWith(`${year}-`))), filter)
    : s.topRated
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
          <p className="eyebrow">{t('Your year on the couch')}</p>
          <h1 className="title-xl">{t('Stats')}</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="icon-btn" aria-label={t('Previous year')} onClick={() => setYear(year - 1)}>
            <Icon name="left" size={20} />
          </button>
          <button className="icon-btn" aria-label={t('Next year')} onClick={() => setYear(year + 1)} disabled={year >= thisYear}>
            <Icon name="right" size={20} />
          </button>
        </div>
      </header>

      <PersonFilter people={people} value={filter} onChange={onFilter} />

      <section className="wrapped" aria-label={t('{year} summary', { year })}>
        <p className="wrapped-kicker">{year}{who ? ` · ${who.name}` : ` · ${t('The family')}`}</p>
        <p className="wrapped-big">{s.shows}</p>
        <p className="wrapped-label">{s.shows === 1 ? t('show watched') : t('shows watched')}</p>
        <div className="wrapped-row">
          <div>
            <strong>{s.avgPerMonth.toFixed(1)}</strong>
            <span>{t('per month')}</span>
          </div>
          <div>
            <strong>{s.busiest ? monthLabel(s.busiest.month, 'short') : '–'}</strong>
            <span>{t('busiest month')}</span>
          </div>
          <div>
            <strong>{s.hours}h</strong>
            <span>{t('{n} episodes', { n: s.episodes })}</span>
          </div>
        </div>
        {s.shows > 0 && (
          <button className="wrapped-play" onClick={() => setReview(true)}>
            <Icon name="play" size={16} stroke={2.6} /> {year === thisYear ? t('Play our {year} so far', { year }) : t('Play our {year}', { year })}
          </button>
        )}
      </section>
      {review && <YearReview year={year} watches={watches} people={people} onClose={() => setReview(false)} onFlash={onFlash} />}

      <section className="card" style={{ padding: 0 }}>
        <div className="chart" aria-label={t('Shows per month in {year}', { year })}>
          {s.perMonth.map((m) => (
            <button
              key={m.month}
              className="col"
              onClick={() => setOpenMonth(m.month)}
              disabled={m.month > nowMonth}
              aria-label={t('{month}: {n} shows', { month: monthLabel(m.month), n: m.count })}
            >
              <span className="col-n">{m.count || ''}</span>
              <div
                className={`col-bar ${m.count ? 'has' : ''} ${m.month === nowMonth || s.busiest?.month === m.month ? 'now' : ''}`}
                style={{ height: `${Math.max(4, (m.count / max) * 100)}%` }}
              />
              <span className="col-l">{monthLabel(m.month, 'short')[0].toUpperCase()}</span>
            </button>
          ))}
        </div>
      </section>

      {matches.length > 0 && (
        <>
          <h2 className="h2">
            {t('Taste match')}
            <small>{t('all time')}</small>
          </h2>
          <button className="help-link" onClick={() => onHelp('taste')} style={{ marginTop: -8 }}>
            <Icon name="info" size={15} stroke={2.2} /> {t('What is Taste match?')}
          </button>
          <div className="matches">
            {matches.map((m, i) => (
              <TasteCard key={`${m.a}-${m.b}`} match={m} people={people} big={i === 0} />
            ))}
          </div>
        </>
      )}

      {top.length > 0 && (
        <>
          <h2 className="h2">
            {who ? t("{name}'s top {n}", { name: who.name, n: top.length }) : t('Top {n} of {year}', { n: top.length, year })}
            {who && <small>{t("{name}'s own stars", { name: who.name })}</small>}
          </h2>
          <div className="top5">
            {top.map(({ watch, avg }, i) => (
              <button key={watch.id} onClick={() => onOpen(watch)} aria-label={t('Number {n}: {show}, {stars} stars', { n: i + 1, show: watch.showName, stars: avg.toFixed(1) })}>
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
        {t('Month by month')}
        <small>{t('tap to open')}</small>
      </h2>
      {months.length === 0 ? (
        <p className="muted">{t('Nothing to show for {year} yet.', { year })}</p>
      ) : (
        <ul className="card">
          {months.map((m) => (
            <li key={m.month}>
              <button className="mrow" onClick={() => setOpenMonth(m.month)}>
                <span className="m">{monthLabel(m.month, 'long').split(' ')[0]}</span>
                <span className="track"><i style={{ width: `${(m.count / max) * 100}%` }} /></span>
                <span className={`n ${m.count ? '' : 'zero'}`}>{m.count === 1 ? t('{n} show', { n: m.count }) : t('{n} shows', { n: m.count })}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <h2 className="h2">{t('Who rates highest')}</h2>
      <ul className="card">
        {[...people]
          .sort((a, b) => (averages[b.id] ?? -1) - (averages[a.id] ?? -1))
          .map((p) => (
            <li key={p.id}>
              <div className="lrow">
                <Avatar people={people} id={p.id} size={36} />
                <span className="lrow-text">
                  <span className="lrow-title">{p.name}</span>
                  <span className="muted">{averages[p.id] != null ? t('Average rating') : t('No ratings in {year}', { year })}</span>
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
        {t('Family badges')}
        <small>{t('{n} of {total}', { n: earned, total: badges.length })}</small>
      </h2>
      <button className="help-link" onClick={() => onHelp('badges')} style={{ marginTop: -8 }}>
        <Icon name="info" size={15} stroke={2.2} /> {t('How do badges work?')}
      </button>
      <div className="badges">
        {[...badges].sort((a, b) => Number(b.earned) - Number(a.earned)).map((b) => (
          <BadgeTile key={b.id} badge={b} />
        ))}
      </div>

      {s.disagreements.length > 0 && (
        <>
          <h2 className="h2">
            {t('Biggest debates')}
            <small>{t('2+ stars apart')}</small>
          </h2>
          <ul className="card">
            {s.disagreements.map(({ watch }) => (
              <li key={watch.id}>
                <button className="lrow" onClick={() => onOpen(watch)}>
                  <span className="lrow-text">
                    <span className="lrow-title">{watch.showName}</span>
                    <span className="muted">{t('Season {n}', { n: watch.season })}</span>
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
      {openMonth && (
        <MonthSheet
          month={openMonth}
          watches={mine}
          people={people}
          personId={filter}
          onFlash={onFlash}
          onClose={() => setOpenMonth(null)}
          onOpen={(w) => {
            setOpenMonth(null)
            onOpen(w)
          }}
        />
      )}
    </div>
  )
}
