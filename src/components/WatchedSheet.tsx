import { useEffect, useState } from 'react'
import { t } from '../i18n'
import { monthBreakdown, monthLabel, sortMonthRows, type MonthSort } from '../logic'
import type { Kind, Watch } from '../types'
import { Icon } from './Icon'
import { Poster } from './Poster'

interface Props {
  /** Logs of that month, already filtered to the person picked on Home */
  list: Watch[]
  month: string
  /** Whose month it is (null = everyone) */
  who: string | null
  sort: MonthSort
  /** Only shows or only movies (null: both); opened from the matching tile, changeable in the sheet */
  kind?: Kind | null
  /** Home's month view: no person = what you watched together, a person = what they watched alone */
  together?: boolean
  onOpen: (w: Watch) => void
  onClose: () => void
}

const hm = (minutes: number) => {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`
}

/** Behind the Home tiles: every show and movie of the month, with its episodes and time. */
export function WatchedSheet({ list, month, who, sort: initial, kind: initialKind = null, together = false, onOpen, onClose }: Props) {
  const [sort, setSort] = useState<MonthSort>(initial)
  const [kind, setKind] = useState<Kind | null>(initialKind)
  const all = monthBreakdown(list, month)
  const rows = sortMonthRows(kind ? all.filter((r) => r.kind === kind) : all, sort)
  const series = rows.filter((r) => r.kind === 'tv').length
  const movies = rows.filter((r) => r.kind === 'movie').length
  const monthName = monthLabel(month, 'long').split(' ')[0]
  const title = together
    ? who
      ? t('What {name} watched alone in {month}', { name: who, month: monthName })
      : t('What you watched together in {month}', { month: monthName })
    : who
      ? t('What {name} watched in {month}', { name: who, month: monthName })
      : t('What you watched in {month}', { month: monthName })
  const totalEps = rows.reduce((n, r) => n + (r.kind === 'tv' ? r.episodes : 0), 0)
  const totalMin = rows.reduce((n, r) => n + r.minutes, 0)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const kinds: [Kind | null, string][] = [
    [null, t('All')],
    ['tv', t('Shows')],
    ['movie', t('Movies')],
  ]
  const sorts: [MonthSort, string][] = [
    ['episodes', t('Episodes')],
    ['hours', t('Time')],
    ['az', t('A–Z')],
  ]

  return (
    <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label={title}>
      <button className="sheet-dim" aria-label={t('Close')} onClick={onClose} />
      <div className="sheet">
        <div className="grabber" aria-hidden="true" />
        <div className="topbar" style={{ paddingTop: 0 }}>
          <div style={{ minWidth: 0 }}>
            <p className="label-sm">{who ? who : together ? t('Together') : t('Everyone')} · {monthLabel(month)}</p>
            <h2 className="sheet-title">{title}</h2>
          </div>
          <button className="icon-btn" aria-label={t('Close')} onClick={onClose}>
            <Icon name="close" size={18} />
          </button>
        </div>

        {all.length > 0 && all.some((r) => r.kind === 'movie') && all.some((r) => r.kind === 'tv') && (
          <div className="kind-chips" role="radiogroup" aria-label={t('Shows or movies')}>
            {kinds.map(([k, label]) => (
              <button key={label} role="radio" aria-checked={kind === k} className={`chip ${kind === k ? 'on' : ''}`} onClick={() => setKind(k)}>
                {label}
              </button>
            ))}
          </div>
        )}
        {rows.length === 0 ? (
          <p className="muted">{t('Nothing logged this month yet.')}</p>
        ) : (
          <>
            <div className="segmented" role="radiogroup" aria-label={t('Sort by')}>
              {sorts.map(([k, label]) => (
                <button key={k} role="radio" aria-checked={sort === k} className={sort === k ? 'on' : ''} onClick={() => setSort(k)}>
                  {label}
                </button>
              ))}
            </div>
            <ul className="watched-list">
              {rows.map((r) => (
                <li key={r.key}>
                  <button onClick={() => onOpen(r.open)} aria-label={t('Open {name}', { name: r.title })}>
                    <Poster src={r.poster} name={r.title} w={44} />
                    <span className="lrow-text">
                      <span className="lrow-title">{r.title}</span>
                      <span className="muted small">
                        {r.kind === 'movie'
                          ? t('Movie')
                          : r.seasons.length > 1
                            ? t('Seasons {list}', { list: r.seasons.join(', ') })
                            : t('Season {n}', { n: r.seasons[0] })}
                        {' · '}
                        {r.finished ? t('Finished') : t('Watching')}
                      </span>
                    </span>
                    <span className="watched-nums">
                      {r.kind === 'tv' && <b>{r.episodes === 1 ? t('1 ep') : t('{n} eps', { n: r.episodes })}</b>}
                      {r.minutes > 0 && <span className="muted small">{hm(r.minutes)}</span>}
                    </span>
                    <Icon name="right" size={18} />
                  </button>
                </li>
              ))}
            </ul>
            <p className="watched-total">
              <span>{t('Total')}</span>
              <span>
                {[
                  series ? (series === 1 ? t('1 show') : t('{n} shows', { n: series })) : null,
                  movies ? (movies === 1 ? t('1 movie') : t('{n} movies', { n: movies })) : null,
                  totalEps ? (totalEps === 1 ? t('1 ep') : t('{n} eps', { n: totalEps })) : null,
                  hm(totalMin),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
