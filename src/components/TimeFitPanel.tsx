import { useState } from 'react'
import { t } from '../i18n'
import { durationLabel, TIME_CHOICES, whatFits } from '../timeFit'
import type { ListItem, Watch, WatchList } from '../types'
import { PosterFill } from './Poster'

const KEY = 'pititi.timefit.v1'

interface Props {
  watching: Watch[]
  lists: WatchList[]
  items: ListItem[]
  household: string | null
  watches: Watch[]
  readOnly: boolean
  onOpen: (w: Watch) => void
  onWatch: (item: ListItem) => void
}

/** Tonight · "We have time": pick how long, see what fits (next episodes, or a movie from your lists). */
export function TimeFitPanel({ watching, lists, items, household, watches, readOnly, onOpen, onWatch }: Props) {
  const [minutes, setMinutes] = useState<number>(() => {
    try {
      const n = Number(localStorage.getItem(KEY))
      return (TIME_CHOICES as readonly number[]).includes(n) ? n : 60
    } catch {
      return 60
    }
  })
  const choose = (n: number) => {
    setMinutes(n)
    try {
      localStorage.setItem(KEY, String(n))
    } catch {
      // Back to 1 h next time
    }
  }
  const fits = whatFits(minutes, { watching, lists, items, household, watches }).slice(0, 5)
  const labels: Record<number, string> = { 30: t('30 min'), 60: t('1 hour'), 120: t('2 hours'), 240: t('All night') }

  return (
    <div className="timefit" aria-label={t('We have time')}>
      <div className="timefit-choices" role="radiogroup" aria-label={t('How much time do you have?')}>
        {TIME_CHOICES.map((n) => (
          <button key={n} type="button" role="radio" aria-checked={minutes === n} className={minutes === n ? 'on' : ''} onClick={() => choose(n)}>
            {labels[n]}
          </button>
        ))}
      </div>
      {fits.length === 0 ? (
        <p className="tonight-sub">{t('Nothing fits in that time yet. Try more time, or add a few movies to Up Next.')}</p>
      ) : (
        <ul className="timefit-list">
          {fits.map((f) =>
            f.type === 'episodes' ? (
              <li key={`e${f.watch.id}`}>
                <button type="button" className="timefit-row" onClick={() => onOpen(f.watch)} aria-label={t('{show}: {what}. Open', { show: f.watch.showName, what: f.count === 1 ? t('episode {n}', { n: f.from }) : t('episodes {from} to {to}', { from: f.from, to: f.to }) })}>
                  <span className="timefit-poster">
                    <PosterFill src={f.watch.poster} name={f.watch.showName} />
                  </span>
                  <span className="timefit-text">
                    <b>{f.watch.showName}</b>
                    <span>
                      {f.count === 1 ? t('Next episode · S{s} E{n}', { s: f.watch.season, n: f.from }) : t('{count} episodes · S{s} E{from}–E{to}', { count: f.count, s: f.watch.season, from: f.from, to: f.to })}
                    </span>
                  </span>
                  <span className="timefit-time">{durationLabel(f.minutes)}</span>
                </button>
              </li>
            ) : (
              <li key={`m${f.item.extId}`}>
                <div className="timefit-row">
                  <span className="timefit-poster">
                    <PosterFill src={f.item.poster} name={f.item.title} />
                  </span>
                  <span className="timefit-text">
                    <b>{f.item.title}</b>
                    <span>
                      {t('Movie')}
                      {f.item.year ? ` · ${f.item.year}` : ''} · {t('on your list')}
                    </span>
                  </span>
                  <span className="timefit-time">{durationLabel(f.minutes)}</span>
                  {!readOnly && (
                    <button type="button" className="btn sm primary" onClick={() => onWatch(f.item)} aria-label={t("We're watching {title}", { title: f.item.title })}>
                      {t('Watch')}
                    </button>
                  )}
                </div>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  )
}
