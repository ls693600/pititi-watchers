import { useEffect, useState } from 'react'
import { averageRating, episodesIn, monthLabel, summarize, watchesInMonth } from '../logic'
import { drawMonthCard, shareImage } from '../share'
import type { Person, Watch } from '../types'
import { Avatar } from './Avatar'
import { AvgStars } from './Stars'
import { Icon } from './Icon'
import { Poster } from './Poster'
import { t } from '../i18n'

interface Props {
  month: string
  /** Logs already narrowed to the person filter, if any */
  watches: Watch[]
  people: Person[]
  /** Person filter on Stats: show their own stars instead of the family average */
  personId: string | null
  onOpen: (w: Watch) => void
  onClose: () => void
  onFlash: (msg: string) => void
}

/** Everything watched in one month, right inside Stats, with a share card. */
export function MonthSheet({ month, watches, people, personId, onOpen, onClose, onFlash }: Props) {
  const list = watchesInMonth(watches, month)
  const sum = summarize(list, month)
  const [sharing, setSharing] = useState(false)
  const monthName = monthLabel(month, 'long').split(' ')[0]
  const who = people.find((p) => p.id === personId)
  const starsFor = (w: Watch) => (personId ? (w.ratings[personId] ?? null) : averageRating(w))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function share() {
    setSharing(true)
    try {
      const names = who ? who.name : people.filter((p) => list.some((w) => w.watchedBy.includes(p.id))).map((p) => p.name).join(' & ') || t('Our family')
      const blob = await drawMonthCard({
        monthName,
        totals: sum,
        names,
        shows: list.map((w) => ({
          name: w.showName,
          poster: w.poster,
          stars: starsFor(w),
          note: w.status === 'watching' ? t('Still watching') : t('Not rated yet'),
        })),
      })
      const result = await shareImage(blob, `pititi-${month}.png`, who ? t("{name}'s {month} on Pititi Watchers", { name: who.name, month: monthName }) : t('Our {month} on Pititi Watchers', { month: monthName }))
      if (result === 'saved') onFlash(t('Picture saved. Send it from your photos or files.'))
    } catch {
      onFlash(t("Couldn't make the picture. Check your connection and try again."))
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label={t('{month} details', { month: monthLabel(month) })}>
      <button className="sheet-dim" aria-label={t('Close')} onClick={onClose} />
      <div className="sheet">
        <div className="grabber" aria-hidden="true" />
        <div className="topbar" style={{ paddingTop: 0 }}>
          <div>
            <p className="label-sm">{who ? `${who.name} · ` : ''}{t('Month details')}</p>
            <h2 className="sheet-title">{monthLabel(month)}</h2>
          </div>
          <button className="icon-btn" aria-label={t('Close')} onClick={onClose}>
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="tiles">
          <div className="tile"><strong>{sum.shows}</strong><span>{sum.shows === 1 ? t('show') : t('shows')}</span></div>
          <div className="tile"><strong>{sum.episodes}</strong><span>{t('episodes')}</span></div>
          <div className="tile"><strong>{sum.hours}h</strong><span>{t('watched')}</span></div>
        </div>

        {list.length === 0 ? (
          <p className="muted center" style={{ padding: 16 }}>{t('Nothing logged in {month}.', { month: monthLabel(month) })}</p>
        ) : (
          <ul className="month-list">
            {list.map((w) => {
              const stars = starsFor(w)
              const eps = episodesIn(w, month)
              return (
                <li key={w.id}>
                  <button className="lrow" onClick={() => onOpen(w)}>
                    <Poster src={w.poster} name={w.showName} w={44} />
                    <span className="lrow-text">
                      <span className="lrow-title">{w.showName}</span>
                      <span className="muted">
                        {t('S{season}', { season: w.season })} · {eps === 1 ? t('{n} episode this month', { n: eps }) : t('{n} episodes this month', { n: eps })} · {w.status === 'done' ? t('finished') : t('in progress')}
                      </span>
                      <span className="stack" style={{ marginTop: 3 }}>
                        {w.watchedBy.map((id) => (
                          <Avatar key={id} people={people} id={id} size={18} />
                        ))}
                      </span>
                    </span>
                    {stars != null ? (
                      <span className="month-stars">
                        <AvgStars value={stars} size={13} />
                        <b>{stars.toFixed(1)}</b>
                      </span>
                    ) : (
                      <span className="muted" style={{ fontSize: 12 }}>{t('Not rated')}</span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <button className="btn primary block" onClick={share} disabled={sharing || list.length === 0}>
          <Icon name="share" size={18} /> {sharing ? t('Making the picture…') : who ? t("Share {name}'s {month}", { name: who.name, month: monthName }) : t('Share our {month}', { month: monthName })}
        </button>
      </div>
    </div>
  )
}
